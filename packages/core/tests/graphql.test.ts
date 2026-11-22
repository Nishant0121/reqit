import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  INTROSPECTION_QUERY,
  parseIntrospectionResponse,
  formatTypeRef,
  getGraphQLCompletions,
  formatGraphQLQuery,
  type GraphQLSchemaSummary,
  type RequestFile,
  serializeRequest,
  parseRequest,
  generateCurl,
  generateSnippet,
  prepareRequestBody,
  sendRequest,
} from '../src/index.js';

describe('Phase 24: GraphQL Support', () => {
  const mockIntrospectionData = {
    data: {
      __schema: {
        queryType: { name: 'Query' },
        mutationType: { name: 'Mutation' },
        subscriptionType: { name: 'Subscription' },
        types: [
          {
            kind: 'OBJECT',
            name: 'Query',
            description: 'Root Query type',
            fields: [
              {
                name: 'user',
                description: 'Get user by id',
                type: {
                  kind: 'OBJECT',
                  name: 'User',
                },
                args: [
                  {
                    name: 'id',
                    description: 'User ID',
                    type: {
                      kind: 'NON_NULL',
                      ofType: { kind: 'SCALAR', name: 'ID' },
                    },
                    defaultValue: null,
                  },
                ],
              },
              {
                name: 'users',
                description: 'List all users',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'LIST',
                    ofType: {
                      kind: 'NON_NULL',
                      ofType: { kind: 'OBJECT', name: 'User' },
                    },
                  },
                },
                args: [],
              },
            ],
          },
          {
            kind: 'OBJECT',
            name: 'Mutation',
            description: 'Root Mutation type',
            fields: [
              {
                name: 'createUser',
                description: 'Create a new user',
                type: { kind: 'OBJECT', name: 'User' },
                args: [
                  {
                    name: 'name',
                    type: {
                      kind: 'NON_NULL',
                      ofType: { kind: 'SCALAR', name: 'String' },
                    },
                  },
                ],
              },
            ],
          },
          {
            kind: 'OBJECT',
            name: 'User',
            description: 'User entity',
            fields: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: { kind: 'SCALAR', name: 'ID' },
                },
                args: [],
              },
              {
                name: 'name',
                type: {
                  kind: 'NON_NULL',
                  ofType: { kind: 'SCALAR', name: 'String' },
                },
                args: [],
              },
              {
                name: 'email',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                },
                args: [],
              },
              {
                name: 'role',
                type: {
                  kind: 'ENUM',
                  name: 'Role',
                },
                args: [],
              },
            ],
          },
          {
            kind: 'ENUM',
            name: 'Role',
            description: 'User roles',
            enumValues: [
              { name: 'ADMIN', description: 'Administrator' },
              { name: 'USER', description: 'Standard user' },
            ],
          },
        ],
      },
    },
  };

  describe('1. Introspection & Schema Parsing', () => {
    it('has valid INTROSPECTION_QUERY string', () => {
      expect(INTROSPECTION_QUERY).toContain('query IntrospectionQuery');
      expect(INTROSPECTION_QUERY).toContain('__schema');
    });

    it('formats complex type references cleanly', () => {
      const nonNullListNonNull = formatTypeRef({
        kind: 'NON_NULL',
        ofType: {
          kind: 'LIST',
          ofType: {
            kind: 'NON_NULL',
            ofType: { kind: 'OBJECT', name: 'User' },
          },
        },
      });
      expect(nonNullListNonNull.formatted).toBe('[User!]!');
      expect(nonNullListNonNull.baseName).toBe('User');
      expect(nonNullListNonNull.isList).toBe(true);
      expect(nonNullListNonNull.isRequired).toBe(true);

      const simpleScalar = formatTypeRef({ kind: 'SCALAR', name: 'String' });
      expect(simpleScalar.formatted).toBe('String');
      expect(simpleScalar.baseName).toBe('String');
      expect(simpleScalar.isList).toBe(false);
      expect(simpleScalar.isRequired).toBe(false);
    });

    it('parses raw introspection JSON into structured GraphQLSchemaSummary', () => {
      const summary = parseIntrospectionResponse(mockIntrospectionData);
      expect(summary.queryType).toBe('Query');
      expect(summary.mutationType).toBe('Mutation');
      expect(summary.queries.length).toBe(2);
      expect(summary.queries[0]?.name).toBe('user');
      expect(summary.queries[0]?.type).toBe('User');
      expect(summary.queries[0]?.args[0]?.name).toBe('id');
      expect(summary.queries[0]?.args[0]?.type).toBe('ID!');
      expect(summary.queries[1]?.name).toBe('users');
      expect(summary.queries[1]?.type).toBe('[User!]!');

      expect(summary.mutations.length).toBe(1);
      expect(summary.mutations[0]?.name).toBe('createUser');

      const userType = summary.types['User'];
      expect(userType).toBeDefined();
      expect(userType?.fields?.length).toBe(4);
      expect(userType?.fields?.map(f => f.name)).toEqual(['id', 'name', 'email', 'role']);

      expect(summary.enums['Role']).toBeDefined();
      expect(summary.enums['Role']?.map(e => e.name)).toEqual(['ADMIN', 'USER']);
    });

    it('throws error when introspection response is invalid or contains errors', () => {
      expect(() => parseIntrospectionResponse(null)).toThrow('expected an object');
      expect(() => parseIntrospectionResponse({ errors: [{ message: 'Forbidden' }] })).toThrow(
        'GraphQL introspection failed: Forbidden',
      );
      expect(() => parseIntrospectionResponse({ foo: 'bar' })).toThrow('__schema field not found');
    });
  });

  describe('2. Autocomplete Engine', () => {
    let schema: GraphQLSchemaSummary;

    beforeAll(() => {
      schema = parseIntrospectionResponse(mockIntrospectionData);
    });

    it('suggests root operations when query is empty or at top-level', () => {
      const completions = getGraphQLCompletions('', 0, schema);
      const labels = completions.map(c => c.label);
      expect(labels).toContain('query');
      expect(labels).toContain('mutation');
      expect(labels).toContain('subscription');
    });

    it('suggests root query fields inside query { ... }', () => {
      const query = 'query {\n  \n}';
      const offset = 10; // between { and }
      const completions = getGraphQLCompletions(query, offset, schema);
      const labels = completions.map(c => c.label);
      expect(labels).toContain('user');
      expect(labels).toContain('users');
    });

    it('suggests arguments when cursor is inside ( ... )', () => {
      const query = 'query {\n  user(\n}\n';
      const offset = query.indexOf('(') + 1;
      const completions = getGraphQLCompletions(query, offset, schema);
      const labels = completions.map(c => c.label);
      expect(labels).toContain('id');
      const idArg = completions.find(c => c.label === 'id');
      expect(idArg?.detail).toBe('ID!');
    });

    it('suggests nested object fields inside user { ... }', () => {
      const query = 'query {\n  user(id: "1") {\n    \n  }\n}';
      const offset = query.indexOf('{\n    ') + 6;
      const completions = getGraphQLCompletions(query, offset, schema);
      const labels = completions.map(c => c.label);
      expect(labels).toContain('id');
      expect(labels).toContain('name');
      expect(labels).toContain('email');
      expect(labels).toContain('role');
    });
  });

  describe('3. Query Prettification / Formatting', () => {
    it('formats unindented GraphQL queries into 2-space indented blocks', () => {
      const ugly = 'query GetUser{user(id:"1"){id name email}}';
      const pretty = formatGraphQLQuery(ugly);
      expect(pretty).toContain('query GetUser {\n');
      expect(pretty).toContain('  user(id: "1") {\n');
      expect(pretty).toContain('    id\n');
      expect(pretty).toContain('    name\n');
      expect(pretty).toContain('    email\n');
      expect(pretty).toContain('  }\n');
      expect(pretty.trim().endsWith('}')).toBe(true);
    });
  });

  describe('4. Format & YAML Serialization', () => {
    it('serializes and parses GraphQL request with query and variables', () => {
      const req: RequestFile = {
        version: 1,
        name: 'Get User GraphQL',
        method: 'POST',
        url: 'https://api.example.com/graphql',
        body: {
          type: 'graphql',
          content: 'query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n  }\n}',
          variables: '{\n  "id": "123"\n}',
        },
      };

      const yaml = serializeRequest(req);
      expect(yaml).toContain('type: graphql');
      expect(yaml).toContain('content: |');
      expect(yaml).toContain('query GetUser($id: ID!)');
      expect(yaml).toContain('variables: |');
      expect(yaml).toContain('"id": "123"');

      const parsed = parseRequest(yaml, 'get-user.yaml');
      expect(parsed.body?.type).toBe('graphql');
      expect(parsed.body?.content).toContain('query GetUser');
      expect(parsed.body?.variables).toContain('"id": "123"');
    });
  });

  describe('5. cURL Export & Code Snippets', () => {
    const req: RequestFile = {
      version: 1,
      name: 'GraphQL Sample',
      method: 'POST',
      url: 'https://api.example.com/graphql',
      body: {
        type: 'graphql',
        content: 'query { users { id name } }',
        variables: '{"limit": 10}',
      },
    };

    it('generates cURL with Content-Type application/json and {query, variables} payload', () => {
      const curl = generateCurl(req);
      expect(curl).toContain("curl -X POST 'https://api.example.com/graphql'");
      expect(curl).toContain("-H 'Content-Type: application/json'");
      expect(curl).toContain(
        '-d \'{"query":"query { users { id name } }","variables":{"limit":10}}\'',
      );
    });

    it('generates fetch snippet for GraphQL request', () => {
      const snippet = generateSnippet(req, 'fetch');
      expect(snippet).toContain("'Content-Type': 'application/json'");
      expect(snippet).toContain('"query": "query { users { id name } }"');
      expect(snippet).toContain('"limit": 10');
    });

    it('generates python snippet for GraphQL request', () => {
      const snippet = generateSnippet(req, 'python');
      expect(snippet).toContain('"Content-Type": "application/json"');
      expect(snippet).toContain('payload = {');
      expect(snippet).toContain('"query"');
    });
  });

  describe('6. Engine Request Preparation', () => {
    it('prepares JSON buffer with { query, variables } and application/json Content-Type', () => {
      const prepared = prepareRequestBody({
        type: 'graphql',
        content: 'query { me { id } }',
        variables: '{"test": true}',
      });

      expect(prepared.defaultContentType).toBe('application/json; charset=utf-8');
      expect(prepared.buffer).toBeDefined();

      const decoded = JSON.parse(prepared.buffer!.toString('utf-8'));
      expect(decoded.query).toBe('query { me { id } }');
      expect(decoded.variables).toEqual({ test: true });
    });
  });

  describe('7. End-to-End: Local GraphQL Mock Server Introspection & Execution', () => {
    let server: http.Server;
    let serverUrl: string;

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');

          let parsedBody: Record<string, unknown> = {};
          try {
            parsedBody = JSON.parse(body);
          } catch {
            // ignore
          }

          const query = String(parsedBody.query || '');

          // If introspection query
          if (query.includes('__schema')) {
            res.writeHead(200);
            res.end(JSON.stringify(mockIntrospectionData));
            return;
          }

          // If normal query
          if (query.includes('user')) {
            res.writeHead(200);
            res.end(
              JSON.stringify({
                data: {
                  user: {
                    id: '1',
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    role: 'ADMIN',
                  },
                },
              }),
            );
            return;
          }

          res.writeHead(400);
          res.end(JSON.stringify({ errors: [{ message: 'Unsupported query' }] }));
        });
      });

      await new Promise<void>(resolve => {
        server.listen(0, '127.0.0.1', () => resolve());
      });

      const addr = server.address() as AddressInfo;
      serverUrl = `http://127.0.0.1:${addr.port}/graphql`;
    });

    afterAll(async () => {
      await new Promise<void>(resolve => server.close(() => resolve()));
    });

    it('introspects live GraphQL server, parses schema, and runs query with autocomplete', async () => {
      // 1. Introspect via sendRequest
      const introspectReq: RequestFile = {
        version: 1,
        name: 'Introspect',
        method: 'POST',
        url: serverUrl,
        headers: [{ name: 'Content-Type', value: 'application/json', enabled: true }],
        body: {
          type: 'json',
          content: JSON.stringify({ query: INTROSPECTION_QUERY }),
        },
      };

      const introRes = await sendRequest(introspectReq);
      expect(introRes.status).toBe(200);
      expect(introRes.body).toBeDefined();

      const liveSchema = parseIntrospectionResponse(JSON.parse(introRes.body!));
      expect(liveSchema.queryType).toBe('Query');
      expect(liveSchema.queries.some(q => q.name === 'user')).toBe(true);

      // 2. Autocomplete suggestions using introspected schema
      const completions = getGraphQLCompletions('query { ', 8, liveSchema);
      expect(completions.some(c => c.label === 'user')).toBe(true);

      // 3. Run live GraphQL query with variables
      const queryReq: RequestFile = {
        version: 1,
        name: 'Get User Live',
        method: 'POST',
        url: serverUrl,
        body: {
          type: 'graphql',
          content: 'query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n  }\n}',
          variables: '{"id": "1"}',
        },
      };

      const queryRes = await sendRequest(queryReq);
      expect(queryRes.status).toBe(200);
      const resJson = JSON.parse(queryRes.body!);
      expect(resJson.data?.user?.name).toBe('Ada Lovelace');
      expect(resJson.data?.user?.id).toBe('1');
    });
  });
});
