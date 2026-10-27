import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ConnectionRefusedError,
  DnsError,
  MaxRedirectsError,
  RedirectLoopError,
  RequestAbortedError,
  sendRequest,
  TimeoutError,
  TlsError,
} from '../src/index.js';

describe('HTTP Engine (Phase 3)', () => {
  let httpServer: http.Server;
  let httpsServer: https.Server;
  let httpPort: number;
  let httpsPort: number;
  let baseUrl: string;
  let httpsBaseUrl: string;

  beforeAll(async () => {
    // 1. Setup HTTP test server
    httpServer = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Echo Method
      if (pathname === '/echo-method') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'Reqit-Server',
        });
        if (req.method !== 'HEAD') {
          res.end(JSON.stringify({ method: req.method }));
        } else {
          res.end();
        }
        return;
      }

      // Echo Query
      if (pathname === '/echo-query') {
        const queryObj: Record<string, string> = {};
        url.searchParams.forEach((val, key) => {
          queryObj[key] = val;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ query: queryObj }));
        return;
      }

      // Echo Body
      if (pathname === '/echo-body') {
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              contentType: req.headers['content-type'],
              body: bodyStr,
            }),
          );
        });
        return;
      }

      // Auth Bearer
      if (pathname === '/auth/bearer') {
        const auth = req.headers['authorization'];
        if (auth === 'Bearer valid-token-123') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: true, type: 'bearer' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: false }));
        }
        return;
      }

      // Auth Basic
      if (pathname === '/auth/basic') {
        const expected = 'Basic ' + Buffer.from('alice:secret123').toString('base64');
        if (req.headers['authorization'] === expected) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: true, type: 'basic' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: false }));
        }
        return;
      }

      // Auth API Key Header
      if (pathname === '/auth/apikey-header') {
        if (req.headers['x-api-key'] === 'super-secret-key') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: true, in: 'header' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: false }));
        }
        return;
      }

      // Auth API Key Query
      if (pathname === '/auth/apikey-query') {
        if (url.searchParams.get('api_key') === 'query-secret-key') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: true, in: 'query' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: false }));
        }
        return;
      }

      // Redirects
      if (pathname === '/redirect/301') {
        res.writeHead(301, { Location: '/redirect/target' });
        res.end();
        return;
      }
      if (pathname === '/redirect/302') {
        res.writeHead(302, { Location: '/redirect/target' });
        res.end();
        return;
      }
      if (pathname === '/redirect/303') {
        res.writeHead(303, { Location: '/redirect/target' });
        res.end();
        return;
      }
      if (pathname === '/redirect/307') {
        res.writeHead(307, { Location: '/redirect/target' });
        res.end();
        return;
      }
      if (pathname === '/redirect/308') {
        res.writeHead(308, { Location: '/redirect/target' });
        res.end();
        return;
      }
      if (pathname === '/redirect/target') {
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              redirected: true,
              method: req.method,
              body: Buffer.concat(chunks).toString('utf-8'),
            }),
          );
        });
        return;
      }

      // Redirect Loop
      if (pathname === '/redirect/loop-a') {
        res.writeHead(302, { Location: '/redirect/loop-b' });
        res.end();
        return;
      }
      if (pathname === '/redirect/loop-b') {
        res.writeHead(302, { Location: '/redirect/loop-a' });
        res.end();
        return;
      }

      // Infinite Redirects
      if (pathname === '/redirect/infinite') {
        const count = Number(url.searchParams.get('count') || '0');
        res.writeHead(302, { Location: `/redirect/infinite?count=${count + 1}` });
        res.end();
        return;
      }

      // Compression: Gzip
      if (pathname === '/compress/gzip') {
        const payload = Buffer.from(JSON.stringify({ compressed: 'gzip', text: 'Hello Gzip' }));
        const compressed = zlib.gzipSync(payload);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
        });
        res.end(compressed);
        return;
      }

      // Compression: Deflate
      if (pathname === '/compress/deflate') {
        const payload = Buffer.from(
          JSON.stringify({ compressed: 'deflate', text: 'Hello Deflate' }),
        );
        const compressed = zlib.deflateSync(payload);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'deflate',
        });
        res.end(compressed);
        return;
      }

      // Compression: Brotli
      if (pathname === '/compress/brotli') {
        const payload = Buffer.from(JSON.stringify({ compressed: 'brotli', text: 'Hello Brotli' }));
        const compressed = zlib.brotliCompressSync(payload);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'br',
        });
        res.end(compressed);
        return;
      }

      // Slow response for timeout/cancel testing
      if (pathname === '/slow') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('done slow');
        }, 800);
        return;
      }

      // Large body stream
      if (pathname === '/large-body') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        // Stream 6 chunks of 1MB = 6MB
        const chunk = Buffer.alloc(1024 * 1024, 'A');
        let sent = 0;
        const interval = setInterval(() => {
          res.write(chunk);
          sent++;
          if (sent >= 6) {
            clearInterval(interval);
            res.end();
          }
        }, 10);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as { port: number };
        httpPort = addr.port;
        baseUrl = `http://127.0.0.1:${httpPort}`;
        resolve();
      });
    });

    // 2. Setup HTTPS test server (with self-signed cert)
    const certDir = path.resolve(__dirname, 'fixtures/certs');
    const certPath = path.join(certDir, 'test-cert.pem');
    const keyPath = path.join(certDir, 'test-key.pem');

    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);

    httpsServer = https.createServer({ cert, key }, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ secure: true }));
    });

    await new Promise<void>(resolve => {
      httpsServer.listen(0, '127.0.0.1', () => {
        const addr = httpsServer.address() as { port: number };
        httpsPort = addr.port;
        httpsBaseUrl = `https://localhost:${httpsPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
    await new Promise<void>(resolve => httpsServer.close(() => resolve()));
  });

  describe('HTTP Methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

    for (const method of methods) {
      it(`sends ${method} request successfully`, async () => {
        const res = await sendRequest({
          version: 1,
          name: `${method} Test`,
          method,
          url: `${baseUrl}/echo-method`,
        });

        expect(res.status).toBe(200);
        expect(res.statusText).toBe('OK');
        expect(res.getHeader('x-custom-header')).toBe('Reqit-Server');
        expect(res.totalMs).toBeGreaterThanOrEqual(0);

        const data = res.json<{ method: string }>();
        expect(data.method).toBe(method);
      });
    }

    it('sends HEAD request and returns empty body with headers', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'HEAD Test',
        method: 'HEAD',
        url: `${baseUrl}/echo-method`,
      });

      expect(res.status).toBe(200);
      expect(res.getHeader('content-type')).toContain('application/json');
      expect(res.body).toBe('');
    });
  });

  describe('Query Parameters', () => {
    it('appends and encodes query params properly, skipping disabled ones', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Query Test',
        method: 'GET',
        url: `${baseUrl}/echo-query`,
        params: [
          { name: 'search', value: 'hello world', enabled: true },
          { name: 'page', value: '2' }, // enabled by default
          { name: 'disabled_field', value: 'should_not_appear', enabled: false },
          { name: 'special', value: 'a&b=c', enabled: true },
        ],
      });

      expect(res.status).toBe(200);
      const data = res.json<{ query: Record<string, string> }>();
      expect(data.query).toEqual({
        search: 'hello world',
        page: '2',
        special: 'a&b=c',
      });
      expect(data.query.disabled_field).toBeUndefined();
    });

    it('merges with existing query parameters in the URL', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Existing Query Test',
        method: 'GET',
        url: `${baseUrl}/echo-query?initial=true`,
        params: [{ name: 'extra', value: 'value' }],
      });

      const data = res.json<{ query: Record<string, string> }>();
      expect(data.query).toEqual({
        initial: 'true',
        extra: 'value',
      });
    });
  });

  describe('Body Types', () => {
    it('sends JSON body with auto Content-Type', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'JSON Body Test',
        method: 'POST',
        url: `${baseUrl}/echo-body`,
        body: {
          type: 'json',
          content: JSON.stringify({ name: 'Alice', age: 30 }),
        },
      });

      expect(res.status).toBe(200);
      const data = res.json<{ contentType: string; body: string }>();
      expect(data.contentType).toContain('application/json');
      expect(JSON.parse(data.body)).toEqual({ name: 'Alice', age: 30 });
    });

    it('respects custom user Content-Type header overriding auto Content-Type', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Custom Content-Type Test',
        method: 'POST',
        url: `${baseUrl}/echo-body`,
        headers: [{ name: 'Content-Type', value: 'application/vnd.api+json' }],
        body: {
          type: 'json',
          content: '{"custom": true}',
        },
      });

      const data = res.json<{ contentType: string; body: string }>();
      expect(data.contentType).toBe('application/vnd.api+json');
    });

    it('sends text body with text/plain Content-Type', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Text Body Test',
        method: 'POST',
        url: `${baseUrl}/echo-body`,
        body: {
          type: 'text',
          content: 'Hello, plain text world!',
        },
      });

      const data = res.json<{ contentType: string; body: string }>();
      expect(data.contentType).toContain('text/plain');
      expect(data.body).toBe('Hello, plain text world!');
    });

    it('sends form-urlencoded body and skips disabled form items', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Form Body Test',
        method: 'POST',
        url: `${baseUrl}/echo-body`,
        body: {
          type: 'form',
          form: [
            { name: 'username', value: 'user_1', enabled: true },
            { name: 'password', value: 'secret 123', enabled: true },
            { name: 'ignored', value: 'skip_me', enabled: false },
          ],
        },
      });

      const data = res.json<{ contentType: string; body: string }>();
      expect(data.contentType).toContain('application/x-www-form-urlencoded');
      const parsedParams = new URLSearchParams(data.body);
      expect(parsedParams.get('username')).toBe('user_1');
      expect(parsedParams.get('password')).toBe('secret 123');
      expect(parsedParams.get('ignored')).toBeNull();
    });

    it('sends multipart body with text and file fields', async () => {
      // Create a small temporary file to test file upload
      const tempFilePath = path.join(__dirname, 'fixtures/temp-upload.txt');
      fs.writeFileSync(tempFilePath, 'Sample file content for upload');

      try {
        const res = await sendRequest({
          version: 1,
          name: 'Multipart Test',
          method: 'POST',
          url: `${baseUrl}/echo-body`,
          body: {
            type: 'multipart',
            form: [
              { name: 'title', value: 'Profile Update', enabled: true },
              { name: 'document', value: tempFilePath, type: 'file', enabled: true },
              { name: 'disabled_part', value: 'noop', enabled: false },
            ],
          },
        });

        const data = res.json<{ contentType: string; body: string }>();
        expect(data.contentType).toContain('multipart/form-data; boundary=');
        expect(data.body).toContain('name="title"');
        expect(data.body).toContain('Profile Update');
        expect(data.body).toContain('filename="temp-upload.txt"');
        expect(data.body).toContain('Sample file content for upload');
        expect(data.body).not.toContain('disabled_part');
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('sends request with body: none without Content-Length or body', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'None Body Test',
        method: 'POST',
        url: `${baseUrl}/echo-body`,
        body: {
          type: 'none',
        },
      });

      const data = res.json<{ contentType: string; body: string }>();
      expect(data.body).toBe('');
    });
  });

  describe('Auth Types', () => {
    it('authenticates with Bearer token', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Bearer Auth',
        method: 'GET',
        url: `${baseUrl}/auth/bearer`,
        auth: {
          type: 'bearer',
          token: 'valid-token-123',
        },
      });

      expect(res.status).toBe(200);
      expect(res.json<{ authorized: boolean }>().authorized).toBe(true);
    });

    it('fails Bearer auth with wrong token', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Bearer Auth Fail',
        method: 'GET',
        url: `${baseUrl}/auth/bearer`,
        auth: {
          type: 'bearer',
          token: 'wrong-token',
        },
      });

      expect(res.status).toBe(401);
    });

    it('authenticates with Basic credentials', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Basic Auth',
        method: 'GET',
        url: `${baseUrl}/auth/basic`,
        auth: {
          type: 'basic',
          username: 'alice',
          password: 'secret123',
        },
      });

      expect(res.status).toBe(200);
      expect(res.json<{ authorized: boolean }>().authorized).toBe(true);
    });

    it('authenticates with API key in header', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'ApiKey Header Auth',
        method: 'GET',
        url: `${baseUrl}/auth/apikey-header`,
        auth: {
          type: 'apikey',
          key: 'X-API-KEY',
          value: 'super-secret-key',
          in: 'header',
        },
      });

      expect(res.status).toBe(200);
      expect(res.json<{ authorized: boolean }>().authorized).toBe(true);
    });

    it('authenticates with API key in query', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'ApiKey Query Auth',
        method: 'GET',
        url: `${baseUrl}/auth/apikey-query`,
        auth: {
          type: 'apikey',
          key: 'api_key',
          value: 'query-secret-key',
          in: 'query',
        },
      });

      expect(res.status).toBe(200);
      expect(res.json<{ authorized: boolean }>().authorized).toBe(true);
    });
  });

  describe('Redirect Handling', () => {
    it('follows 301, 302, 307, 308 redirects automatically by default', async () => {
      const codes = [301, 302, 307, 308];
      for (const code of codes) {
        const res = await sendRequest({
          version: 1,
          name: `Redirect ${code}`,
          method: 'GET',
          url: `${baseUrl}/redirect/${code}`,
        });

        expect(res.status).toBe(200);
        const data = res.json<{ redirected: boolean }>();
        expect(data.redirected).toBe(true);
      }
    });

    it('converts POST to GET on 303 redirect and drops body', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Redirect 303',
        method: 'POST',
        url: `${baseUrl}/redirect/303`,
        body: { type: 'json', content: '{"dropped": true}' },
      });

      expect(res.status).toBe(200);
      const data = res.json<{ redirected: boolean; method: string; body: string }>();
      expect(data.redirected).toBe(true);
      expect(data.method).toBe('GET');
      expect(data.body).toBe('');
    });

    it('preserves POST method and body on 307 and 308 redirects', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Redirect 307 preserve',
        method: 'POST',
        url: `${baseUrl}/redirect/307`,
        body: { type: 'json', content: '{"preserved": true}' },
      });

      expect(res.status).toBe(200);
      const data = res.json<{ redirected: boolean; method: string; body: string }>();
      expect(data.redirected).toBe(true);
      expect(data.method).toBe('POST');
      expect(data.body).toBe('{"preserved": true}');
    });

    it('returns 3xx status directly when followRedirects is false', async () => {
      const res = await sendRequest(
        {
          version: 1,
          name: 'No Follow',
          method: 'GET',
          url: `${baseUrl}/redirect/302`,
        },
        { followRedirects: false },
      );

      expect(res.status).toBe(302);
      expect(res.getHeader('location')).toBe('/redirect/target');
    });

    it('throws MaxRedirectsError when redirect limit is reached', async () => {
      await expect(
        sendRequest(
          {
            version: 1,
            name: 'Infinite Redirect',
            method: 'GET',
            url: `${baseUrl}/redirect/infinite`,
          },
          { maxRedirects: 3 },
        ),
      ).rejects.toThrow(MaxRedirectsError);

      try {
        await sendRequest(
          {
            version: 1,
            name: 'Infinite Redirect',
            method: 'GET',
            url: `${baseUrl}/redirect/infinite`,
          },
          { maxRedirects: 3 },
        );
      } catch (err) {
        expect(err).toBeInstanceOf(MaxRedirectsError);
        expect((err as MaxRedirectsError).message).toContain('Maximum redirect limit reached (3)');
      }
    });

    it('throws RedirectLoopError when redirect loop is detected', async () => {
      await expect(
        sendRequest({
          version: 1,
          name: 'Redirect Loop',
          method: 'GET',
          url: `${baseUrl}/redirect/loop-a`,
        }),
      ).rejects.toThrow(RedirectLoopError);

      try {
        await sendRequest({
          version: 1,
          name: 'Redirect Loop',
          method: 'GET',
          url: `${baseUrl}/redirect/loop-a`,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectLoopError);
        expect((err as RedirectLoopError).message).toContain('Redirect loop detected');
      }
    });
  });

  describe('Decompression', () => {
    it('decompresses gzip response', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Gzip Test',
        method: 'GET',
        url: `${baseUrl}/compress/gzip`,
      });

      expect(res.status).toBe(200);
      const data = res.json<{ compressed: string; text: string }>();
      expect(data.compressed).toBe('gzip');
      expect(data.text).toBe('Hello Gzip');
    });

    it('decompresses deflate response', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Deflate Test',
        method: 'GET',
        url: `${baseUrl}/compress/deflate`,
      });

      expect(res.status).toBe(200);
      const data = res.json<{ compressed: string; text: string }>();
      expect(data.compressed).toBe('deflate');
      expect(data.text).toBe('Hello Deflate');
    });

    it('decompresses brotli response', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'Brotli Test',
        method: 'GET',
        url: `${baseUrl}/compress/brotli`,
      });

      expect(res.status).toBe(200);
      const data = res.json<{ compressed: string; text: string }>();
      expect(data.compressed).toBe('brotli');
      expect(data.text).toBe('Hello Brotli');
    });
  });

  describe('Timeouts and Cancellation', () => {
    it('throws TimeoutError when request exceeds timeoutMs', async () => {
      await expect(
        sendRequest(
          {
            version: 1,
            name: 'Timeout Test',
            method: 'GET',
            url: `${baseUrl}/slow`,
          },
          { timeoutMs: 50 },
        ),
      ).rejects.toThrow(TimeoutError);

      try {
        await sendRequest(
          {
            version: 1,
            name: 'Timeout Test',
            method: 'GET',
            url: `${baseUrl}/slow`,
          },
          { timeoutMs: 50 },
        );
      } catch (err) {
        expect(err).toBeInstanceOf(TimeoutError);
        expect((err as TimeoutError).message).toContain('Request timed out after 50ms');
      }
    });

    it('throws RequestAbortedError when request is cancelled via AbortController', async () => {
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort();
      }, 30);

      await expect(
        sendRequest(
          {
            version: 1,
            name: 'Abort Test',
            method: 'GET',
            url: `${baseUrl}/slow`,
          },
          { signal: controller.signal },
        ),
      ).rejects.toThrow(RequestAbortedError);

      try {
        const c2 = new AbortController();
        setTimeout(() => c2.abort(), 20);
        await sendRequest(
          {
            version: 1,
            name: 'Abort Test',
            method: 'GET',
            url: `${baseUrl}/slow`,
          },
          { signal: c2.signal },
        );
      } catch (err) {
        expect(err).toBeInstanceOf(RequestAbortedError);
        expect((err as RequestAbortedError).message).toContain('Request was cancelled');
      }
    });
  });

  describe('Large Body Streaming to Disk', () => {
    it('streams body to temp file when size exceeds maxInMemoryBytes', async () => {
      const res = await sendRequest(
        {
          version: 1,
          name: 'Large Body Test',
          method: 'GET',
          url: `${baseUrl}/large-body`,
        },
        // Set low threshold of 1 MB so the 6MB response triggers disk streaming
        { maxInMemoryBytes: 1024 * 1024 },
      );

      expect(res.status).toBe(200);
      expect(res.body).toBeUndefined();
      expect(res.bodyPath).toBeDefined();
      expect(fs.existsSync(res.bodyPath!)).toBe(true);

      // Verify size and contents of streamed file
      const stats = fs.statSync(res.bodyPath!);
      expect(stats.size).toBe(6 * 1024 * 1024);
      expect(res.sizeBytes).toBe(6 * 1024 * 1024);

      // Cleanup temp file
      fs.unlinkSync(res.bodyPath!);
    });
  });

  describe('TLS Verification and Opt-out', () => {
    it('rejects self-signed certificates by default and throws TlsError', async () => {
      await expect(
        sendRequest({
          version: 1,
          name: 'TLS Default Reject',
          method: 'GET',
          url: `${httpsBaseUrl}/`,
        }),
      ).rejects.toThrow(TlsError);

      try {
        await sendRequest({
          version: 1,
          name: 'TLS Default Reject',
          method: 'GET',
          url: `${httpsBaseUrl}/`,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(TlsError);
        expect((err as TlsError).message).toContain('TLS certificate verification failed');
      }
    });

    it('allows opt-out of TLS verification via validateSsl: false option', async () => {
      const res = await sendRequest(
        {
          version: 1,
          name: 'TLS Opt-out Option',
          method: 'GET',
          url: `${httpsBaseUrl}/`,
        },
        { validateSsl: false },
      );

      expect(res.status).toBe(200);
      expect(res.json<{ secure: boolean }>().secure).toBe(true);
    });

    it('allows opt-out of TLS verification via request.validateSsl: false', async () => {
      const res = await sendRequest({
        version: 1,
        name: 'TLS Opt-out Request',
        method: 'GET',
        url: `${httpsBaseUrl}/`,
        validateSsl: false,
      });

      expect(res.status).toBe(200);
      expect(res.json<{ secure: boolean }>().secure).toBe(true);
    });
  });

  describe('Error Classification', () => {
    it('throws DnsError when host does not exist', async () => {
      await expect(
        sendRequest({
          version: 1,
          name: 'DNS Error',
          method: 'GET',
          url: 'http://this-domain-definitely-does-not-exist-9999999.test',
        }),
      ).rejects.toThrow(DnsError);

      try {
        await sendRequest({
          version: 1,
          name: 'DNS Error',
          method: 'GET',
          url: 'http://this-domain-definitely-does-not-exist-9999999.test',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(DnsError);
        expect((err as DnsError).message).toContain('DNS lookup failed for host');
      }
    });

    it('throws ConnectionRefusedError when port is closed', async () => {
      // Connect to a closed port on localhost
      const closedPort = 59876;
      await expect(
        sendRequest({
          version: 1,
          name: 'Conn Refused',
          method: 'GET',
          url: `http://127.0.0.1:${closedPort}/`,
        }),
      ).rejects.toThrow(ConnectionRefusedError);

      try {
        await sendRequest({
          version: 1,
          name: 'Conn Refused',
          method: 'GET',
          url: `http://127.0.0.1:${closedPort}/`,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ConnectionRefusedError);
        expect((err as ConnectionRefusedError).message).toContain(
          'Connection refused by server at 127.0.0.1:59876',
        );
      }
    });
  });
});
