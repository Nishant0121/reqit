import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  formatRequestResult,
  formatSummary,
  generateJsonReport,
  generateJunitReport,
  getEnvVarSecrets,
  parseReporterList,
  processReporters,
  resolveCliScopes,
  runCollection,
  type CollectionRunSummary,
} from '../src/index.js';

describe('Reqit CLI: Environment and Secrets Resolution', () => {
  it('extracts secrets prefixed with REQIT_SECRET_', () => {
    const mockEnv = {
      PATH: '/usr/bin',
      REQIT_SECRET_apiKey: 'key_12345',
      REQIT_SECRET_token: 'bearer_token_xyz',
      REQIT_SECRET_PASSWORD: 'supersecretpassword',
      SOME_OTHER_VAR: 'hello',
    };

    const secrets = getEnvVarSecrets(mockEnv);
    expect(secrets.apiKey).toBe('key_12345');
    expect(secrets.token).toBe('bearer_token_xyz');
    expect(secrets.PASSWORD).toBe('supersecretpassword');
    expect((secrets as Record<string, unknown>).SOME_OTHER_VAR).toBeUndefined();
  });

  it('resolves environments and merges file secrets with REQIT_SECRET_ env vars', async () => {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-cli-env-'));
    try {
      const envDir = path.join(tmpDir, 'environments');
      const reqitDir = path.join(tmpDir, '.reqit');
      await fs.promises.mkdir(envDir, { recursive: true });
      await fs.promises.mkdir(reqitDir, { recursive: true });

      // Create environment
      await fs.promises.writeFile(
        path.join(envDir, 'staging.yaml'),
        `version: 1\nname: staging\nvariables:\n  baseUrl: "https://staging.api.com"\n  fileSecret: "from-env"\n`,
      );

      // Create secrets file
      await fs.promises.writeFile(
        path.join(reqitDir, 'secrets.yaml'),
        `version: 1\nenvironments:\n  staging:\n    fileSecret: "from-file"\n    overrideMe: "file-value"\n`,
      );

      // Set environment variable
      process.env.REQIT_SECRET_overrideMe = 'env-value';
      process.env.REQIT_SECRET_ciToken = 'token_abc';

      const { environmentName, scopes } = await resolveCliScopes(tmpDir, {
        envName: 'staging',
      });

      expect(environmentName).toBe('staging');
      expect((scopes.environment as Record<string, string>).baseUrl).toBe(
        'https://staging.api.com',
      );
      // Secrets
      expect((scopes.secrets as Record<string, string>).fileSecret).toBe('from-file');
      expect((scopes.secrets as Record<string, string>).overrideMe).toBe('env-value'); // CI env var won!
      expect((scopes.secrets as Record<string, string>).ciToken).toBe('token_abc');
    } finally {
      delete process.env.REQIT_SECRET_overrideMe;
      delete process.env.REQIT_SECRET_ciToken;
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws a helpful error when the requested environment is not found', async () => {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-cli-env-'));
    try {
      const envDir = path.join(tmpDir, 'environments');
      await fs.promises.mkdir(envDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(envDir, 'prod.yaml'),
        `version: 1\nname: prod\nvariables:\n  url: "https://api.com"\n`,
      );

      await expect(resolveCliScopes(tmpDir, { envName: 'dev' })).rejects.toThrow(
        'Environment "dev" not found. Available environments: prod',
      );
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Reqit CLI: Reporters', () => {
  const sampleSummary: CollectionRunSummary = {
    collectionName: 'Test Collection',
    environmentName: 'dev',
    totalRequests: 2,
    passedRequests: 1,
    failedRequests: 1,
    totalAssertions: 3,
    passedAssertions: 2,
    failedAssertions: 1,
    totalDurationMs: 350,
    startTime: '2026-11-22T08:00:00.000Z',
    endTime: '2026-11-22T08:00:00.350Z',
    success: false,
    results: [
      {
        id: 'req1',
        name: 'Get Users',
        filePath: 'requests/get-users.yaml',
        method: 'GET',
        url: 'http://127.0.0.1/users',
        status: 200,
        statusText: 'OK',
        durationMs: 45,
        passed: true,
        assertions: [
          { name: 'Status is 200', assert: 'res.status === 200', passed: true, durationMs: 2 },
          {
            name: 'Contains users',
            assert: 'res.body.includes("users")',
            passed: true,
            durationMs: 1,
          },
        ],
        scriptLogs: [{ level: 'log', args: ['Found 5 users'], timestamp: Date.now() }],
      },
      {
        id: 'req2',
        name: 'Create User',
        filePath: 'requests/create-user.yaml',
        method: 'POST',
        url: 'http://127.0.0.1/users',
        status: 400,
        statusText: 'Bad Request',
        durationMs: 65,
        passed: false,
        assertions: [
          {
            name: 'Status is 201',
            assert: 'res.status === 201',
            passed: false,
            message: 'Expected 201 but received 400',
            durationMs: 2,
          },
        ],
        scriptLogs: [],
        error: 'Assertion failed',
      },
    ],
  };

  it('formats console output for requests and summary', () => {
    const formattedReq = formatRequestResult(sampleSummary.results[0]!);
    expect(formattedReq).toContain('GET');
    expect(formattedReq).toContain('Get Users');
    expect(formattedReq).toContain('200 OK');
    expect(formattedReq).toContain('✔ Status is 200');
    expect(formattedReq).toContain('[log] Found 5 users');

    const formattedSummary = formatSummary(sampleSummary);
    expect(formattedSummary).toContain('Test Collection');
    expect(formattedSummary).toContain('Environment:');
    expect(formattedSummary).toContain('dev');
    expect(formattedSummary).toContain('1 failed');
    expect(formattedSummary).toContain('1 passed');
    expect(formattedSummary).toContain('FAILURE (exit code 1)');
  });

  it('generates valid JSON report', () => {
    const jsonStr = generateJsonReport(sampleSummary);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.collectionName).toBe('Test Collection');
    expect(parsed.totalRequests).toBe(2);
    expect(parsed.failedAssertions).toBe(1);
    expect(parsed.results.length).toBe(2);
  });

  it('generates valid JUnit XML report', () => {
    const xml = generateJunitReport(sampleSummary);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites name="Reqit: Test Collection" tests="3" failures="1"');
    expect(xml).toContain('<testsuite name="Get Users"');
    expect(xml).toContain('<testcase classname="Get Users" name="Status is 200"');
    expect(xml).toContain('<testcase classname="Create User" name="Status is 201"');
    expect(xml).toContain('<failure message="Expected 201 but received 400"');
  });

  it('writes output files when configured with processReporters', async () => {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-cli-report-'));
    try {
      const junitFile = path.join(tmpDir, 'junit.xml');
      const jsonFile = path.join(tmpDir, 'report.json');

      await processReporters(sampleSummary, {
        reporter: ['junit'],
        output: junitFile,
        silent: true,
      });

      expect(fs.existsSync(junitFile)).toBe(true);
      const xml = await fs.promises.readFile(junitFile, 'utf-8');
      expect(xml).toContain('<testsuites');

      await processReporters(sampleSummary, {
        reporter: 'json',
        output: jsonFile,
        silent: true,
      });

      expect(fs.existsSync(jsonFile)).toBe(true);
      const json = JSON.parse(await fs.promises.readFile(jsonFile, 'utf-8'));
      expect(json.totalRequests).toBe(2);
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses reporter list from various formats', () => {
    expect(parseReporterList()).toEqual(['console']);
    expect(parseReporterList('junit')).toEqual(['junit']);
    expect(parseReporterList('console,json,junit')).toEqual(['console', 'json', 'junit']);
    expect(parseReporterList(['console', 'junit'])).toEqual(['console', 'junit']);
  });
});

describe('Reqit CLI: End-to-End Execution with Local HTTP Server', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;
  let tmpCollectionDir: string;

  beforeAll(async () => {
    // Start test HTTP server
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

      if (url.pathname === '/hello') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'world', version: 1 }));
        return;
      }

      if (url.pathname === '/auth-check') {
        const auth = req.headers.authorization;
        if (auth === 'Bearer secret_token_value') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: true }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authorized: false }));
        }
        return;
      }

      if (url.pathname === '/set-cookie') {
        res.writeHead(200, {
          'Set-Cookie': 'auth_session=session_12345; Path=/',
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ status: 'cookie-set' }));
        return;
      }

      if (url.pathname === '/get-cookie') {
        const cookie = req.headers.cookie;
        if (cookie && cookie.includes('auth_session=session_12345')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ cookieFound: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ cookieFound: false }));
        }
        return;
      }

      if (url.pathname === '/slow') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ slow: true }));
        }, 300);
        return;
      }

      if (url.pathname === '/fail-endpoint') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
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

    // Setup temporary collection
    tmpCollectionDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-cli-e2e-'));
    await fs.promises.writeFile(
      path.join(tmpCollectionDir, 'reqit.yaml'),
      `version: 1\nname: E2E Test Collection\n`,
    );

    const envDir = path.join(tmpCollectionDir, 'environments');
    await fs.promises.mkdir(envDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(envDir, 'local.yaml'),
      `version: 1\nname: local\nvariables:\n  apiHost: "${baseUrl}"\n`,
    );

    // Request 1: basic GET with assertions
    await fs.promises.writeFile(
      path.join(tmpCollectionDir, '01-hello.yaml'),
      `version: 1
name: Hello Request
method: GET
url: "{{apiHost}}/hello"
tests:
  - name: Status is 200
    assert: "res.status === 200"
  - name: Message is world
    assert: "res.json().message === 'world'"
`,
    );

    // Folder: auth/
    const authFolder = path.join(tmpCollectionDir, 'auth');
    await fs.promises.mkdir(authFolder, { recursive: true });
    await fs.promises.writeFile(
      path.join(authFolder, 'folder.yaml'),
      `version: 1\nname: Auth Folder\n`,
    );

    // Request 2 (in auth folder): uses secret variable in auth header
    await fs.promises.writeFile(
      path.join(authFolder, '02-auth.yaml'),
      `version: 1
name: Auth Check
method: GET
url: "{{apiHost}}/auth-check"
headers:
  - name: Authorization
    value: "Bearer {{authToken}}"
tests:
  - name: Authorized is true
    assert: "res.json().authorized === true"
`,
    );

    // Request 3: Cookie jar step 1
    await fs.promises.writeFile(
      path.join(tmpCollectionDir, '03-set-cookie.yaml'),
      `version: 1
name: 01 - Set Cookie
method: GET
url: "{{apiHost}}/set-cookie"
tests:
  - name: Status is 200
    assert: "res.status === 200"
`,
    );

    // Request 4: Cookie jar step 2 (verifies cookie was sent)
    await fs.promises.writeFile(
      path.join(tmpCollectionDir, '04-get-cookie.yaml'),
      `version: 1
name: 02 - Get Cookie
method: GET
url: "{{apiHost}}/get-cookie"
tests:
  - name: Cookie found
    assert: "res.json().cookieFound === true"
`,
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (tmpCollectionDir) {
      await fs.promises.rm(tmpCollectionDir, { recursive: true, force: true });
    }
  });

  it('runs the full collection successfully with environment and REQIT_SECRET_* variable', async () => {
    process.env.REQIT_SECRET_authToken = 'secret_token_value';
    try {
      const summary = await runCollection(tmpCollectionDir, {
        env: 'local',
      });

      expect(summary.collectionName).toBe('E2E Test Collection');
      expect(summary.totalRequests).toBe(4);
      expect(summary.failedRequests).toBe(0);
      expect(summary.passedRequests).toBe(4);
      expect(summary.totalAssertions).toBe(5);
      expect(summary.failedAssertions).toBe(0);
      expect(summary.passedAssertions).toBe(5);
      expect(summary.success).toBe(true);
    } finally {
      delete process.env.REQIT_SECRET_authToken;
    }
  });

  it('executes a single request file directly', async () => {
    const singleReqPath = path.join(tmpCollectionDir, '01-hello.yaml');
    const summary = await runCollection(singleReqPath, {
      env: 'local',
    });

    expect(summary.totalRequests).toBe(1);
    expect(summary.passedRequests).toBe(1);
    expect(summary.results[0]?.name).toBe('Hello Request');
    expect(summary.results[0]?.assertions.length).toBe(2);
    expect(summary.success).toBe(true);
  });

  it('filters execution by folder name', async () => {
    process.env.REQIT_SECRET_authToken = 'secret_token_value';
    try {
      const summary = await runCollection(tmpCollectionDir, {
        env: 'local',
        folder: 'Auth Folder',
      });

      expect(summary.totalRequests).toBe(1);
      expect(summary.results[0]?.name).toBe('Auth Check');
      expect(summary.success).toBe(true);
    } finally {
      delete process.env.REQIT_SECRET_authToken;
    }
  });

  it('halts on first failure when --bail is set', async () => {
    const bailDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-cli-bail-'));
    try {
      await fs.promises.writeFile(
        path.join(bailDir, 'reqit.yaml'),
        `version: 1\nname: Bail Collection\n`,
      );

      // Request 1: fails
      await fs.promises.writeFile(
        path.join(bailDir, '01-fail.yaml'),
        `version: 1
name: Always Fail
method: GET
url: "${baseUrl}/hello"
tests:
  - name: Status is 500
    assert: "res.status === 500"
`,
      );

      // Request 2: passes
      await fs.promises.writeFile(
        path.join(bailDir, '02-pass.yaml'),
        `version: 1
name: Never Reached
method: GET
url: "${baseUrl}/hello"
`,
      );

      const summary = await runCollection(bailDir, {
        bail: true,
      });

      expect(summary.totalRequests).toBe(1);
      expect(summary.failedRequests).toBe(1);
      expect(summary.success).toBe(false);
      expect(summary.results[0]?.name).toBe('Always Fail');
    } finally {
      await fs.promises.rm(bailDir, { recursive: true, force: true });
    }
  });

  it('enforces request timeout', async () => {
    const timeoutReqPath = path.join(tmpCollectionDir, 'timeout.yaml');
    await fs.promises.writeFile(
      timeoutReqPath,
      `version: 1
name: Slow Timeout
method: GET
url: "${baseUrl}/slow"
`,
    );

    try {
      const summary = await runCollection(timeoutReqPath, {
        timeout: 50, // server takes 300ms, should timeout
      });

      expect(summary.totalRequests).toBe(1);
      expect(summary.failedRequests).toBe(1);
      expect(summary.success).toBe(false);
      expect(summary.results[0]?.error).toMatch(/timed out|timeout/i);
    } finally {
      await fs.promises.rm(timeoutReqPath, { force: true });
    }
  });
});
