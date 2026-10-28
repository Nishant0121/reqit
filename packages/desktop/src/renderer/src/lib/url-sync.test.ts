import { describe, it, expect } from 'vitest';
import { parseUrlQueryParams, syncUrlWithParams } from './url-sync';
import type { KeyValueRow } from '../components/ui/KeyValueTable';

describe('url-sync utility', () => {
  it('parses simple query string into KeyValueRows', () => {
    const url = 'https://api.example.com/search?q=reqit&page=2';
    const params = parseUrlQueryParams(url);

    expect(params).toHaveLength(2);
    expect(params[0]!.key).toBe('q');
    expect(params[0]!.value).toBe('reqit');
    expect(params[0]!.enabled).toBe(true);
    expect(params[1]!.key).toBe('page');
    expect(params[1]!.value).toBe('2');
  });

  it('handles empty query string and retains disabled params', () => {
    const existing: KeyValueRow[] = [
      { id: '1', enabled: false, key: 'disabledKey', value: 'secret' },
    ];
    const url = 'https://api.example.com/users';
    const params = parseUrlQueryParams(url, existing);

    expect(params).toHaveLength(1);
    expect(params[0]!.key).toBe('disabledKey');
    expect(params[0]!.enabled).toBe(false);
  });

  it('syncs params to URL preserving template variables', () => {
    const currentUrl = '{{baseUrl}}/users';
    const params: KeyValueRow[] = [
      { id: '1', enabled: true, key: 'tenantId', value: '{{currentTenant}}' },
      { id: '2', enabled: false, key: 'filter', value: 'inactive' },
      { id: '3', enabled: true, key: 'limit', value: '50' },
    ];

    const result = syncUrlWithParams(currentUrl, params);
    expect(result).toBe('{{baseUrl}}/users?tenantId={{currentTenant}}&limit=50');
  });

  it('removes query string from URL when all params are removed or disabled', () => {
    const currentUrl = 'https://api.example.com/items?a=1&b=2';
    const params: KeyValueRow[] = [
      { id: '1', enabled: false, key: 'a', value: '1' },
      { id: '2', enabled: false, key: 'b', value: '2' },
    ];

    const result = syncUrlWithParams(currentUrl, params);
    expect(result).toBe('https://api.example.com/items');
  });

  it('handles URLs with hashes', () => {
    const currentUrl = 'https://api.example.com/docs?v=1#section-intro';
    const params: KeyValueRow[] = [{ id: '1', enabled: true, key: 'v', value: '2' }];

    const result = syncUrlWithParams(currentUrl, params);
    expect(result).toBe('https://api.example.com/docs?v=2#section-intro');
  });
});
