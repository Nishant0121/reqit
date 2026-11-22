import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseOpenApiSpec,
  importOpenApiToDirectory,
  generateExampleFromSchema,
  convertPathParameters,
  mapSecuritySchemeToAuth,
  sanitizeFilename,
  fetchSpecFromUrl,
  type OpenApiSchema,
} from '../src/openapi/index.js';
import { parseRequest } from '../src/format/parser.js';

describe('Phase 23: OpenAPI & Swagger Import', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-openapi-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Path conversion and Sanitization', () => {
    it('converts OpenAPI {param} templates to REST :param syntax', () => {
      expect(convertPathParameters('/users/{userId}')).toBe('/users/:userId');
      expect(convertPathParameters('/repos/{owner}/{repo}/issues/{issueId}')).toBe(
        '/repos/:owner/:repo/issues/:issueId',
      );
      expect(convertPathParameters('/health')).toBe('/health');
    });

    it('sanitizes illegal characters in filenames', () => {
      expect(sanitizeFilename('GET /users/:id')).toBe('GET -users-id');
      expect(sanitizeFilename('Find Pet by ID (v2.0)')).toBe('Find Pet by ID (v2.0)');
      expect(sanitizeFilename('Delete * from "table"?')).toBe('Delete - from -table-');
    });
  });

  describe('Schema Example Generator', () => {
    it('generates primitives and formatted strings', () => {
      expect(generateExampleFromSchema({ type: 'string', format: 'email' })).toBe(
        'user@example.com',
      );
      expect(generateExampleFromSchema({ type: 'string', format: 'uuid' })).toBe(
        '123e4567-e89b-12d3-a456-426614174000',
      );
      expect(generateExampleFromSchema({ type: 'string', format: 'date-time' })).toBe(
        '2026-01-01T12:00:00.000Z',
      );
      expect(generateExampleFromSchema({ type: 'integer', minimum: 5 })).toBe(5);
      expect(generateExampleFromSchema({ type: 'boolean' })).toBe(true);
      expect(generateExampleFromSchema({ type: 'string', enum: ['active', 'inactive'] })).toBe(
        'active',
      );
    });

    it('generates objects with properties and arrays', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };
      const ex = generateExampleFromSchema(schema) as Record<string, unknown>;
      expect(ex).toBeDefined();
      expect(ex.id).toBe(0);
      expect(typeof ex.name).toBe('string');
      expect(Array.isArray(ex.tags)).toBe(true);
      expect((ex.tags as string[])[0]).toBe('string');
    });

    it('resolves internal $ref pointers', () => {
      const rootDoc = {
        components: {
          schemas: {
            Category: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const petSchema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          category: { $ref: '#/components/schemas/Category' },
        },
      };

      const ex = generateExampleFromSchema(petSchema, rootDoc) as Record<string, unknown>;
      expect(ex).toBeDefined();
      expect(ex.id).toBe(0);
      expect(ex.category).toEqual({ id: 0, name: 'John Doe' });
    });

    it('protects against cyclic $ref infinite recursion', () => {
      const rootDoc = {
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                next: { $ref: '#/components/schemas/Node' },
              },
            },
          },
        },
      };

      const schema = { $ref: '#/components/schemas/Node' };
      const ex = generateExampleFromSchema(schema, rootDoc) as Record<string, unknown>;
      expect(ex).toBeDefined();
      expect(ex.id).toBe(0);
      expect(ex.next).toBeNull(); // Cyclic ref severed safely
    });

    it('merges allOf schemas', () => {
      const schema: OpenApiSchema = {
        allOf: [
          {
            type: 'object',
            properties: { id: { type: 'integer' } },
          },
          {
            type: 'object',
            properties: { title: { type: 'string' } },
          },
        ],
      };
      const ex = generateExampleFromSchema(schema) as Record<string, unknown>;
      expect(ex).toEqual({ id: 0, title: 'Sample Title' });
    });
  });

  describe('OpenAPI 3.0 & 3.1 Parsing', () => {
    it('parses OpenAPI 3.0 JSON specification', () => {
      const openapiJson = JSON.stringify({
        openapi: '3.0.3',
        info: {
          title: 'Petstore API',
          version: '1.0.0',
          description: 'A sample petstore server',
        },
        servers: [{ url: 'https://petstore.example.com/api/v1' }],
        paths: {
          '/pets': {
            get: {
              tags: ['pets'],
              summary: 'List all pets',
              operationId: 'listPets',
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer', default: 20 },
                },
              ],
              responses: {
                '200': { description: 'A list of pets' },
              },
            },
            post: {
              tags: ['pets'],
              summary: 'Create a pet',
              operationId: 'createPet',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: 'Fido' },
                        tag: { type: 'string', example: 'dog' },
                      },
                    },
                  },
                },
              },
              responses: {
                '201': { description: 'Null response' },
              },
            },
          },
          '/pets/{petId}': {
            get: {
              tags: ['pets'],
              summary: 'Get pet by ID',
              parameters: [
                {
                  name: 'petId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': { description: 'Expected response to a valid request' },
              },
            },
          },
        },
      });

      const parsed = parseOpenApiSpec(openapiJson);
      expect(parsed.specFormat).toBe('openapi3');
      expect(parsed.title).toBe('Petstore API');
      expect(parsed.baseUrl).toBe('https://petstore.example.com/api/v1');
      expect(parsed.folders.length).toBe(1);
      expect(parsed.folders[0]!.name).toBe('pets');
      expect(parsed.allRequests.length).toBe(3);

      const listReq = parsed.allRequests.find(r => r.request.name === 'List all pets');
      expect(listReq).toBeDefined();
      expect(listReq!.method).toBe('GET');
      expect(listReq!.url).toBe('{{baseUrl}}/pets');
      expect(listReq!.request.params).toEqual([
        { name: 'limit', value: '20', enabled: true, description: undefined },
      ]);

      const createReq = parsed.allRequests.find(r => r.request.name === 'Create a pet');
      expect(createReq).toBeDefined();
      expect(createReq!.method).toBe('POST');
      expect(createReq!.request.body?.type).toBe('json');
      const bodyJson = JSON.parse(createReq!.request.body?.content || '{}');
      expect(bodyJson).toEqual({ name: 'Fido', tag: 'dog' });

      const getReq = parsed.allRequests.find(r => r.request.name === 'Get pet by ID');
      expect(getReq).toBeDefined();
      expect(getReq!.url).toBe('{{baseUrl}}/pets/:petId');
    });

    it('parses OpenAPI 3.0 YAML specification', () => {
      const openapiYaml = `
openapi: "3.0.0"
info:
  title: "YAML Petstore"
  version: "1.0.0"
servers:
  - url: "https://yaml.example.com/v1"
paths:
  /health:
    get:
      summary: "Health Check"
      responses:
        "200":
          description: "OK"
`;
      const parsed = parseOpenApiSpec(openapiYaml);
      expect(parsed.specFormat).toBe('openapi3');
      expect(parsed.title).toBe('YAML Petstore');
      expect(parsed.baseUrl).toBe('https://yaml.example.com/v1');
      expect(parsed.rootRequests.length).toBe(1);
      expect(parsed.rootRequests[0]!.request.name).toBe('Health Check');
      expect(parsed.rootRequests[0]!.url).toBe('{{baseUrl}}/health');
    });
  });

  describe('Swagger 2.0 Parsing', () => {
    it('parses Swagger 2.0 JSON with parameters and security definitions', () => {
      const swaggerJson = JSON.stringify({
        swagger: '2.0',
        info: {
          title: 'Legacy Swagger Store',
          version: '1.0.0',
        },
        host: 'swagger.example.com',
        basePath: '/v2',
        schemes: ['https'],
        securityDefinitions: {
          api_key: {
            type: 'apiKey',
            name: 'api_key',
            in: 'header',
          },
          basic_auth: {
            type: 'basic',
          },
        },
        security: [{ api_key: [] }],
        paths: {
          '/orders': {
            post: {
              tags: ['store'],
              summary: 'Place an order',
              consumes: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  required: true,
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer', example: 101 },
                      status: { type: 'string', example: 'placed' },
                    },
                  },
                },
              ],
              responses: {
                '200': { description: 'successful operation' },
              },
            },
          },
          '/public-status': {
            get: {
              summary: 'Public Status',
              security: [], // Explicitly no auth
              responses: {
                '200': { description: 'OK' },
              },
            },
          },
        },
      });

      const parsed = parseOpenApiSpec(swaggerJson);
      expect(parsed.specFormat).toBe('swagger2');
      expect(parsed.title).toBe('Legacy Swagger Store');
      expect(parsed.baseUrl).toBe('https://swagger.example.com/v2');
      expect(parsed.allRequests.length).toBe(2);

      const orderReq = parsed.allRequests.find(r => r.request.name === 'Place an order');
      expect(orderReq).toBeDefined();
      expect(orderReq!.request.body?.type).toBe('json');
      expect(JSON.parse(orderReq!.request.body?.content || '{}')).toEqual({
        id: 101,
        status: 'placed',
      });
      // Inherited default api_key security
      expect(orderReq!.request.auth?.type).toBe('apikey');
      expect((orderReq!.request.auth as { key?: string })?.key).toBe('api_key');

      const publicReq = parsed.allRequests.find(r => r.request.name === 'Public Status');
      expect(publicReq).toBeDefined();
      expect(publicReq!.request.auth?.type).toBe('none');
    });
  });

  describe('Security Scheme Mappings', () => {
    it('maps HTTP Bearer tokens', () => {
      const auth = mapSecuritySchemeToAuth('jwtAuth', {
        type: 'http',
        scheme: 'bearer',
      });
      expect(auth).toEqual({
        type: 'bearer',
        token: '{{jwtAuthToken || token}}',
      });
    });

    it('maps HTTP Basic auth', () => {
      const auth = mapSecuritySchemeToAuth('basicAuth', {
        type: 'http',
        scheme: 'basic',
      });
      expect(auth).toEqual({
        type: 'basic',
        username: '{{username}}',
        password: '{{password}}',
      });
    });

    it('maps API Key in header and query', () => {
      const headerAuth = mapSecuritySchemeToAuth('headerKey', {
        type: 'apiKey',
        name: 'X-App-ID',
        in: 'header',
      });
      expect(headerAuth).toEqual({
        type: 'apikey',
        key: 'X-App-ID',
        value: '{{headerKey || apiKey}}',
        in: 'header',
      });

      const queryAuth = mapSecuritySchemeToAuth('queryKey', {
        type: 'apiKey',
        name: 'access_token',
        in: 'query',
      });
      expect(queryAuth).toEqual({
        type: 'apikey',
        key: 'access_token',
        value: '{{queryKey || apiKey}}',
        in: 'query',
      });
    });
  });

  describe('Import to Directory and Re-import Modes', () => {
    const sampleSpec = {
      openapi: '3.0.0',
      info: { title: 'Test Import', version: '1.0.0' },
      servers: [{ url: 'https://api.test.com' }],
      paths: {
        '/users': {
          get: {
            tags: ['users'],
            summary: 'Get Users',
            parameters: [
              {
                name: 'role',
                in: 'query',
                schema: { type: 'string', default: 'admin' },
              },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    it('writes collection structure, reqit.yaml, folder.yaml, and requests on disk', async () => {
      const report = await importOpenApiToDirectory({
        spec: sampleSpec,
        targetDir: tempDir,
      });

      expect(report.totalRequests).toBe(1);
      expect(report.totalFolders).toBe(1);
      expect(report.createdRequests).toBe(1);

      // Verify reqit.yaml exists
      expect(fs.existsSync(path.join(tempDir, 'reqit.yaml'))).toBe(true);

      // Verify environments/default.yaml exists
      const envPath = path.join(tempDir, 'environments', 'default.yaml');
      expect(fs.existsSync(envPath)).toBe(true);
      const envContent = await fs.promises.readFile(envPath, 'utf-8');
      expect(envContent).toContain('baseUrl');

      // Verify users/folder.yaml and users/Get Users.yaml
      const folderYamlPath = path.join(tempDir, 'users', 'folder.yaml');
      expect(fs.existsSync(folderYamlPath)).toBe(true);

      const requestYamlPath = path.join(tempDir, 'users', 'Get Users.yaml');
      expect(fs.existsSync(requestYamlPath)).toBe(true);

      const reqContent = await fs.promises.readFile(requestYamlPath, 'utf-8');
      const parsedReq = parseRequest(reqContent);
      expect(parsedReq.name).toBe('Get Users');
      expect(parsedReq.method).toBe('GET');
      expect(parsedReq.params?.[0]?.name).toBe('role');
    });

    it('re-import in add-new mode preserves existing files', async () => {
      // 1. Initial import
      await importOpenApiToDirectory({
        spec: sampleSpec,
        targetDir: tempDir,
        mode: 'clean',
      });

      // 2. Modify existing request file with user edits
      const requestYamlPath = path.join(tempDir, 'users', 'Get Users.yaml');
      const customReqContent = `
version: 1
name: "Get Users (Customized)"
method: GET
url: "{{baseUrl}}/users"
scripts:
  pre: "console.log('user script');"
`;
      await fs.promises.writeFile(requestYamlPath, customReqContent, 'utf-8');

      // 3. Re-import with mode: 'add-new'
      const reimportReport = await importOpenApiToDirectory({
        spec: sampleSpec,
        targetDir: tempDir,
        mode: 'add-new',
      });

      expect(reimportReport.skippedRequests).toBe(1);
      expect(reimportReport.createdRequests).toBe(0);

      // Existing file should still have custom script!
      const contentAfter = await fs.promises.readFile(requestYamlPath, 'utf-8');
      expect(contentAfter).toContain("console.log('user script')");
    });

    it('re-import in merge mode preserves user scripts, tests, and merges parameters', async () => {
      // 1. Initial import
      await importOpenApiToDirectory({
        spec: sampleSpec,
        targetDir: tempDir,
        mode: 'clean',
      });

      // 2. Add user custom test assertion & script to existing file
      const requestYamlPath = path.join(tempDir, 'users', 'Get Users.yaml');
      const existingReq = parseRequest(await fs.promises.readFile(requestYamlPath, 'utf-8'));
      existingReq.version = 1;
      existingReq.scripts = {
        pre: 'reqit.setVar("custom", 123);',
      };
      existingReq.tests = [
        {
          name: 'Status is 200',
          assert: 'res.status == 200',
          enabled: true,
        },
      ];
      // Add custom user query parameter
      existingReq.params = [
        ...(existingReq.params || []),
        { name: 'userCustomParam', value: 'myValue', enabled: true },
      ];

      const { serializeRequest } = await import('../src/format/serializer.js');
      await fs.promises.writeFile(requestYamlPath, serializeRequest(existingReq), 'utf-8');

      // 3. Updated spec introduces a brand new query parameter 'sortBy'
      const updatedSpec = {
        ...sampleSpec,
        paths: {
          '/users': {
            get: {
              tags: ['users'],
              summary: 'Get Users',
              parameters: [
                {
                  name: 'role',
                  in: 'query',
                  schema: { type: 'string', default: 'admin' },
                },
                {
                  name: 'sortBy',
                  in: 'query',
                  schema: { type: 'string', default: 'createdAt' },
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      // 4. Re-import with mode: 'merge'
      const mergeReport = await importOpenApiToDirectory({
        spec: updatedSpec,
        targetDir: tempDir,
        mode: 'merge',
      });

      expect(mergeReport.mergedRequests).toBe(1);

      // Read merged file
      const mergedContent = await fs.promises.readFile(requestYamlPath, 'utf-8');
      const mergedReq = parseRequest(mergedContent);

      // Preserved scripts & tests
      expect(mergedReq.scripts?.pre).toBe('reqit.setVar("custom", 123);');
      expect(mergedReq.tests?.length).toBe(1);
      expect(mergedReq.tests?.[0]?.name).toBe('Status is 200');

      // Preserved user custom param AND merged incoming 'sortBy' param!
      const paramNames = mergedReq.params?.map(p => p.name);
      expect(paramNames).toContain('role');
      expect(paramNames).toContain('userCustomParam');
      expect(paramNames).toContain('sortBy');
    });
  });

  describe('URL Fetcher', () => {
    it('rejects invalid schemes', async () => {
      await expect(fetchSpecFromUrl('ftp://invalid.com/spec.json')).rejects.toThrow(
        'Invalid URL scheme',
      );
    });

    it('fetches specification from HTTP/HTTPS with proper headers', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (_input: RequestInfo | URL) => {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () =>
              '{"openapi":"3.0.0","info":{"title":"Remote API","version":"1.0.0"},"paths":{}}',
          } as unknown as Response;
        };

        const content = await fetchSpecFromUrl('https://example.com/openapi.json');
        expect(content).toContain('Remote API');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('handles HTTP error responses', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () => '',
          } as unknown as Response;
        };

        await expect(fetchSpecFromUrl('https://example.com/notfound.json')).rejects.toThrow(
          'HTTP 404 Not Found',
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Done when: Real-world spec with 100+ operations', () => {
    it('generates a clean, readable collection from a spec with 100+ operations', async () => {
      // Build a comprehensive, realistic OpenAPI specification with 105 operations across 7 domains
      const domains = [
        'Users',
        'Products',
        'Orders',
        'Payments',
        'Inventory',
        'Notifications',
        'Analytics',
      ];
      const pathsObj: Record<string, Record<string, unknown>> = {};

      let totalOpsCount = 0;

      for (const domain of domains) {
        const lowerDomain = domain.toLowerCase();
        // 15 operations per domain = 105 total operations
        for (let i = 1; i <= 3; i++) {
          const basePath = `/${lowerDomain}/group${i}`;
          pathsObj[basePath] = {
            get: {
              tags: [domain],
              summary: `List ${domain} in Group ${i}`,
              operationId: `list${domain}G${i}`,
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                {
                  name: 'X-Tenant-Id',
                  in: 'header',
                  schema: { type: 'string', default: 'tenant_1' },
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: [domain],
              summary: `Create ${domain} in Group ${i}`,
              operationId: `create${domain}G${i}`,
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: `${domain} Item` },
                        active: { type: 'boolean', default: true },
                        count: { type: 'integer', minimum: 1 },
                      },
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
            put: {
              tags: [domain],
              summary: `Bulk Update ${domain} in Group ${i}`,
              operationId: `bulkUpdate${domain}G${i}`,
              responses: { '200': { description: 'Updated' } },
            },
            delete: {
              tags: [domain],
              summary: `Batch Delete ${domain} in Group ${i}`,
              operationId: `batchDelete${domain}G${i}`,
              responses: { '204': { description: 'Deleted' } },
            },
            patch: {
              tags: [domain],
              summary: `Patch ${domain} in Group ${i}`,
              operationId: `patch${domain}G${i}`,
              responses: { '200': { description: 'Patched' } },
            },
          };
          totalOpsCount += 5;
        }
      }

      expect(totalOpsCount).toBe(105);

      const largeSpec = {
        openapi: '3.0.3',
        info: {
          title: 'Enterprise Microservices API',
          version: '2.4.0',
          description: 'A large-scale enterprise specification with 100+ operations.',
        },
        servers: [{ url: 'https://gateway.enterprise.com/api/v2' }],
        security: [{ BearerAuth: [] }],
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        tags: domains.map(d => ({
          name: d,
          description: `All operations and resources related to ${d}`,
        })),
        paths: pathsObj,
      };

      // Import the 105-operation spec into directory
      const report = await importOpenApiToDirectory({
        spec: largeSpec,
        targetDir: tempDir,
        mode: 'clean',
      });

      expect(report.totalRequests).toBe(105);
      expect(report.totalFolders).toBe(7);
      expect(report.createdRequests).toBe(105);
      expect(report.skippedRequests).toBe(0);
      expect(report.warnings.length).toBe(0);

      // Verify folder structure
      for (const domain of domains) {
        const domainDir = path.join(tempDir, domain);
        expect(fs.existsSync(domainDir)).toBe(true);

        // folder.yaml exists with description
        const folderYaml = await fs.promises.readFile(path.join(domainDir, 'folder.yaml'), 'utf-8');
        expect(folderYaml).toContain(`name: ${domain}`);
        expect(folderYaml).toContain(`All operations and resources related to ${domain}`);

        // Requests in this folder
        const files = await fs.promises.readdir(domainDir);
        const yamlRequestFiles = files.filter(f => f.endsWith('.yaml') && f !== 'folder.yaml');
        expect(yamlRequestFiles.length).toBe(15);
      }

      // Check one specific request file in detail
      const sampleReqPath = path.join(tempDir, 'Users', 'Create Users in Group 1.yaml');
      expect(fs.existsSync(sampleReqPath)).toBe(true);

      const parsedSample = parseRequest(await fs.promises.readFile(sampleReqPath, 'utf-8'));
      expect(parsedSample.name).toBe('Create Users in Group 1');
      expect(parsedSample.method).toBe('POST');
      expect(parsedSample.url).toBe('{{baseUrl}}/users/group1');
      expect(parsedSample.body?.type).toBe('json');
      expect(parsedSample.auth?.type).toBe('bearer');
      const body = JSON.parse(parsedSample.body?.content || '{}');
      expect(body.name).toBe('Users Item');
      expect(body.active).toBe(true);
    });
  });
});
