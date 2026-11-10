import { describe, it, expect } from 'vitest';
import type { RequestFile } from '../src/format/types.js';
import { generateSnippet, getSnippetTargets, type SnippetTarget } from '../src/snippets/index.js';

describe('Code Snippet Generation (Phase 19)', () => {
  const baseGetRequest: RequestFile = {
    version: 1,
    name: 'Get Users',
    method: 'GET',
    url: 'https://httpbin.org/get',
    params: [
      { name: 'page', value: '1', enabled: true },
      { name: 'limit', value: '25', enabled: true },
      { name: 'disabled_filter', value: 'test', enabled: false },
    ],
    headers: [
      { name: 'Accept', value: 'application/json', enabled: true },
      { name: 'X-Debug', value: 'true', enabled: false },
    ],
  };

  const basePostRequest: RequestFile = {
    version: 1,
    name: 'Create Item',
    method: 'POST',
    url: 'https://httpbin.org/post',
    headers: [{ name: 'User-Agent', value: 'ReqitTest/1.0', enabled: true }],
    auth: {
      type: 'bearer',
      token: 'secret_token_123',
    },
    body: {
      type: 'json',
      content: JSON.stringify({
        title: 'New Product',
        active: true,
        count: 10,
        tags: ['sale', 'popular'],
        meta: null,
      }),
    },
  };

  describe('Target Registry', () => {
    it('returns all 7 supported targets with metadata', () => {
      const targets = getSnippetTargets();
      expect(targets).toHaveLength(7);

      const targetIds = targets.map(t => t.id);
      expect(targetIds).toEqual(['curl', 'fetch', 'axios', 'python', 'node-http', 'go', 'java']);
    });
  });

  describe('cURL Generator', () => {
    it('generates multi-line curl with query params and headers', () => {
      const snippet = generateSnippet(baseGetRequest, 'curl');
      expect(snippet).toContain("curl 'https://httpbin.org/get?page=1&limit=25'");
      expect(snippet).toContain("-H 'Accept: application/json'");
      expect(snippet).not.toContain('disabled_filter');
      expect(snippet).not.toContain('X-Debug');
    });

    it('includes auth and json body', () => {
      const snippet = generateSnippet(basePostRequest, 'curl');
      expect(snippet).toContain('-X POST');
      expect(snippet).toContain("-H 'Authorization: Bearer secret_token_123'");
      expect(snippet).toContain("-H 'Content-Type: application/json'");
      expect(snippet).toContain('New Product');
    });
  });

  describe('JavaScript Fetch Generator', () => {
    it('does not duplicate query params when URL already contains them', () => {
      const duplicateProneReq: RequestFile = {
        version: 1,
        name: 'Get user',
        method: 'GET',
        url: 'https://httpbin.org/get?user=32',
        params: [{ name: 'user', value: '32', enabled: true }],
      };

      const snippet = generateSnippet(duplicateProneReq, 'fetch');
      expect(snippet).toContain("fetch('https://httpbin.org/get?user=32')");
      expect(snippet).not.toContain('user=32&user=32');
    });

    it('generates concise fetch call for GET', () => {
      const snippet = generateSnippet(baseGetRequest, 'fetch');
      expect(snippet).toContain("fetch('https://httpbin.org/get?page=1&limit=25'");
      expect(snippet).toContain("'Accept': 'application/json'");
      expect(snippet).toContain('const data = await response.json();');
    });

    it('generates fetch call with formatted JSON body and headers', () => {
      const snippet = generateSnippet(basePostRequest, 'fetch');
      expect(snippet).toContain("method: 'POST'");
      expect(snippet).toContain("'Authorization': 'Bearer secret_token_123'");
      expect(snippet).toContain("'Content-Type': 'application/json'");
      expect(snippet).toContain('body: JSON.stringify({');
      expect(snippet).toContain('"title": "New Product"');
    });

    it('handles Form URL-encoded body using URLSearchParams', () => {
      const formReq: RequestFile = {
        version: 1,
        name: 'Form submit',
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: {
          type: 'form',
          form: [
            { name: 'username', value: 'alice', enabled: true },
            { name: 'code', value: '42', enabled: true },
            { name: 'skip', value: 'no', enabled: false },
          ],
        },
      };

      const snippet = generateSnippet(formReq, 'fetch');
      expect(snippet).toContain('const params = new URLSearchParams();');
      expect(snippet).toContain("params.append('username', 'alice');");
      expect(snippet).toContain("params.append('code', '42');");
      expect(snippet).not.toContain('skip');
      expect(snippet).toContain('body: params');
    });

    it('handles Multipart Form body using FormData', () => {
      const multipartReq: RequestFile = {
        version: 1,
        name: 'Upload',
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: {
          type: 'multipart',
          form: [
            { name: 'caption', value: 'My file', enabled: true },
            { name: 'avatar', value: 'pic.png', isFile: true, enabled: true },
          ],
        },
      };

      const snippet = generateSnippet(multipartReq, 'fetch');
      expect(snippet).toContain('const formData = new FormData();');
      expect(snippet).toContain("formData.append('caption', 'My file');");
      expect(snippet).toContain('formData.append');
      expect(snippet).toContain('body: formData');
    });
  });

  describe('JavaScript Axios Generator', () => {
    it('generates axios request config with headers and URL', () => {
      const snippet = generateSnippet(baseGetRequest, 'axios');
      expect(snippet).toContain("import axios from 'axios';");
      expect(snippet).toContain("method: 'GET'");
      expect(snippet).toContain("url: 'https://httpbin.org/get?page=1&limit=25'");
      expect(snippet).toContain("'Accept': 'application/json'");
      expect(snippet).toContain('console.log(response.data);');
    });

    it('passes JSON body cleanly under data key', () => {
      const snippet = generateSnippet(basePostRequest, 'axios');
      expect(snippet).toContain("method: 'POST'");
      expect(snippet).toContain('data: {');
      expect(snippet).toContain('"title": "New Product"');
    });
  });

  describe('Python Requests Generator', () => {
    it('generates python requests call with headers and query params', () => {
      const snippet = generateSnippet(baseGetRequest, 'python');
      expect(snippet).toContain('import requests');
      expect(snippet).toContain('url = "https://httpbin.org/get?page=1&limit=25"');
      expect(snippet).toContain('"Accept": "application/json"');
      expect(snippet).toContain('response = requests.get(url, headers=headers)');
    });

    it('correctly converts JSON primitives (true -> True, false -> False, null -> None)', () => {
      const snippet = generateSnippet(basePostRequest, 'python');
      expect(snippet).toContain('payload = {');
      expect(snippet).toContain('"title": "New Product"');
      expect(snippet).toContain('"active": True');
      expect(snippet).toContain('"meta": None');
      expect(snippet).toContain('response = requests.post(url, headers=headers, json=payload)');
    });

    it('handles Basic Auth in python', () => {
      const basicReq: RequestFile = {
        version: 1,
        name: 'Basic Auth',
        method: 'GET',
        url: 'https://httpbin.org/basic-auth/user/passwd',
        auth: {
          type: 'basic',
          username: 'user',
          password: 'secret_password',
        },
      };

      const snippet = generateSnippet(basicReq, 'python');
      expect(snippet).toContain('Authorization');
    });
  });

  describe('Node.js Native HTTP Generator', () => {
    it('uses https module for https URLs and parses hostname/path', () => {
      const snippet = generateSnippet(baseGetRequest, 'node-http');
      expect(snippet).toContain("const https = require('https');");
      expect(snippet).toContain("hostname: 'httpbin.org'");
      expect(snippet).toContain("path: '/get?page=1&limit=25'");
      expect(snippet).toContain("method: 'GET'");
      expect(snippet).toContain('https.request(options');
      expect(snippet).toContain('req.end();');
    });

    it('uses http module for plain http URLs and computes Buffer byteLength', () => {
      const httpPostReq: RequestFile = {
        ...basePostRequest,
        url: 'http://localhost:8080/api/items',
      };

      const snippet = generateSnippet(httpPostReq, 'node-http');
      expect(snippet).toContain("const http = require('http');");
      expect(snippet).toContain("hostname: 'localhost'");
      expect(snippet).toContain('port: 8080');
      expect(snippet).toContain("'Content-Length': Buffer.byteLength(postData)");
      expect(snippet).toContain('req.write(postData);');
    });
  });

  describe('Go Generator', () => {
    it('generates standard library Go code with net/http', () => {
      const snippet = generateSnippet(baseGetRequest, 'go');
      expect(snippet).toContain('package main');
      expect(snippet).toContain('"net/http"');
      expect(snippet).toContain('url := "https://httpbin.org/get?page=1&limit=25"');
      expect(snippet).toContain('req, err := http.NewRequest("GET", url, nil)');
      expect(snippet).toContain('req.Header.Set("Accept", "application/json")');
      expect(snippet).toContain('resp, err := client.Do(req)');
    });

    it('includes bytes.NewBuffer for JSON body in Go', () => {
      const snippet = generateSnippet(basePostRequest, 'go');
      expect(snippet).toContain('"bytes"');
      expect(snippet).toContain('payload := []byte(');
      expect(snippet).toContain(
        'req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))',
      );
      expect(snippet).toContain('req.Header.Set("Content-Type", "application/json")');
      expect(snippet).toContain('req.Header.Set("Authorization", "Bearer secret_token_123")');
    });
  });

  describe('Java Generator', () => {
    it('generates modern Java 11+ HttpClient snippet', () => {
      const snippet = generateSnippet(baseGetRequest, 'java');
      expect(snippet).toContain('import java.net.http.HttpClient;');
      expect(snippet).toContain('import java.net.http.HttpRequest;');
      expect(snippet).toContain('HttpClient client = HttpClient.newHttpClient();');
      expect(snippet).toContain('.uri(URI.create("https://httpbin.org/get?page=1&limit=25"))');
      expect(snippet).toContain('.header("Accept", "application/json")');
      expect(snippet).toContain('.GET()');
      expect(snippet).toContain('client.send(request, HttpResponse.BodyHandlers.ofString())');
    });

    it('includes BodyPublishers.ofString for POST', () => {
      const snippet = generateSnippet(basePostRequest, 'java');
      expect(snippet).toContain('.POST(HttpRequest.BodyPublishers.ofString(');
      expect(snippet).toContain('.header("Content-Type", "application/json")');
      expect(snippet).toContain('.header("Authorization", "Bearer secret_token_123")');
    });
  });

  describe('Variable Resolution Options', () => {
    const templatedRequest: RequestFile = {
      version: 1,
      name: 'Templated Request',
      method: 'POST',
      url: '{{baseUrl}}/v1/users',
      headers: [{ name: 'Authorization', value: 'Bearer {{apiKey}}', enabled: true }],
      params: [{ name: 'org', value: '{{orgId}}', enabled: true }],
      body: {
        type: 'json',
        content: JSON.stringify({ userId: '{{targetId}}' }),
      },
    };

    const scopes = {
      environment: {
        baseUrl: 'https://api.mycompany.com',
        apiKey: 'real_key_xyz',
        orgId: 'org_999',
        targetId: 'user_456',
      },
    };

    it('resolves {{variables}} when resolveVariables is true (default)', () => {
      const targets: SnippetTarget[] = [
        'curl',
        'fetch',
        'axios',
        'python',
        'node-http',
        'go',
        'java',
      ];

      for (const target of targets) {
        const snippet = generateSnippet(templatedRequest, target, {
          resolveVariables: true,
          scopes,
        });
        if (target === 'node-http') {
          expect(snippet).toContain('api.mycompany.com');
          expect(snippet).toContain('/v1/users');
        } else {
          expect(snippet).toContain('https://api.mycompany.com/v1/users');
        }
        expect(snippet).toContain('real_key_xyz');
        expect(snippet).toContain('org_999');
        expect(snippet).toContain('user_456');
        expect(snippet).not.toContain('{{baseUrl}}');
      }
    });

    it('preserves {{variables}} raw syntax when resolveVariables is false', () => {
      const targets: SnippetTarget[] = [
        'curl',
        'fetch',
        'axios',
        'python',
        'node-http',
        'go',
        'java',
      ];

      for (const target of targets) {
        const snippet = generateSnippet(templatedRequest, target, {
          resolveVariables: false,
          scopes,
        });
        expect(snippet).toContain('{{baseUrl}}');
        expect(snippet).toContain('{{apiKey}}');
        expect(snippet).toContain('{{orgId}}');
        expect(snippet).toContain('{{targetId}}');
      }
    });

    it('generates syntactically valid JavaScript for fetch and node-http', () => {
      const fetchSnippet = generateSnippet(basePostRequest, 'fetch');
      expect(() => new Function(`async () => { ${fetchSnippet} }`)).not.toThrow();

      const nodeHttpSnippet = generateSnippet(basePostRequest, 'node-http');
      expect(
        () =>
          new Function(
            `const require = () => ({ request: () => ({ on: () => {}, write: () => {}, end: () => {} }) }); ${nodeHttpSnippet}`,
          ),
      ).not.toThrow();
    });
  });
});
