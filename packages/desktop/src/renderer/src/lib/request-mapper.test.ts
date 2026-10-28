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
});
