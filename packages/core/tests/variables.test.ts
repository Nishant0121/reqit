import { describe, expect, it } from 'vitest';
import type { EnvironmentFile, FolderFile, RequestFile, SecretsFile } from '../src/format/types.js';
import {
  applyFolderInheritance,
  getMergedVariables,
  resolve,
  resolveRequest,
  UndefinedVariableError,
  VariableCycleError,
  VariableResolutionError,
} from '../src/variables/index.js';

describe('Variable Resolution (Phase 2)', () => {
  describe('Scope Priority', () => {
    it('respects scope priority: collection < folder < environment < secrets < runtime', () => {
      const scopes = {
        collection: {
          v_col: 'from_col',
          v_override: 'col_val',
        },
        folder: {
          v_folder: 'from_folder',
          v_override: 'folder_val',
        },
        environment: {
          v_env: 'from_env',
          v_override: 'env_val',
        },
        secrets: {
          v_secret: 'from_secret',
          v_override: 'secret_val',
        },
        runtime: {
          v_runtime: 'from_runtime',
          v_override: 'runtime_val',
        },
      };

      // Each scope provides its own variable
      expect(resolve('{{v_col}}', scopes)).toBe('from_col');
      expect(resolve('{{v_folder}}', scopes)).toBe('from_folder');
      expect(resolve('{{v_env}}', scopes)).toBe('from_env');
      expect(resolve('{{v_secret}}', scopes)).toBe('from_secret');
      expect(resolve('{{v_runtime}}', scopes)).toBe('from_runtime');

      // Higher-priority scope overrides lower ones
      expect(resolve('{{v_override}}', scopes)).toBe('runtime_val');
    });

    it('allows secrets to override environment and folder when runtime is absent', () => {
      const scopes = {
        collection: { testVar: 'col' },
        folder: { testVar: 'folder' },
        environment: { testVar: 'env' },
        secrets: { testVar: 'secret' },
      };
      expect(resolve('{{testVar}}', scopes)).toBe('secret');
    });

    it('allows environment to override folder and collection', () => {
      const scopes = {
        collection: { testVar: 'col' },
        folder: { testVar: 'folder' },
        environment: { testVar: 'env' },
      };
      expect(resolve('{{testVar}}', scopes)).toBe('env');
    });

    it('allows folder to override collection', () => {
      const scopes = {
        collection: { testVar: 'col' },
        folder: { testVar: 'folder' },
      };
      expect(resolve('{{testVar}}', scopes)).toBe('folder');
    });

    it('works with array of scopes where later entries override earlier ones', () => {
      const scopes = [{ host: 'localhost', port: 3000 }, { port: 8080 }];
      expect(resolve('http://{{host}}:{{port}}', scopes)).toBe('http://localhost:8080');
    });

    it('works with flat dictionary', () => {
      expect(resolve('Hello {{name}}', { name: 'World' })).toBe('Hello World');
    });

    it('extracts variables from EnvironmentFile and SecretsFile objects', () => {
      const envFile: EnvironmentFile = {
        version: 1,
        name: 'staging',
        variables: {
          apiUrl: 'https://staging.api.com',
        },
      };

      const secretsFile: SecretsFile = {
        version: 1,
        environments: {
          dev: { apiKey: 'dev-secret' },
          staging: { apiKey: 'staging-secret' },
        },
      };

      const scopes = {
        environment: envFile,
        secrets: secretsFile,
      };

      const result = resolve('{{apiUrl}}?key={{apiKey}}', scopes, {
        activeEnvironment: 'staging',
      });
      expect(result).toBe('https://staging.api.com?key=staging-secret');
    });
  });

  describe('Nested Variables (Variables referencing other variables)', () => {
    it('resolves variables referencing other variables across multiple levels', () => {
      const scopes = {
        protocol: 'https',
        domain: 'example.com',
        port: 443,
        host: '{{domain}}:{{port}}',
        baseUrl: '{{protocol}}://{{host}}',
        apiUrl: '{{baseUrl}}/api/v1',
      };

      expect(resolve('{{apiUrl}}/users', scopes)).toBe('https://example.com:443/api/v1/users');
    });

    it('resolves nested variables across different scopes', () => {
      const scopes = {
        collection: { domain: 'reqit.dev' },
        environment: { baseUrl: 'https://{{domain}}/api' },
        secrets: { token: 'tok_123' },
        runtime: { authHeader: 'Bearer {{token}}' },
      };

      expect(resolve('{{baseUrl}} with {{authHeader}}', scopes)).toBe(
        'https://reqit.dev/api with Bearer tok_123',
      );
    });

    it('correctly handles non-cyclical multiple references to the same variable', () => {
      const scopes = {
        c: 'val',
        a: '{{c}}',
        b: '{{c}}',
      };
      expect(resolve('{{a}}-{{b}}', scopes)).toBe('val-val');
    });
  });

  describe('Cycle Detection', () => {
    it('detects direct self-reference cycles (a -> a)', () => {
      const scopes = { a: '{{a}}' };
      expect(() => resolve('{{a}}', scopes)).toThrow(VariableCycleError);

      try {
        resolve('{{a}}', scopes);
      } catch (err) {
        expect(err).toBeInstanceOf(VariableCycleError);
        const cycleErr = err as VariableCycleError;
        expect(cycleErr.chain).toEqual(['a', 'a']);
        expect(cycleErr.message).toContain('a -> a');
      }
    });

    it('detects mutual cycles (a -> b -> a) and reports the chain', () => {
      const scopes = {
        a: '{{b}}',
        b: '{{a}}',
      };

      expect(() => resolve('{{a}}', scopes)).toThrow(VariableCycleError);

      try {
        resolve('{{a}}', scopes);
      } catch (err) {
        expect(err).toBeInstanceOf(VariableCycleError);
        const cycleErr = err as VariableCycleError;
        expect(cycleErr.chain).toEqual(['a', 'b', 'a']);
        expect(cycleErr.message).toContain('a -> b -> a');
      }
    });

    it('detects multi-hop cycles (a -> b -> c -> a)', () => {
      const scopes = {
        a: '{{b}}',
        b: '{{c}}',
        c: '{{a}}',
      };

      try {
        resolve('{{a}}', scopes);
      } catch (err) {
        expect(err).toBeInstanceOf(VariableCycleError);
        const cycleErr = err as VariableCycleError;
        expect(cycleErr.chain).toEqual(['a', 'b', 'c', 'a']);
        expect(cycleErr.message).toContain('a -> b -> c -> a');
      }
    });

    it('isolates the cycle when cycle begins after root (x -> a -> b -> a)', () => {
      const scopes = {
        x: '{{a}}',
        a: '{{b}}',
        b: '{{a}}',
      };

      try {
        resolve('{{x}}', scopes);
      } catch (err) {
        expect(err).toBeInstanceOf(VariableCycleError);
        const cycleErr = err as VariableCycleError;
        expect(cycleErr.chain).toEqual(['a', 'b', 'a']);
        expect(cycleErr.message).toContain('a -> b -> a');
      }
    });
  });

  describe('Undefined Variables', () => {
    it('throws UndefinedVariableError naming the variable instead of returning empty string', () => {
      expect(() => resolve('{{missingVariable}}', {})).toThrow(UndefinedVariableError);

      try {
        resolve('{{missingVariable}}', {});
      } catch (err) {
        expect(err).toBeInstanceOf(UndefinedVariableError);
        const undefErr = err as UndefinedVariableError;
        expect(undefErr.variableName).toBe('missingVariable');
        expect(undefErr.message).toContain('missingVariable');
      }
    });

    it('throws if nested variable in reference chain is undefined', () => {
      const scopes = {
        baseUrl: 'http://{{host}}:8080',
      };

      try {
        resolve('{{baseUrl}}/users', scopes);
      } catch (err) {
        expect(err).toBeInstanceOf(UndefinedVariableError);
        const undefErr = err as UndefinedVariableError;
        expect(undefErr.variableName).toBe('host');
        expect(undefErr.message).toContain('host');
      }
    });

    it('throws VariableResolutionError on empty variable syntax {{}}', () => {
      expect(() => resolve('{{}}', {})).toThrow(VariableResolutionError);
      expect(() => resolve('{{   }}', {})).toThrow(VariableResolutionError);
    });
  });

  describe('Literal Escapes (\\{{)', () => {
    it('escapes literal {{ with backslash (\\{{)', () => {
      // \{{foo}} outputs {{foo}} without resolving or throwing undefined error
      expect(resolve('Hello \\{{name}}', {})).toBe('Hello {{name}}');
      expect(resolve('\\{{apiKey}} is secret', {})).toBe('{{apiKey}} is secret');
    });

    it('supports double backslash before {{ (\\\\{{var}})', () => {
      // \\{{var}} -> \ + resolved value
      expect(resolve('\\\\{{name}}', { name: 'World' })).toBe('\\World');
    });

    it('supports triple backslash (\\\\\\{{var}})', () => {
      // \\\{{var}} -> \ + {{var}}
      expect(resolve('\\\\\\{{name}}', {})).toBe('\\{{name}}');
    });

    it('handles mixed escaped and unescaped variables in one string', () => {
      const scopes = { user: 'Alice' };
      const template = 'User: {{user}}, Escaped: \\{{user}} and \\{{other}}';
      expect(resolve(template, scopes)).toBe('User: Alice, Escaped: {{user}} and {{other}}');
    });

    it('handles escaped braces inside variable definitions', () => {
      const scopes = {
        templatePattern: '\\{{unresolved}}',
      };
      expect(resolve('Pattern: {{templatePattern}}', scopes)).toBe('Pattern: {{unresolved}}');
    });

    it('unescapes standalone dangling \\{{', () => {
      expect(resolve('Unclosed \\{{ brace', {})).toBe('Unclosed {{ brace');
    });
  });

  describe('Variables Inside JSON Bodies and Headers', () => {
    it('substitutes variables inside JSON body string and parses valid JSON', () => {
      const scopes = {
        username: 'nishant',
        email: 'n@example.com',
        age: 28,
        isActive: true,
        score: 99.5,
      };

      const jsonTemplate = `
      {
        "name": "{{username}}",
        "email": "{{email}}",
        "age": {{age}},
        "active": {{isActive}},
        "score": {{score}}
      }
      `;

      const resolvedJson = resolve(jsonTemplate, scopes);
      const parsed = JSON.parse(resolvedJson);

      expect(parsed).toEqual({
        name: 'nishant',
        email: 'n@example.com',
        age: 28,
        active: true,
        score: 99.5,
      });
    });

    it('serializes object/array variables into JSON body', () => {
      const scopes = {
        userObject: { id: 'usr_1', role: 'admin' },
        tagsArray: ['fast', 'secure'],
      };

      const jsonTemplate = `{"user": {{userObject}}, "tags": {{tagsArray}}}`;
      const resolved = resolve(jsonTemplate, scopes);
      const parsed = JSON.parse(resolved);

      expect(parsed).toEqual({
        user: { id: 'usr_1', role: 'admin' },
        tags: ['fast', 'secure'],
      });
    });

    it('substitutes variables in headers table', () => {
      const scopes = {
        env: 'prod',
        token: 'secret-token-xyz',
        version: '1.2.3',
      };

      const headers = [
        { name: 'X-App-Env', value: '{{env}}', enabled: true },
        { name: 'Authorization', value: 'Bearer {{token}}', enabled: true },
        { name: 'X-Client-Version', value: 'v{{version}}', enabled: false },
      ];

      const resolved = headers.map(h => ({
        ...h,
        name: resolve(h.name, scopes),
        value: resolve(h.value, scopes),
      }));

      expect(resolved).toEqual([
        { name: 'X-App-Env', value: 'prod', enabled: true },
        { name: 'Authorization', value: 'Bearer secret-token-xyz', enabled: true },
        { name: 'X-Client-Version', value: 'v1.2.3', enabled: false },
      ]);
    });
  });

  describe('Folder Inheritance (applyFolderInheritance)', () => {
    it('inherits folder headers when request has no headers', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        headers: [
          { name: 'X-Folder', value: 'folder-val', enabled: true },
          { name: 'Accept', value: 'application/json', enabled: true },
        ],
      };

      const request: RequestFile = {
        version: 1,
        name: 'Get User',
        method: 'GET',
        url: 'https://api.com/users',
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.headers).toEqual([
        { name: 'X-Folder', value: 'folder-val', enabled: true },
        { name: 'Accept', value: 'application/json', enabled: true },
      ]);
    });

    it('allows request headers to win over folder headers (case-insensitive)', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        headers: [
          { name: 'X-Team', value: 'backend', enabled: true },
          { name: 'Content-Type', value: 'application/json', enabled: true },
        ],
      };

      const request: RequestFile = {
        version: 1,
        name: 'Create User',
        method: 'POST',
        url: 'https://api.com/users',
        headers: [
          // Lowercase content-type overrides Folder's Content-Type
          { name: 'content-type', value: 'application/xml', enabled: true },
          { name: 'X-Request-Id', value: 'req-123', enabled: true },
        ],
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.headers).toEqual([
        { name: 'X-Team', value: 'backend', enabled: true },
        { name: 'content-type', value: 'application/xml', enabled: true },
        { name: 'X-Request-Id', value: 'req-123', enabled: true },
      ]);
    });

    it('preserves request disabled header override over folder enabled header', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        headers: [{ name: 'Authorization', value: 'Bearer folder-tok', enabled: true }],
      };

      const request: RequestFile = {
        version: 1,
        name: 'Public Endpoint',
        method: 'GET',
        url: 'https://api.com/public',
        headers: [{ name: 'Authorization', value: 'Bearer folder-tok', enabled: false }],
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.headers).toEqual([
        { name: 'Authorization', value: 'Bearer folder-tok', enabled: false },
      ]);
    });

    it('inherits folder auth when request auth is undefined', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        auth: { type: 'bearer', token: 'folder-token' },
      };

      const request: RequestFile = {
        version: 1,
        name: 'Get User',
        method: 'GET',
        url: 'https://api.com/users',
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.auth).toEqual({ type: 'bearer', token: 'folder-token' });
    });

    it('inherits folder auth when request auth has type: inherit', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        auth: { type: 'bearer', token: 'folder-token' },
      };

      const request: RequestFile = {
        version: 1,
        name: 'Get User',
        method: 'GET',
        url: 'https://api.com/users',
        auth: { type: 'inherit' },
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.auth).toEqual({ type: 'bearer', token: 'folder-token' });
    });

    it('lets request auth win when request specifies its own auth', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        auth: { type: 'bearer', token: 'folder-token' },
      };

      const request: RequestFile = {
        version: 1,
        name: 'Login',
        method: 'POST',
        url: 'https://api.com/login',
        auth: { type: 'basic', username: 'admin', password: 'secret' },
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.auth).toEqual({
        type: 'basic',
        username: 'admin',
        password: 'secret',
      });
    });

    it('lets request auth: none win over folder auth', () => {
      const folder: FolderFile = {
        version: 1,
        name: 'Users',
        auth: { type: 'bearer', token: 'folder-token' },
      };

      const request: RequestFile = {
        version: 1,
        name: 'Public',
        method: 'GET',
        url: 'https://api.com/public',
        auth: { type: 'none' },
      };

      const inherited = applyFolderInheritance(request, folder);
      expect(inherited.auth).toEqual({ type: 'none' });
    });

    it('handles multi-level folder hierarchy (root to leaf)', () => {
      const rootFolder: FolderFile = {
        version: 1,
        name: 'API',
        headers: [
          { name: 'X-Root', value: 'root-val', enabled: true },
          { name: 'X-Common', value: 'root-common', enabled: true },
        ],
        auth: { type: 'bearer', token: 'root-token' },
      };

      const subFolder: FolderFile = {
        version: 1,
        name: 'Auth',
        headers: [
          { name: 'X-Common', value: 'sub-common', enabled: true },
          { name: 'X-Sub', value: 'sub-val', enabled: true },
        ],
        // subFolder overrides auth
        auth: { type: 'bearer', token: 'sub-token' },
      };

      const request: RequestFile = {
        version: 1,
        name: 'Get Me',
        method: 'GET',
        url: 'https://api.com/me',
        headers: [
          { name: 'X-Sub', value: 'req-sub', enabled: true },
          { name: 'X-Req', value: 'req-val', enabled: true },
        ],
      };

      const inherited = applyFolderInheritance(request, [rootFolder, subFolder]);

      expect(inherited.headers).toEqual([
        { name: 'X-Root', value: 'root-val', enabled: true },
        { name: 'X-Common', value: 'sub-common', enabled: true },
        { name: 'X-Sub', value: 'req-sub', enabled: true },
        { name: 'X-Req', value: 'req-val', enabled: true },
      ]);
      expect(inherited.auth).toEqual({ type: 'bearer', token: 'sub-token' });
    });
  });

  describe('Full Request Resolution (resolveRequest)', () => {
    it('resolves URL, params, headers, auth, and body across all scopes', () => {
      const scopes = {
        collection: {
          baseUrl: 'https://api.example.com',
          apiVersion: 'v2',
        },
        folder: {
          folderHeaderVal: 'fh_123',
        },
        environment: {
          envPrefix: 'prod',
          userId: 'user_42',
        },
        secrets: {
          authToken: 'sec_bearer_token',
        },
        runtime: {
          customQuery: 'active_only',
        },
      };

      const folder: FolderFile = {
        version: 1,
        name: 'User Management',
        headers: [{ name: 'X-Folder-Ref', value: '{{folderHeaderVal}}', enabled: true }],
        auth: { type: 'bearer', token: '{{authToken}}' },
      };

      const rawRequest: RequestFile = {
        version: 1,
        name: 'Create User Profile',
        method: 'POST',
        url: '{{baseUrl}}/{{apiVersion}}/users/{{userId}}',
        params: [
          { name: 'filter', value: '{{customQuery}}', enabled: true },
          { name: 'skip', value: '0', enabled: false },
        ],
        headers: [
          { name: 'Content-Type', value: 'application/json', enabled: true },
          { name: 'X-Env', value: '{{envPrefix}}', enabled: true },
        ],
        // Auth is not specified in request -> will inherit from folder
        body: {
          type: 'json',
          content: '{\n  "id": "{{userId}}",\n  "env": "{{envPrefix}}"\n}',
        },
      };

      const resolved = resolveRequest(rawRequest, scopes, { folder });

      // 1. URL resolved
      expect(resolved.url).toBe('https://api.example.com/v2/users/user_42');

      // 2. Params resolved
      expect(resolved.params).toEqual([
        { name: 'filter', value: 'active_only', enabled: true },
        { name: 'skip', value: '0', enabled: false },
      ]);

      // 3. Headers inherited from folder AND resolved
      expect(resolved.headers).toEqual([
        { name: 'X-Folder-Ref', value: 'fh_123', enabled: true },
        { name: 'Content-Type', value: 'application/json', enabled: true },
        { name: 'X-Env', value: 'prod', enabled: true },
      ]);

      // 4. Auth inherited from folder AND resolved
      expect(resolved.auth).toEqual({
        type: 'bearer',
        token: 'sec_bearer_token',
      });

      // 5. Body resolved
      expect(resolved.body).toEqual({
        type: 'json',
        content: '{\n  "id": "user_42",\n  "env": "prod"\n}',
      });

      // 6. Original request is NOT mutated
      expect(rawRequest.url).toBe('{{baseUrl}}/{{apiVersion}}/users/{{userId}}');
      expect(rawRequest.auth).toBeUndefined();
    });

    it('resolves basic and apikey auth types', () => {
      const scopes = {
        username: 'bob',
        password: 'password123',
        keyName: 'X-API-KEY',
        keyValue: 'my-key',
      };

      const basicReq: RequestFile = {
        version: 1,
        name: 'Basic Auth Req',
        method: 'GET',
        url: 'https://api.com',
        auth: {
          type: 'basic',
          username: '{{username}}',
          password: '{{password}}',
        },
      };

      const resolvedBasic = resolveRequest(basicReq, scopes);
      expect(resolvedBasic.auth).toEqual({
        type: 'basic',
        username: 'bob',
        password: 'password123',
      });

      const apiKeyReq: RequestFile = {
        version: 1,
        name: 'ApiKey Auth Req',
        method: 'GET',
        url: 'https://api.com',
        auth: {
          type: 'apikey',
          key: '{{keyName}}',
          value: '{{keyValue}}',
          in: 'header',
        },
      };

      const resolvedApiKey = resolveRequest(apiKeyReq, scopes);
      expect(resolvedApiKey.auth).toEqual({
        type: 'apikey',
        key: 'X-API-KEY',
        value: 'my-key',
        in: 'header',
      });
    });

    it('resolves form-urlencoded and multipart bodies', () => {
      const scopes = {
        userField: 'username',
        userValue: 'alice',
      };

      const formReq: RequestFile = {
        version: 1,
        name: 'Form Req',
        method: 'POST',
        url: 'https://api.com/form',
        body: {
          type: 'form',
          form: [
            { name: '{{userField}}', value: '{{userValue}}', enabled: true },
            { name: 'grant_type', value: 'password', enabled: true },
          ],
        },
      };

      const resolved = resolveRequest(formReq, scopes);
      expect(resolved.body).toEqual({
        type: 'form',
        form: [
          { name: 'username', value: 'alice', enabled: true },
          { name: 'grant_type', value: 'password', enabled: true },
        ],
      });
    });

    it('attaches requestName and field to UndefinedVariableError when resolving request', () => {
      const request: RequestFile = {
        version: 1,
        name: 'Get Account',
        method: 'GET',
        url: 'https://api.com/accounts/{{accountId}}',
      };

      try {
        resolveRequest(request, {});
      } catch (err) {
        expect(err).toBeInstanceOf(UndefinedVariableError);
        const undefErr = err as UndefinedVariableError;
        expect(undefErr.variableName).toBe('accountId');
        expect(undefErr.requestName).toBe('Get Account');
        expect(undefErr.field).toBe('url');
        expect(undefErr.message).toContain('Get Account');
        expect(undefErr.message).toContain('accountId');
      }
    });

    it('preserves scripts, tests, and unknown fields without resolving them', () => {
      const request: RequestFile = {
        version: 1,
        name: 'Script Request',
        method: 'GET',
        url: 'https://api.com',
        scripts: {
          pre: 'console.log("{{not_a_variable}}")',
          post: 'reqit.setVar("id", 1)',
        },
        tests: [{ name: 'Status is 200', assert: 'res.status === 200' }],
        docs: 'Documentation with {{variable_example}}',
        customField: 'preserved-value',
      };

      const resolved = resolveRequest(request, {});
      expect(resolved.scripts).toEqual(request.scripts);
      expect(resolved.tests).toEqual(request.tests);
      expect(resolved.docs).toBe(request.docs);
      expect(resolved.customField).toBe('preserved-value');
    });
  });

  describe('getMergedVariables inspection helper', () => {
    it('returns a map of all variables with their source scopes', () => {
      const scopes = {
        collection: { baseUrl: 'https://api.com', timeout: 5000 },
        folder: { folderName: 'users' },
        environment: { baseUrl: 'https://dev.api.com' },
        secrets: { apiKey: 'secret-123' },
        runtime: { activeUserId: 'usr-999' },
      };

      const merged = getMergedVariables(scopes);

      expect(merged.get('baseUrl')).toEqual({
        name: 'baseUrl',
        value: 'https://dev.api.com',
        scope: 'environment',
      });
      expect(merged.get('timeout')).toEqual({
        name: 'timeout',
        value: 5000,
        scope: 'collection',
      });
      expect(merged.get('folderName')).toEqual({
        name: 'folderName',
        value: 'users',
        scope: 'folder',
      });
      expect(merged.get('apiKey')).toEqual({
        name: 'apiKey',
        value: 'secret-123',
        scope: 'secrets',
      });
      expect(merged.get('activeUserId')).toEqual({
        name: 'activeUserId',
        value: 'usr-999',
        scope: 'runtime',
      });
    });
  });
});
