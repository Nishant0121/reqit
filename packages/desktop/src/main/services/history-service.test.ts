import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoryService } from './history-service.js';
import type { RequestFile, ResponseResult, HttpMethod } from '@reqit/core';

function mockRes(partial: Partial<ResponseResult>): ResponseResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: [],
    sizeBytes: 0,
    totalMs: 10,
    timing: { start: 0, dns: 0, tcp: 0, tls: 0, firstByte: 0, total: 10 },
    getHeader: () => undefined,
    json: () => ({}),
    ...partial,
  } as ResponseResult;
}

describe('HistoryService', () => {
  let service: HistoryService;

  beforeEach(() => {
    service = new HistoryService(':memory:');
  });

  afterEach(() => {
    service.close();
  });

  it('initializes and reads default settings', () => {
    const settings = service.getSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.maxEntries).toBe(1000);
    expect(settings.retentionDays).toBe(30);
  });

  it('updates settings and persists in database', () => {
    const updated = service.updateSettings({
      maxEntries: 50,
      retentionDays: 7,
    });
    expect(updated.maxEntries).toBe(50);
    expect(updated.retentionDays).toBe(7);

    const reloaded = service.getSettings();
    expect(reloaded.maxEntries).toBe(50);
    expect(reloaded.retentionDays).toBe(7);
  });

  it('records a request entry and pre-serialization masks sensitive headers and auth tokens', () => {
    const request: RequestFile = {
      version: 1,
      name: 'Get User Profile',
      method: 'GET',
      url: 'https://api.example.com/profile',
      headers: [
        { name: 'Authorization', value: 'Bearer super-secret-jwt-token' },
        { name: 'X-API-Key', value: 'secret-key-12345' },
        { name: 'Accept', value: 'application/json' },
      ],
      params: [
        { name: 'api_key', value: 'query-param-secret' },
        { name: 'format', value: 'json' },
      ],
      auth: {
        type: 'bearer',
        bearer: { token: 'bearer-token-val' },
      },
    };

    const result = mockRes({
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Set-Cookie', value: 'session=secret-session-id' },
      ],
      body: '{"success": true}',
      totalMs: 125,
      sizeBytes: 18,
    });

    const entry = service.addEntry({
      request,
      resolvedUrl: 'https://api.example.com/profile?format=json',
      result,
      durationMs: 125,
    });

    expect(entry).not.toBeNull();
    expect(entry?.requestName).toBe('Get User Profile');
    expect(entry?.status).toBe(200);
    expect(entry?.isError).toBe(false);

    // Fetch full detail to verify pre-serialization masking
    const detail = service.getEntryById(entry!.id);
    expect(detail).not.toBeNull();

    // Verify headers masked
    const authHeader = detail?.requestSummary.headers?.find(h => h.name === 'Authorization');
    expect(authHeader?.value).toBe('[REDACTED]');
    const apiKeyHeader = detail?.requestSummary.headers?.find(h => h.name === 'X-API-Key');
    expect(apiKeyHeader?.value).toBe('[REDACTED]');
    const acceptHeader = detail?.requestSummary.headers?.find(h => h.name === 'Accept');
    expect(acceptHeader?.value).toBe('application/json');

    // Verify params masked
    const apiKeyParam = detail?.requestSummary.params?.find(p => p.name === 'api_key');
    expect(apiKeyParam?.value).toBe('[REDACTED]');
    const formatParam = detail?.requestSummary.params?.find(p => p.name === 'format');
    expect(formatParam?.value).toBe('json');

    // Verify auth object masked
    expect(
      (detail?.requestSummary.auth as { bearer?: { token?: string } } | undefined)?.bearer?.token,
    ).toBe('[REDACTED]');

    // Verify response headers masked
    expect(detail?.responseHeaders?.['Set-Cookie']).toBe('[REDACTED]');
    expect(detail?.responseHeaders?.['Content-Type']).toBe('application/json');
  });

  it('masks known secret values in resolved URL, headers, and body', () => {
    const knownSecrets = ['my-secret-vault-password', 'production-sk-key'];

    const request: RequestFile = {
      version: 1,
      name: 'Secret Request',
      method: 'POST',
      url: 'https://api.example.com/data?token=production-sk-key',
      headers: [{ name: 'Custom-Header', value: 'prefix-my-secret-vault-password-suffix' }],
      body: {
        type: 'json',
        content: JSON.stringify({ secret: 'my-secret-vault-password' }),
      },
    };

    const result = mockRes({
      status: 201,
      statusText: 'Created',
      body: '{"echoed": "my-secret-vault-password"}',
      totalMs: 80,
    });

    const entry = service.addEntry({
      request,
      resolvedUrl: 'https://api.example.com/data?token=production-sk-key',
      result,
      knownSecrets,
    });

    expect(entry?.url).toBe('https://api.example.com/data?token=[REDACTED]');

    const detail = service.getEntryById(entry!.id);
    expect(detail?.requestSummary.headers?.[0]?.value).toBe('prefix-[REDACTED]-suffix');
    expect(detail?.requestSummary.bodyContent).toContain('[REDACTED]');
    expect(detail?.requestSummary.bodyContent).not.toContain('my-secret-vault-password');
    expect(detail?.responseBody).toBe('{"echoed": "[REDACTED]"}');
  });

  it('caps response body exceeding 1 MB', () => {
    const largePayload = 'A'.repeat(1024 * 1024 + 500); // 1 MB + 500 bytes

    const request: RequestFile = {
      version: 1,
      name: 'Large Response Test',
      method: 'GET',
      url: 'https://example.com/large',
    };

    const result = mockRes({
      status: 200,
      statusText: 'OK',
      body: largePayload,
      sizeBytes: largePayload.length,
      totalMs: 250,
    });

    const entry = service.addEntry({ request, result });
    const detail = service.getEntryById(entry!.id);

    expect(detail?.responseBody).toBeDefined();
    expect(detail!.responseBody!.length).toBeLessThan(largePayload.length);
    expect(detail!.responseBody!).toContain('[Truncated: response exceeded 1 MB limit]');
  });

  it('lazy loads lightweight summary list without heavy payloads', () => {
    const request: RequestFile = {
      version: 1,
      name: 'Lazy Load Test',
      method: 'GET',
      url: 'https://example.com/test',
    };

    const result = mockRes({
      status: 200,
      statusText: 'OK',
      body: 'Heavy payload here...',
      totalMs: 50,
    });

    service.addEntry({ request, result });

    const listResult = service.listEntries();
    expect(listResult.total).toBe(1);
    expect(listResult.entries.length).toBe(1);

    const summary = listResult.entries[0]!;
    expect(summary.requestName).toBe('Lazy Load Test');
    expect(summary.method).toBe('GET');
    expect(summary.status).toBe(200);

    // List summary must NOT contain responseBody or requestSummary
    expect((summary as unknown as Record<string, unknown>).responseBody).toBeUndefined();
    expect((summary as unknown as Record<string, unknown>).requestSummary).toBeUndefined();
  });

  it('filters entries by search query and status code', () => {
    const baseReq = (name: string, url: string, method: string): RequestFile => ({
      version: 1,
      name,
      method: method as HttpMethod,
      url,
    });

    service.addEntry({
      request: baseReq('User List', 'https://api.com/users', 'GET'),
      result: mockRes({ status: 200, statusText: 'OK', totalMs: 10 }),
    });
    service.addEntry({
      request: baseReq('Create Order', 'https://api.com/orders', 'POST'),
      result: mockRes({ status: 201, statusText: 'Created', totalMs: 20 }),
    });
    service.addEntry({
      request: baseReq('Get Missing', 'https://api.com/missing', 'GET'),
      result: mockRes({ status: 404, statusText: 'Not Found', totalMs: 15 }),
    });
    service.addEntry({
      request: baseReq('Crashing Server', 'https://api.com/crash', 'POST'),
      result: mockRes({ status: 500, statusText: 'Internal Error', totalMs: 30 }),
    });
    service.addEntry({
      request: baseReq('Network Fail', 'https://api.com/fail', 'GET'),
      error: new Error('ECONNREFUSED 127.0.0.1:9999'),
    });

    // 1. All
    expect(service.listEntries({ statusFilter: 'all' }).total).toBe(5);

    // 2. 2xx
    const res2xx = service.listEntries({ statusFilter: '2xx' });
    expect(res2xx.total).toBe(2);
    expect(res2xx.entries.every(e => e.status && e.status >= 200 && e.status < 300)).toBe(true);

    // 3. 4xx
    const res4xx = service.listEntries({ statusFilter: '4xx' });
    expect(res4xx.total).toBe(1);
    expect(res4xx.entries[0]?.requestName).toBe('Get Missing');

    // 4. 5xx
    const res5xx = service.listEntries({ statusFilter: '5xx' });
    expect(res5xx.total).toBe(1);
    expect(res5xx.entries[0]?.requestName).toBe('Crashing Server');

    // 5. error
    const resErr = service.listEntries({ statusFilter: 'error' });
    expect(resErr.total).toBe(3); // 404, 500, and Network Fail

    // 6. Search query
    const resQuery = service.listEntries({ query: 'Order' });
    expect(resQuery.total).toBe(1);
    expect(resQuery.entries[0]?.requestName).toBe('Create Order');

    const resUrlQuery = service.listEntries({ query: 'missing' });
    expect(resUrlQuery.total).toBe(1);
    expect(resUrlQuery.entries[0]?.url).toBe('https://api.com/missing');
  });

  it('respects the disabled setting toggle immediately without writing to disk', () => {
    service.updateSettings({ enabled: false });

    const request: RequestFile = {
      version: 1,
      name: 'Disabled Test',
      method: 'GET',
      url: 'https://example.com',
    };

    const entry = service.addEntry({
      request,
      result: mockRes({ status: 200, statusText: 'OK', totalMs: 10 }),
    });

    expect(entry).toBeNull();
    expect(service.listEntries().total).toBe(0);
  });

  it('prunes entries exceeding maxEntries', () => {
    service.updateSettings({ maxEntries: 3 });

    for (let i = 1; i <= 5; i++) {
      service.addEntry({
        request: {
          version: 1,
          name: `Req ${i}`,
          method: 'GET',
          url: `https://example.com/${i}`,
        },
        result: mockRes({ status: 200, statusText: 'OK', totalMs: i }),
      });
    }

    service.pruneOldEntries();

    const list = service.listEntries();
    expect(list.total).toBe(3);
    // Should keep the 3 newest (5, 4, 3)
    expect(list.entries.map(e => e.requestName)).toEqual(['Req 5', 'Req 4', 'Req 3']);
  });

  it('deletes a single entry and clears all history', () => {
    const e1 = service.addEntry({
      request: { version: 1, name: 'Req 1', method: 'GET', url: 'https://a.com' },
    });
    const e2 = service.addEntry({
      request: { version: 1, name: 'Req 2', method: 'GET', url: 'https://b.com' },
    });

    expect(service.listEntries().total).toBe(2);

    const deleted = service.deleteEntry(e1!.id);
    expect(deleted).toBe(true);
    expect(service.listEntries().total).toBe(1);
    expect(service.getEntryById(e1!.id)).toBeNull();
    expect(service.getEntryById(e2!.id)).not.toBeNull();

    service.clearHistory();
    expect(service.listEntries().total).toBe(0);
  });
});
