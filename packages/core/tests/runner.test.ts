import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generateHtmlReport,
  parseCsvData,
  parseDataFileContent,
  parseJsonData,
  runCollectionRunner,
  type RunnerProgressEvent,
} from '../src/runner/index.js';

describe('Phase 22: Data Parser (CSV & JSON)', () => {
  it('parses standard CSV with header row', () => {
    const csv = `id,name,role\n1,Alice,Admin\n2,Bob,User\n`;
    const rows = parseCsvData(csv);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ id: '1', name: 'Alice', role: 'Admin' });
    expect(rows[1]).toEqual({ id: '2', name: 'Bob', role: 'User' });
  });

  it('handles CSV quotes, commas inside fields, and escaped quotes', () => {
    const csv = `id,text\n101,"Hello, World"\n102,"He said ""Reqit is great"""\n`;
    const rows = parseCsvData(csv);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ id: '101', text: 'Hello, World' });
    expect(rows[1]).toEqual({ id: '102', text: 'He said "Reqit is great"' });
  });

  it('throws an error on empty CSV or missing headers', () => {
    expect(() => parseCsvData('')).toThrow();
    expect(() => parseCsvData('   \n  \n')).toThrow();
  });

  it('parses JSON data array of row objects', () => {
    const json = JSON.stringify([
      { userId: 1, action: 'create' },
      { userId: 2, action: 'update' },
    ]);
    const rows = parseJsonData(json);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ userId: 1, action: 'create' });
    expect(rows[1]).toEqual({ userId: 2, action: 'update' });
  });

  it('auto-detects and parses data file content based on extension or content', () => {
    const csvContent = 'key,val\nfoo,bar\n';
    const jsonContent = '[{"key": "foo", "val": "bar"}]';

    expect(parseDataFileContent(csvContent, 'data.csv')[0]).toEqual({ key: 'foo', val: 'bar' });
    expect(parseDataFileContent(jsonContent, 'data.json')[0]).toEqual({ key: 'foo', val: 'bar' });
    expect(parseDataFileContent(jsonContent)[0]).toEqual({ key: 'foo', val: 'bar' });
  });
});

