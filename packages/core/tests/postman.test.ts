import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parsePostmanCollection,
  parsePostmanEnvironment,
  importPostmanCollectionToDirectory,
  scanCollection,
} from '../src/index.js';

describe('Postman Importer (Phase 15)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reqit-postman-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const sampleCollection = {
    info: {
      _postman_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
      name: 'Sample E-Commerce API',
      description: 'A complete sample Postman collection testing all features.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: 'https://api.store.example.com', type: 'string' },
      { key: 'apiVersion', value: 'v2', type: 'string' },
      { key: 'disabledVar', value: 'xyz', disabled: true },
    ],
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{globalToken}}', type: 'string' }],
    },
    item: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
        auth: {
          type: 'basic',
          basic: [
            { key: 'username', value: 'admin', type: 'string' },
            { key: 'password', value: 'secret123', type: 'string' },
          ],
        },
        item: [
          {
            name: 'Login Admin',
            request: {
              method: 'POST',
              url: {
                raw: '{{baseUrl}}/{{apiVersion}}/auth/login',
                host: ['{{baseUrl}}'],
                path: ['{{apiVersion}}', 'auth', 'login'],
              },
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'X-Custom-Header', value: 'custom-val', disabled: true },
              ],
              body: {
                mode: 'raw',
                raw: '{\n  "email": "admin@example.com",\n  "password": "{{adminPass}}"\n}',
                options: {
                  raw: { language: 'json' },
                },
              },
            },
          },
          {
            name: 'API Key Check',
            request: {
              auth: {
                type: 'apikey',
                apikey: [
                  { key: 'key', value: 'X-Store-Key', type: 'string' },
                  { key: 'value', value: 'test-api-key', type: 'string' },
                  { key: 'in', value: 'header', type: 'string' },
                ],
              },
              method: 'GET',
              url: '{{baseUrl}}/{{apiVersion}}/auth/verify',
            },
          },
        ],
      },
      {
        name: 'Products',
        item: [
          {
            name: 'List Products',
            request: {
              // Inherits collection bearer auth
              auth: { type: 'inherit' },
              method: 'GET',
              url: {
                raw: '{{baseUrl}}/products?page=1&limit=20&filter=active',
                query: [
                  { key: 'page', value: '1', disabled: false },
                  { key: 'limit', value: '20', disabled: false },
                  { key: 'filter', value: 'active', disabled: true },
                ],
              },
            },
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: [
                    "console.log('Fetching products');",
                    "pm.environment.set('fetchedAt', Date.now());",
                  ],
                },
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    "pm.test('Status is 200', function () {",
                    '    pm.response.to.have.status(200);',
                    '});',
                  ],
                },
              },
            ],
          },
          {
            name: 'Create Product (Multipart)',
            request: {
              method: 'POST',
              url: '{{baseUrl}}/products',
              body: {
                mode: 'formdata',
                formdata: [
                  { key: 'name', value: 'Shoes', type: 'text' },
                  { key: 'image', src: 'assets/shoes.png', type: 'file' },
                ],
              },
            },
          },
          {
            name: 'Update Quantity (URL Encoded)',
            request: {
              method: 'PUT',
              url: '{{baseUrl}}/products/123/stock',
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'stockCount', value: '42' },
                  { key: 'reason', value: 'inventory audit', disabled: true },
                ],
              },
            },
          },
        ],
      },
      {
        name: 'GraphQL Query',
        request: {
          method: 'POST',
          url: '{{baseUrl}}/graphql',
          body: {
            mode: 'graphql',
            graphql: {
              query: 'query GetProduct($id: ID!) { product(id: $id) { name price } }',
              variables: '{"id": "123"}',
            },
          },
        },
      },
      {
        name: 'Dynamic Variables Request',
        request: {
          method: 'POST',
          url: '{{baseUrl}}/orders?transactionId={{$guid}}',
          header: [{ key: 'X-Request-Timestamp', value: '{{$timestamp}}' }],
          body: {
            mode: 'raw',
            raw: '{\n  "randomValue": {{$randomInt}}\n}',
          },
        },
      },
    ],
  };

  const sampleEnvironment = {
    id: 'env-1234-abcd',
    name: 'Staging',
    values: [
      { key: 'baseUrl', value: 'https://staging.api.example.com', type: 'default', enabled: true },
      { key: 'adminEmail', value: 'admin@staging.example.com', type: 'default', enabled: true },
      { key: 'adminPass', value: 'super-secret-password-123', type: 'secret', enabled: true },
      { key: 'globalToken', value: 'bearer-token-secret-999', type: 'default', enabled: true },
      { key: 'disabledEnvVar', value: 'not-used', type: 'default', enabled: false },
    ],
    _postman_variable_scope: 'environment',
  };

  it('parses Postman Collection v2.1 metadata and variables into reqit.yaml defaults', () => {
    const result = parsePostmanCollection(sampleCollection);

    expect(result.collection.name).toBe('Sample E-Commerce API');
    expect(result.collection.docs).toBe(
      'A complete sample Postman collection testing all features.',
    );
    expect(result.collection.defaults?.variables).toEqual({
      baseUrl: 'https://api.store.example.com',
      apiVersion: 'v2',
    });
    expect(result.collection.defaults?.auth).toEqual({
      type: 'bearer',
      token: '{{globalToken}}',
    });
  });

  it('maps folders, child requests, and folder order properly', () => {
    const result = parsePostmanCollection(sampleCollection);

    expect(result.items.length).toBe(4);
    const authFolder = result.items[0];
    expect(authFolder).toBeDefined();
    if (authFolder && authFolder.type === 'folder') {
      expect(authFolder.name).toBe('Auth');
      expect(authFolder.folder.order).toEqual(['Login Admin.yaml', 'API Key Check.yaml']);
      expect(authFolder.children.length).toBe(2);

      const loginReq = authFolder.children[0];
      expect(loginReq).toBeDefined();
      if (loginReq && loginReq.type === 'request') {
        expect(loginReq.name).toBe('Login Admin');
        expect(loginReq.request.method).toBe('POST');
        expect(loginReq.request.url).toBe('{{baseUrl}}/{{apiVersion}}/auth/login');
        expect(loginReq.request.headers).toEqual([
          { name: 'Content-Type', value: 'application/json', enabled: true },
          { name: 'X-Custom-Header', value: 'custom-val', enabled: false },
        ]);
        expect(loginReq.request.body?.type).toBe('json');
        // Inherits Basic auth from Auth folder
        expect(loginReq.request.auth).toEqual({
          type: 'basic',
          username: 'admin',
          password: 'secret123',
        });
      }

      const apiKeyReq = authFolder.children[1];
      expect(apiKeyReq).toBeDefined();
      if (apiKeyReq && apiKeyReq.type === 'request') {
        // Explicitly overrides auth with API Key
        expect(apiKeyReq.request.auth).toEqual({
          type: 'apikey',
          key: 'X-Store-Key',
          value: 'test-api-key',
          in: 'header',
        });
      }
    }
  });

  it('maps query parameters cleanly and avoids URL duplication', () => {
    const result = parsePostmanCollection(sampleCollection);
    const productsFolder = result.items[1];
    expect(productsFolder).toBeDefined();

    if (productsFolder && productsFolder.type === 'folder') {
      const listReq = productsFolder.children[0];
      expect(listReq).toBeDefined();
      if (listReq && listReq.type === 'request') {
        expect(listReq.request.url).toBe('{{baseUrl}}/products');
        expect(listReq.request.params).toEqual([
          { name: 'page', value: '1', enabled: true },
          { name: 'limit', value: '20', enabled: true },
          { name: 'filter', value: 'active', enabled: false },
        ]);
        // Inherits Collection-level Bearer auth
        expect(listReq.request.auth).toEqual({
          type: 'bearer',
          token: '{{globalToken}}',
        });
      }
    }
  });

  it('converts all body types: formdata, urlencoded, graphql, raw json', () => {
    const result = parsePostmanCollection(sampleCollection);
    const productsFolder = result.items[1];
    expect(productsFolder).toBeDefined();

    if (productsFolder && productsFolder.type === 'folder') {
      const multipartReq = productsFolder.children[1];
      expect(multipartReq).toBeDefined();
      if (multipartReq && multipartReq.type === 'request') {
        expect(multipartReq.request.body?.type).toBe('multipart');
        expect(multipartReq.request.body?.form).toEqual([
          { name: 'name', value: 'Shoes', isFile: false, enabled: true },
          { name: 'image', value: 'assets/shoes.png', isFile: true, enabled: true },
        ]);
      }

      const urlencodedReq = productsFolder.children[2];
      expect(urlencodedReq).toBeDefined();
      if (urlencodedReq && urlencodedReq.type === 'request') {
        expect(urlencodedReq.request.body?.type).toBe('form');
        expect(urlencodedReq.request.body?.form).toEqual([
          { name: 'stockCount', value: '42', enabled: true },
          { name: 'reason', value: 'inventory audit', enabled: false },
        ]);
      }
    }

    const graphqlReq = result.items[2];
    expect(graphqlReq).toBeDefined();
    if (graphqlReq && graphqlReq.type === 'request') {
      expect(graphqlReq.request.body?.type).toBe('json');
      const parsed = JSON.parse(graphqlReq.request.body?.content || '{}');
      expect(parsed.query).toContain('query GetProduct');
      expect(parsed.variables).toEqual({ id: '123' });
    }
  });

  it('carries scripts over and detects pm.* calls', () => {
    const result = parsePostmanCollection(sampleCollection);
    const productsFolder = result.items[1];
    expect(productsFolder).toBeDefined();

    if (productsFolder && productsFolder.type === 'folder') {
      const listReq = productsFolder.children[0];
      expect(listReq).toBeDefined();
      if (listReq && listReq.type === 'request') {
        expect(listReq.request.scripts?.pre).toContain('[Postman Pre-request Script]');
        expect(listReq.request.scripts?.pre).toContain("pm.environment.set('fetchedAt'");
        expect(listReq.request.scripts?.post).toContain('[Postman Test Script]');
        expect(listReq.request.scripts?.post).toContain('pm.test');
      }
    }
  });

  it('detects unsupported dynamic variables and flags them in warnings', () => {
    const result = parsePostmanCollection(sampleCollection);
    const dynamicReq = result.items[3];
    expect(dynamicReq).toBeDefined();

    if (dynamicReq && dynamicReq.type === 'request') {
      const hasGuidWarn = result.report.warnings.some(w => w.includes('{{$guid}}'));
      const hasTimestampWarn = result.report.warnings.some(w => w.includes('{{$timestamp}}'));
      const hasRandomIntWarn = result.report.warnings.some(w => w.includes('{{$randomInt}}'));

      expect(hasGuidWarn).toBe(true);
      expect(hasTimestampWarn).toBe(true);
      expect(hasRandomIntWarn).toBe(true);
    }
  });

  it('parses Postman environments and moves sensitive variables to SecretsFile', () => {
    const envResult = parsePostmanEnvironment(sampleEnvironment);

    expect(envResult.environment.name).toBe('Staging');
    expect(envResult.environment.variables.baseUrl).toBe('https://staging.api.example.com');
    expect(envResult.environment.variables.adminEmail).toBe('admin@staging.example.com');
    // Disabled variable was omitted
    expect(envResult.environment.variables.disabledEnvVar).toBeUndefined();

    // Sensitive variables moved to secrets:
    // 1. adminPass (explicit type: "secret")
    // 2. globalToken (name heuristic: "token")
    expect(envResult.secrets).toBeDefined();
    const stagingSecrets = envResult.secrets?.environments.Staging;
    expect(stagingSecrets).toBeDefined();
    expect(stagingSecrets?.adminPass).toBe('super-secret-password-123');
    expect(stagingSecrets?.globalToken).toBe('bearer-token-secret-999');
    expect(envResult.environment.variables.adminPass).toBeUndefined();
    expect(envResult.environment.variables.globalToken).toBeUndefined();
  });

  it('imports collection and environment directly to disk and validates with scanDirectory', async () => {
    const report = await importPostmanCollectionToDirectory({
      collectionJson: sampleCollection,
      environmentJson: sampleEnvironment,
      targetDir: tempDir,
    });

    expect(report.totalRequests).toBe(7);
    expect(report.totalFolders).toBe(2);
    expect(report.totalEnvironments).toBe(1);
    expect(report.totalSecrets).toBe(2);

    // Verify files on disk
    expect(fs.existsSync(path.join(tempDir, 'reqit.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'Auth', 'folder.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'Auth', 'Login Admin.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'Products', 'List Products.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'environments', 'Staging.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.reqit', 'secrets.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);

    const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
    expect(gitignoreContent).toContain('.reqit/');

    // Verify scanCollection recognizes the imported folder as a valid Reqit collection!
    const scanned = await scanCollection(tempDir);
    expect(scanned.collection.name).toBe('Sample E-Commerce API');
    expect(scanned.tree.length).toBe(4);
    expect(scanned.environments?.Staging).toBeDefined();
    const scannedStagingSecrets = scanned.secrets?.environments.Staging;
    expect(scannedStagingSecrets).toBeDefined();
    expect(scannedStagingSecrets?.adminPass).toBe('super-secret-password-123');
  });

  it('handles multi-root JSON (concatenated collection and environment) seamlessly', () => {
    // Exact scenario from user: collection JSON followed immediately by environment JSON or trailing content
    const multiRootInput = `${JSON.stringify(sampleCollection, null, 2)}\n${JSON.stringify(sampleEnvironment, null, 2)}`;
    const result = parsePostmanCollection(multiRootInput);

    expect(result.collection.name).toBe('Sample E-Commerce API');
    expect(result.items.length).toBe(4);
    // Embedded environment parsed and attached automatically
    expect(result.environments.length).toBe(1);
    expect(result.environments[0]?.name).toBe('Staging');
    expect(result.secrets?.environments?.Staging?.adminPass).toBe('super-secret-password-123');
  });

  it('handles markdown code blocks, comments, and trailing text without throwing', () => {
    const fencedWithComments = [
      '```json',
      '{',
      '  // Collection comment here',
      '  "info": {',
      '    "name": "Fenced API"',
      '  },',
      '  "item": [',
      '    {',
      '      "name": "Fenced Request",',
      '      "request": { "method": "GET", "url": "https://httpbin.org/get" }',
      '    }',
      '  ]',
      '}',
      '```',
      'Some trailing notes or export footer here...',
    ].join('\n');

    const result = parsePostmanCollection(fencedWithComments);
    expect(result.collection.name).toBe('Fenced API');
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.name).toBe('Fenced Request');
  });
});
