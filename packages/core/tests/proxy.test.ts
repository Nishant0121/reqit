import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isProxyBypassed, resolveProxyConfig, createProxyAgent } from '../src/engine/proxy.js';

describe('Proxy Engine (Phase 14)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.ALL_PROXY;
    delete process.env.all_proxy;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isProxyBypassed', () => {
    it('matches exact hostnames', () => {
      expect(isProxyBypassed('localhost', ['localhost', '127.0.0.1'])).toBe(true);
      expect(isProxyBypassed('127.0.0.1', ['localhost', '127.0.0.1'])).toBe(true);
      expect(isProxyBypassed('api.example.com', ['localhost', '127.0.0.1'])).toBe(false);
    });

    it('matches wildcard domains (*.domain.com and .domain.com)', () => {
      const bypass = ['*.internal.net', '.corp.local'];
      expect(isProxyBypassed('service.internal.net', bypass)).toBe(true);
      expect(isProxyBypassed('internal.net', bypass)).toBe(true);
      expect(isProxyBypassed('auth.corp.local', bypass)).toBe(true);
      expect(isProxyBypassed('corp.local', bypass)).toBe(true);
      expect(isProxyBypassed('external.com', bypass)).toBe(false);
    });
  });

  describe('resolveProxyConfig', () => {
    it('returns null when proxyOption is none or undefined', () => {
      const url = new URL('https://api.example.com/data');
      expect(resolveProxyConfig(url, undefined)).toBeNull();
      expect(resolveProxyConfig(url, 'none')).toBeNull();
    });

    it('resolves manual proxy config with bypass checking', () => {
      const url1 = new URL('https://api.example.com/data');
      const resolved1 = resolveProxyConfig(url1, {
        url: 'http://127.0.0.1:8080',
        bypass: ['localhost', '127.0.0.1'],
      });
      expect(resolved1).toEqual({ proxyUrl: 'http://127.0.0.1:8080' });

      const url2 = new URL('http://localhost:3000/health');
      const resolved2 = resolveProxyConfig(url2, {
        url: 'http://127.0.0.1:8080',
        bypass: ['localhost', '127.0.0.1'],
      });
      expect(resolved2).toBeNull();
    });

    it('resolves system proxy from environment variables', () => {
      process.env.HTTP_PROXY = 'http://system-http-proxy:3128';
      process.env.HTTPS_PROXY = 'http://system-https-proxy:3128';

      const httpUrl = new URL('http://api.example.com');
      expect(resolveProxyConfig(httpUrl, 'system')).toEqual({
        proxyUrl: 'http://system-http-proxy:3128',
      });

      const httpsUrl = new URL('https://api.example.com');
      expect(resolveProxyConfig(httpsUrl, 'system')).toEqual({
        proxyUrl: 'http://system-https-proxy:3128',
      });
    });

    it('respects system NO_PROXY environment variable', () => {
      process.env.HTTPS_PROXY = 'http://system-https-proxy:3128';
      process.env.NO_PROXY = 'api.example.com, *.internal';

      const bypassedUrl = new URL('https://api.example.com');
      expect(resolveProxyConfig(bypassedUrl, 'system')).toBeNull();

      const nonBypassedUrl = new URL('https://api.other.com');
      expect(resolveProxyConfig(nonBypassedUrl, 'system')).toEqual({
        proxyUrl: 'http://system-https-proxy:3128',
      });
    });
  });

  describe('createProxyAgent', () => {
    it('creates agent for HTTP target', () => {
      const agent = createProxyAgent('http://127.0.0.1:8080', false);
      expect(agent).toBeTruthy();
    });

    it('creates agent for HTTPS target with CONNECT tunneling', () => {
      const agent = createProxyAgent('http://127.0.0.1:8080', true, false);
      expect(agent).toBeTruthy();
    });
  });
});
