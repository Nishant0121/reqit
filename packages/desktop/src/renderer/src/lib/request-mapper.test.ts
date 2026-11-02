import { describe, it, expect } from 'vitest';
import type { RequestFile } from '@reqit/core';
import { requestFileToDraft, draftToRequestFile } from './request-mapper.js';

describe('request-mapper', () => {
  it('converts RequestFile into RequestDraft and back', () => {
    const original: RequestFile = {
      version: 1,
      name: 'Get User',
      method: 'GET',
      url: 'https://example.com/api/users/42',
      headers: [{ name: 'Accept', value: 'application/json', enabled: true }],
      params: [{ name: 'details', value: 'true', enabled: true }],
      auth: {
        type: 'bearer',
        token: 'secret-token-123',
      },
      body: {
        type: 'json',
        content: '{"active":true}',
      },
    };

    const draft = requestFileToDraft(original, '/path/to/get-user.yaml');
    expect(draft.name).toBe('Get User');
    expect(draft.method).toBe('GET');
    expect(draft.url).toBe('https://example.com/api/users/42');
    expect(draft.authType).toBe('bearer');
    expect(draft.bearerToken).toBe('secret-token-123');
    expect(draft.bodyType).toBe('json');
    expect(draft.bodyContent).toBe('{"active":true}');
    expect(draft.filePath).toBe('/path/to/get-user.yaml');
    expect(draft.isDirty).toBe(false);

    // If untouched, draftToRequestFile returns exact same object reference
    const converted = draftToRequestFile(draft);
    expect(converted).toBe(original);
  });

  it('updates RequestFile when draft is dirty', () => {
    const original: RequestFile = {
      version: 1,
      name: 'Original',
      method: 'GET',
      url: 'https://example.com/api',
    };

    const draft = requestFileToDraft(original);
    draft.name = 'Updated Name';
    draft.method = 'POST';
    draft.bodyType = 'json';
    draft.bodyContent = '{"hello":"world"}';
    draft.isDirty = true;

    const converted = draftToRequestFile(draft);
    expect(converted.name).toBe('Updated Name');
    expect(converted.method).toBe('POST');
    expect(converted.body?.type).toBe('json');
    expect(converted.body?.content).toBe('{"hello":"world"}');
  });

  it('handles basic and apikey auth', () => {
    const basicFile: RequestFile = {
      version: 1,
      name: 'Basic Auth Req',
      method: 'GET',
      url: 'https://example.com',
      auth: {
        type: 'basic',
        username: 'admin',
        password: 'password123',
      },
    };
    const draft = requestFileToDraft(basicFile);
    expect(draft.authType).toBe('basic');
    expect(draft.basicUser).toBe('admin');
    expect(draft.basicPass).toBe('password123');

    const apiKeyFile: RequestFile = {
      version: 1,
      name: 'API Key Req',
      method: 'GET',
      url: 'https://example.com',
      auth: {
        type: 'apikey',
        key: 'X-API-Key',
        value: 'key-val',
        in: 'header',
      },
    };
    const draftApi = requestFileToDraft(apiKeyFile);
    expect(draftApi.authType).toBe('apiKey');
    expect(draftApi.apiKeyName).toBe('X-API-Key');
    expect(draftApi.apiKeyValue).toBe('key-val');
    expect(draftApi.apiKeyIn).toBe('header');
  });

  it('maps pre and post scripts correctly', () => {
    const fileWithScripts: RequestFile = {
      version: 1,
      name: 'Scripted Request',
      method: 'POST',
      url: 'https://example.com/login',
      scripts: {
        pre: "req.headers.set('X-Start', 'true');",
        post: "reqit.setVar('token', res.json().token);",
      },
    };

    const draft = requestFileToDraft(fileWithScripts);
    expect(draft.preScript).toBe("req.headers.set('X-Start', 'true');");
    expect(draft.postScript).toBe("reqit.setVar('token', res.json().token);");

    draft.preScript = "req.headers.set('X-Modified', '123');";
    draft.isDirty = true;

    const converted = draftToRequestFile(draft);
    expect(converted.scripts?.pre).toBe("req.headers.set('X-Modified', '123');");
    expect(converted.scripts?.post).toBe("reqit.setVar('token', res.json().token);");
  });

  it('maps test assertions correctly (Phase 17)', () => {
    const fileWithTests: RequestFile = {
      version: 1,
      name: 'Tested Request',
      method: 'GET',
      url: 'https://example.com/status',
      tests: [
        { name: 'Status is 200', assert: 'res.status === 200' },
        { name: 'Body contains ok', assert: 'res.body.includes("ok")' },
      ],
    };

    const draft = requestFileToDraft(fileWithTests);
    expect(draft.tests).toHaveLength(2);
    expect(draft.tests![0]!.name).toBe('Status is 200');
    expect(draft.tests![0]!.assert).toBe('res.status === 200');
    expect(draft.tests![0]!.enabled).toBe(true);

    draft.tests?.push({
      id: 'test-new-1',
      name: 'Time under 500ms',
      assert: 'res.timeMs < 500',
      enabled: true,
    });
    draft.isDirty = true;

    const converted = draftToRequestFile(draft);
    expect(converted.tests).toHaveLength(3);
    expect(converted.tests![2]!.name).toBe('Time under 500ms');
    expect(converted.tests![2]!.assert).toBe('res.timeMs < 500');
  });
});
