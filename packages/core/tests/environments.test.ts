import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCollection,
  deleteEnvironment,
  detectHardcodedSecrets,
  ensureSecretsGitignored,
  loadEnvironments,
  loadSecrets,
  saveEnvironment,
  saveSecrets,
  type EnvironmentFile,
  type SecretsFile,
} from '../src/index.js';

describe('Environments and Secrets (Phase 11)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-env-test-'));
    await createCollection(tmpDir, 'Env Test Col');
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('saves, loads, and deletes environments', async () => {
    const devEnv: EnvironmentFile = {
      version: 1,
      name: 'dev',
      variables: {
        baseUrl: 'https://dev.api.example.com',
        apiKey: 'dev-key',
      },
    };

    const savedPath = await saveEnvironment(tmpDir, 'dev', devEnv);
    expect(fs.existsSync(savedPath)).toBe(true);

    const loaded = await loadEnvironments(tmpDir);
    expect(loaded['dev']).toBeDefined();
    expect(loaded['dev']?.variables['baseUrl']).toBe('https://dev.api.example.com');

    // Delete environment
    const deleted = await deleteEnvironment(tmpDir, 'dev');
    expect(deleted).toBe(true);

    const afterDelete = await loadEnvironments(tmpDir);
    expect(afterDelete['dev']).toBeUndefined();
  });

  it('saves and loads secrets from .reqit/secrets.yaml', async () => {
    const secrets: SecretsFile = {
      version: 1,
      environments: {
        dev: {
          secretToken: 'secret-token-123',
        },
      },
    };

    const savedPath = await saveSecrets(tmpDir, secrets);
    expect(fs.existsSync(savedPath)).toBe(true);
    expect(savedPath).toContain('.reqit');

    const loaded = await loadSecrets(tmpDir);
    expect(loaded).toBeDefined();
    expect(loaded?.environments['dev']?.['secretToken']).toBe('secret-token-123');
  });

  it('adds .reqit/secrets.yaml to .gitignore and creates starter secrets file', async () => {
    // 1. First run on repo without .gitignore
    const res1 = await ensureSecretsGitignored(tmpDir);
    expect(res1.gitignoreCreated).toBe(true);
    expect(res1.added).toBe(true);
    expect(res1.secretsCreated).toBe(true);

    const gitignoreContent = await fs.promises.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignoreContent).toContain('.reqit/secrets.yaml');

    const secretsPath = path.join(tmpDir, '.reqit', 'secrets.yaml');
    expect(fs.existsSync(secretsPath)).toBe(true);

    // 2. Second run: already ignored, should not duplicate rule
    const res2 = await ensureSecretsGitignored(tmpDir);
    expect(res2.gitignoreCreated).toBe(false);
    expect(res2.added).toBe(false);
    expect(res2.secretsCreated).toBe(false);
  });

  it('appends .reqit/secrets.yaml to existing .gitignore', async () => {
    await fs.promises.writeFile(path.join(tmpDir, '.gitignore'), 'node_modules/\n*.log\n', 'utf-8');

    const res = await ensureSecretsGitignored(tmpDir);
    expect(res.gitignoreCreated).toBe(false);
    expect(res.added).toBe(true);

    const content = await fs.promises.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.reqit/secrets.yaml');
  });

  it('detects hardcoded tokens in request file', () => {
    // JWT token in auth bearer
    const reqWithJwt = {
      version: 1,
      name: 'Hardcoded JWT',
      method: 'GET' as const,
      url: 'https://api.example.com',
      auth: {
        type: 'bearer' as const,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozGzN_ce_sample',
      },
    };
    const findings1 = detectHardcodedSecrets(reqWithJwt);
    expect(findings1.length).toBeGreaterThan(0);
    expect(findings1[0]?.field).toBe('auth.token');

    // GitHub token in headers
    const reqWithGhToken = {
      version: 1,
      name: 'Hardcoded GHP',
      method: 'GET' as const,
      url: 'https://api.github.com',
      headers: [{ name: 'Authorization', value: 'ghp_123456789012345678901234567890123456' }],
    };
    const findings2 = detectHardcodedSecrets(reqWithGhToken);
    expect(findings2.length).toBeGreaterThan(0);
    expect(findings2[0]?.field).toContain('Authorization');

    // Variable reference should NOT be flagged as hardcoded
    const reqWithVar = {
      version: 1,
      name: 'Safe Variable',
      method: 'GET' as const,
      url: 'https://api.example.com',
      auth: {
        type: 'bearer' as const,
        token: '{{authToken}}',
      },
    };
    const findings3 = detectHardcodedSecrets(reqWithVar);
    expect(findings3.length).toBe(0);
  });
});
