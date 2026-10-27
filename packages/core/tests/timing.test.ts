import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sendRequest } from '../src/index.js';

describe('Timing Breakdown (Phase 4)', () => {
  let httpServer: http.Server;
  let httpsServer: https.Server;
  let httpPort: number;
  let httpsPort: number;
  let baseUrl: string;
  let httpsBaseUrl: string;

  beforeAll(async () => {
    // 1. Setup HTTP test server with delay and redirect endpoints
    httpServer = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const pathname = url.pathname;

      if (pathname === '/fast') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Artificial TTFB delay: wait 100ms before sending response headers
      if (pathname === '/delay/ttfb') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ delayed: 'ttfb' }));
        }, 100);
        return;
      }

      // Artificial Download delay: send headers, wait 100ms, then send body
      if (pathname === '/delay/download') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked',
        });
        res.write('part1');
        setTimeout(() => {
          res.end('part2');
        }, 100);
        return;
      }

      // Multi-hop Redirect: /hop1 -> /hop2 -> /target
      if (pathname === '/hop1') {
        res.writeHead(302, { Location: '/hop2' });
        res.end();
        return;
      }
      if (pathname === '/hop2') {
        res.writeHead(302, { Location: '/final-target' });
        res.end();
        return;
      }
      if (pathname === '/final-target') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reached: 'final' }));
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

    // 2. Setup HTTPS test server
    const certDir = path.resolve(__dirname, 'fixtures/certs');
    const cert = fs.readFileSync(path.join(certDir, 'test-cert.pem'));
    const key = fs.readFileSync(path.join(certDir, 'test-key.pem'));

    httpsServer = https.createServer({ cert, key }, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ secure: true }));
    });

    await new Promise<void>(resolve => {
      httpsServer.listen(0, '127.0.0.1', () => {
        const addr = httpsServer.address() as { port: number };
        httpsPort = addr.port;
        httpsBaseUrl = `https://127.0.0.1:${httpsPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
    await new Promise<void>(resolve => httpsServer.close(() => resolve()));
  });

  it('exposes all 6 timing fields in the response type', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'Timing Fields',
      method: 'GET',
      url: `${baseUrl}/fast`,
    });

    expect(res.timing).toBeDefined();
    expect(typeof res.timing.dnsMs).toBe('number');
    expect(typeof res.timing.tcpMs).toBe('number');
    expect(typeof res.timing.tlsMs).toBe('number');
    expect(typeof res.timing.ttfbMs).toBe('number');
    expect(typeof res.timing.downloadMs).toBe('number');
    expect(typeof res.timing.totalMs).toBe('number');
  });

  it('timing fields are never negative and the phases sum to roughly the total', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'Timing Invariants',
      method: 'GET',
      url: `${baseUrl}/fast`,
    });

    const { dnsMs, tcpMs, tlsMs, ttfbMs, downloadMs, totalMs } = res.timing;

    expect(dnsMs).toBeGreaterThanOrEqual(0);
    expect(tcpMs).toBeGreaterThanOrEqual(0);
    expect(tlsMs).toBeGreaterThanOrEqual(0);
    expect(ttfbMs).toBeGreaterThanOrEqual(0);
    expect(downloadMs).toBeGreaterThanOrEqual(0);
    expect(totalMs).toBeGreaterThanOrEqual(0);

    const sumOfPhases = dnsMs + tcpMs + tlsMs + ttfbMs + downloadMs;
    // Difference should be minimal (at most 2-3ms due to integer rounding)
    expect(Math.abs(sumOfPhases - totalMs)).toBeLessThanOrEqual(3);
  });

  it('measures artificial TTFB delay within tolerance', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'TTFB Delay',
      method: 'GET',
      url: `${baseUrl}/delay/ttfb`,
    });

    expect(res.timing.ttfbMs).toBeGreaterThanOrEqual(80);
    expect(res.timing.totalMs).toBeGreaterThanOrEqual(res.timing.ttfbMs);

    const sum =
      res.timing.dnsMs +
      res.timing.tcpMs +
      res.timing.tlsMs +
      res.timing.ttfbMs +
      res.timing.downloadMs;
    expect(Math.abs(sum - res.timing.totalMs)).toBeLessThanOrEqual(3);
  });

  it('measures artificial download delay within tolerance', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'Download Delay',
      method: 'GET',
      url: `${baseUrl}/delay/download`,
    });

    expect(res.timing.downloadMs).toBeGreaterThanOrEqual(80);
    expect(res.timing.totalMs).toBeGreaterThanOrEqual(res.timing.downloadMs);

    const sum =
      res.timing.dnsMs +
      res.timing.tcpMs +
      res.timing.tlsMs +
      res.timing.ttfbMs +
      res.timing.downloadMs;
    expect(Math.abs(sum - res.timing.totalMs)).toBeLessThanOrEqual(3);
  });

  it('sets tlsMs to 0 for plain HTTP requests', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'Plain HTTP',
      method: 'GET',
      url: `${baseUrl}/fast`,
    });

    expect(res.timing.tlsMs).toBe(0);
  });

  it('sets dnsMs to 0 when target is an IP address', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'IP Address',
      method: 'GET',
      url: `http://127.0.0.1:${httpPort}/fast`,
    });

    expect(res.timing.dnsMs).toBe(0);
  });

  it('measures TLS handshake timing on HTTPS requests (tlsMs >= 0)', async () => {
    const res = await sendRequest(
      {
        version: 1,
        name: 'HTTPS Timing',
        method: 'GET',
        url: `${httpsBaseUrl}/`,
      },
      { validateSsl: false },
    );

    expect(res.timing.tlsMs).toBeGreaterThanOrEqual(0);
    expect(res.timing.totalMs).toBeGreaterThanOrEqual(0);

    const sum =
      res.timing.dnsMs +
      res.timing.tcpMs +
      res.timing.tlsMs +
      res.timing.ttfbMs +
      res.timing.downloadMs;
    expect(Math.abs(sum - res.timing.totalMs)).toBeLessThanOrEqual(3);
  });

  it('sets dnsMs, tcpMs, and tlsMs to 0 when connection is reused (keep-alive)', async () => {
    const agent = new http.Agent({ keepAlive: true });

    try {
      // First request: establishes connection
      await sendRequest(
        {
          version: 1,
          name: 'Keep-Alive Req 1',
          method: 'GET',
          url: `${baseUrl}/fast`,
        },
        { agent },
      );

      // Second request: reuses the existing socket
      const res2 = await sendRequest(
        {
          version: 1,
          name: 'Keep-Alive Req 2 (Reused)',
          method: 'GET',
          url: `${baseUrl}/fast`,
        },
        { agent },
      );

      expect(res2.timing.dnsMs).toBe(0);
      expect(res2.timing.tcpMs).toBe(0);
      expect(res2.timing.tlsMs).toBe(0);
      expect(res2.timing.ttfbMs).toBeGreaterThanOrEqual(0);
      expect(res2.timing.downloadMs).toBeGreaterThanOrEqual(0);

      const sum =
        res2.timing.dnsMs +
        res2.timing.tcpMs +
        res2.timing.tlsMs +
        res2.timing.ttfbMs +
        res2.timing.downloadMs;
      expect(Math.abs(sum - res2.timing.totalMs)).toBeLessThanOrEqual(3);
    } finally {
      agent.destroy();
    }
  });

  it('records redirect hops separately with their own timings', async () => {
    const res = await sendRequest({
      version: 1,
      name: 'Redirect Hops Timing',
      method: 'GET',
      url: `${baseUrl}/hop1`,
    });

    expect(res.status).toBe(200);
    expect(res.redirectHops).toBeDefined();
    expect(res.redirectHops).toHaveLength(2);

    // Hop 1: /hop1 -> /hop2
    const hop1 = res.redirectHops![0]!;
    expect(hop1.dnsMs).toBeGreaterThanOrEqual(0);
    expect(hop1.tcpMs).toBeGreaterThanOrEqual(0);
    expect(hop1.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(hop1.totalMs).toBeGreaterThanOrEqual(0);
    const hop1Sum = hop1.dnsMs + hop1.tcpMs + hop1.tlsMs + hop1.ttfbMs + hop1.downloadMs;
    expect(Math.abs(hop1Sum - hop1.totalMs)).toBeLessThanOrEqual(3);

    // Hop 2: /hop2 -> /final-target
    const hop2 = res.redirectHops![1]!;
    expect(hop2.totalMs).toBeGreaterThanOrEqual(0);

    // Final response timing
    expect(res.timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(res.redirects).toBe(res.redirectHops);
  });

  it('produces sensible timing values against a live HTTPS endpoint or local HTTPS server', async () => {
    // Attempt real HTTPS endpoint; fallback gracefully if running in an offline environment
    try {
      const res = await sendRequest(
        {
          version: 1,
          name: 'Live HTTPS Check',
          method: 'GET',
          url: 'https://example.com',
        },
        { timeoutMs: 3000 },
      );

      expect(res.status).toBe(200);
      expect(res.timing.dnsMs).toBeGreaterThanOrEqual(0);
      expect(res.timing.tcpMs).toBeGreaterThanOrEqual(0);
      expect(res.timing.tlsMs).toBeGreaterThanOrEqual(0);
      expect(res.timing.ttfbMs).toBeGreaterThanOrEqual(0);
      expect(res.timing.downloadMs).toBeGreaterThanOrEqual(0);
      expect(res.timing.totalMs).toBeGreaterThan(0);

      const sum =
        res.timing.dnsMs +
        res.timing.tcpMs +
        res.timing.tlsMs +
        res.timing.ttfbMs +
        res.timing.downloadMs;
      expect(Math.abs(sum - res.timing.totalMs)).toBeLessThanOrEqual(5);
    } catch {
      // Offline fallback: verify against local HTTPS server with real TLS handshake
      const localRes = await sendRequest(
        {
          version: 1,
          name: 'Local HTTPS Fallback',
          method: 'GET',
          url: `${httpsBaseUrl}/`,
        },
        { validateSsl: false },
      );

      expect(localRes.status).toBe(200);
      expect(localRes.timing.tlsMs).toBeGreaterThanOrEqual(0);
      expect(localRes.timing.totalMs).toBeGreaterThanOrEqual(0);
    }
  });
});