describe('Phase 22: HTML Report Generator', () => {
  it('generates a self-contained HTML report from run summary', () => {
    const html = generateHtmlReport({
      runId: 'test-run-123',
      collectionName: 'User Management API',
      environmentName: 'production',
      totalIterations: 2,
      totalRequests: 4,
      passedRequests: 4,
      failedRequests: 0,
      totalAssertions: 4,
      passedAssertions: 4,
      failedAssertions: 0,
      totalDurationMs: 420,
      startTime: '2026-11-22T08:00:00Z',
      endTime: '2026-11-22T08:00:01Z',
      success: true,
      iterations: [
        {
          iteration: 1,
          dataRow: { userId: 101, plan: 'enterprise' },
          passed: true,
          results: [
            {
              iteration: 1,
              id: 'req1',
              name: 'Get User',
              method: 'GET',
              url: 'https://api.com/users/101',
              status: 200,
              statusText: 'OK',
              durationMs: 45,
              passed: true,
              assertions: [
                {
                  name: 'Status is 200',
                  assert: 'res.status === 200',
                  passed: true,
                  durationMs: 1,
                },
              ],
              scriptLogs: [{ level: 'log', args: ['User retrieved'], timestamp: Date.now() }],
            },
          ],
        },
      ],
      results: [],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('User Management API');
    expect(html).toContain('production');
    expect(html).toContain('PASSED');
    expect(html).toContain('Iteration 1');
    expect(html).toContain('userId:</strong> 101');
    expect(html).toContain('Get User');
    expect(html).toContain('Status is 200');
  });
});

describe('Phase 22: Collection Runner (Desktop & Engine)', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;
  let collectionDir: string;

  beforeAll(async () => {
    // Start local HTTP server
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

      if (url.pathname.startsWith('/echo')) {
        const rowId = url.searchParams.get('rowId') || 'none';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', rowId, path: url.pathname }));
        return;
      }

      if (url.pathname === '/fail') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'fail' }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Create 20 requests in collection
    collectionDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-phase22-'));
    await fs.promises.writeFile(
      path.join(collectionDir, 'reqit.yaml'),
      `version: 1\nname: 20-Request Test Collection\n`,
    );

    const envDir = path.join(collectionDir, 'environments');
    await fs.promises.mkdir(envDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(envDir, 'test.yaml'),
      `version: 1\nname: test\nvariables:\n  apiBase: "${baseUrl}"\n`,
    );

    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const reqPath = path.join(collectionDir, `req-${pad}.yaml`);
      await fs.promises.writeFile(
        reqPath,
        `version: 1
name: "Request ${pad}"
method: GET
url: "{{apiBase}}/echo/${pad}?rowId={{rowId}}"
tests:
  - name: Status is 200
    assert: "res.status === 200"
  - name: Valid rowId returned
    assert: "res.json().status === 'ok'"
`,
      );
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (collectionDir) {
      await fs.promises.rm(collectionDir, { recursive: true, force: true });
    }
  });

  it('Done when: runs a 20-request collection with a CSV of 10 rows and sees a full report', async () => {
    // Generate CSV of 10 rows
    const csvRows = ['rowId,username'];
    for (let i = 1; i <= 10; i++) {
      csvRows.push(`${i},user_${i}`);
    }
    const csvContent = csvRows.join('\n');
    const parsedData = parseCsvData(csvContent);

    expect(parsedData.length).toBe(10);

    const progressEvents: RunnerProgressEvent[] = [];

    const summary = await runCollectionRunner(
      {
        collectionPath: collectionDir,
        environmentName: 'test',
        data: parsedData,
      },
      event => {
        progressEvents.push(event);
      },
    );

    // 20 requests * 10 iterations = 200 total executions
    expect(summary.totalIterations).toBe(10);
    expect(summary.totalRequests).toBe(200);
    expect(summary.passedRequests).toBe(200);
    expect(summary.failedRequests).toBe(0);
    expect(summary.totalAssertions).toBe(400); // 2 assertions per request * 200
    expect(summary.passedAssertions).toBe(400);
    expect(summary.failedAssertions).toBe(0);
    expect(summary.success).toBe(true);
    expect(summary.iterations.length).toBe(10);

    // Check first iteration and last iteration data variables injection
    expect(summary.iterations[0]?.dataRow?.rowId).toBe('1');
    expect(summary.iterations[9]?.dataRow?.rowId).toBe('10');

    // Verify HTML report generates cleanly with full 200 requests and 10 iterations
    const htmlReport = generateHtmlReport(summary);
    expect(htmlReport).toContain('20-Request Test Collection');
    expect(htmlReport).toContain('Iteration 1');
    expect(htmlReport).toContain('Iteration 10');
    expect(htmlReport).toContain('rowId:</strong> 10');
    expect(htmlReport).toContain('PASSED');

    // Verify progress events were emitted during execution
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[progressEvents.length - 1]?.isComplete).toBe(true);
  }, 25000);

  it('halts execution immediately when bail is true upon failure', async () => {
    const bailDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-bail-'));
    try {
      await fs.promises.writeFile(
        path.join(bailDir, 'reqit.yaml'),
        `version: 1\nname: Bail Test\n`,
      );

      // Request 1: fails
      await fs.promises.writeFile(
        path.join(bailDir, '01-fail.yaml'),
        `version: 1\nname: "01 Fail"\nmethod: GET\nurl: "${baseUrl}/fail"\ntests:\n  - name: Status 200\n    assert: "res.status === 200"\n`,
      );

      // Request 2: would pass
      await fs.promises.writeFile(
        path.join(bailDir, '02-pass.yaml'),
        `version: 1\nname: "02 Pass"\nmethod: GET\nurl: "${baseUrl}/echo/ok"\n`,
      );

      const summary = await runCollectionRunner({
        collectionPath: bailDir,
        iterations: 3,
        bail: true,
      });

      expect(summary.totalRequests).toBe(1);
      expect(summary.failedRequests).toBe(1);
      expect(summary.success).toBe(false);
      expect(summary.stoppedEarly).toBe(true);
    } finally {
      await fs.promises.rm(bailDir, { recursive: true, force: true });
    }
  });

  it('cancels run immediately when AbortSignal is triggered', async () => {
    const controller = new AbortController();

    // Abort after first request
    let reqCount = 0;
    const summary = await runCollectionRunner(
      {
        collectionPath: collectionDir,
        iterations: 5,
        signal: controller.signal,
      },
      () => {
        reqCount++;
        if (reqCount >= 2) {
          controller.abort();
        }
      },
    );

    expect(summary.stoppedEarly).toBe(true);
    expect(summary.totalRequests).toBeLessThan(100);
  });
});
