import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnvironment, parseSecrets } from '../format/parser.js';
import { serializeEnvironment, serializeSecrets } from '../format/serializer.js';
import type { EnvironmentFile, SecretsFile } from '../format/types.js';
import { detectHardcodedSecrets, type HardcodedSecretFinding } from '../format/secrets-detector.js';

export { detectHardcodedSecrets, type HardcodedSecretFinding };

export const ENVIRONMENTS_DIR = 'environments';
export const REQIT_DIR = '.reqit';
export const SECRETS_FILE = 'secrets.yaml';

export interface GitignoreResult {
  gitignoreCreated: boolean;
  added: boolean;
  secretsCreated: boolean;
}

/**
 * Loads all environment definitions (*.yaml / *.yml) from the `environments/` directory.
 */
export async function loadEnvironments(rootPath: string): Promise<Record<string, EnvironmentFile>> {
  const envDir = path.join(path.resolve(rootPath), ENVIRONMENTS_DIR);
  const result: Record<string, EnvironmentFile> = {};

  if (!fs.existsSync(envDir)) {
    return result;
  }

  const entries = await fs.promises.readdir(envDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.yaml' && ext !== '.yml') continue;

    const fullPath = path.join(envDir, entry.name);
    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const envData = parseEnvironment(content, fullPath);
      const key = envData.name || path.basename(entry.name, ext);
      result[key] = envData;
    } catch {
      // Ignore corrupt environment files during scan
    }
  }

  return result;
}

/**
 * Saves an environment file to `environments/<name>.yaml`.
 */
export async function saveEnvironment(
  rootPath: string,
  name: string,
  data: EnvironmentFile,
): Promise<string> {
  const envDir = path.join(path.resolve(rootPath), ENVIRONMENTS_DIR);
  await fs.promises.mkdir(envDir, { recursive: true });

  const safeName =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-') || 'default';
  const filePath = path.join(envDir, `${safeName}.yaml`);

  const serialized = serializeEnvironment(data);
  await fs.promises.writeFile(filePath, serialized, 'utf-8');

  return filePath;
}

/**
 * Deletes an environment file from `environments/`.
 */
export async function deleteEnvironment(rootPath: string, name: string): Promise<boolean> {
  const envDir = path.join(path.resolve(rootPath), ENVIRONMENTS_DIR);
  if (!fs.existsSync(envDir)) return false;

  const entries = await fs.promises.readdir(envDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.yaml' && ext !== '.yml') continue;

    const fullPath = path.join(envDir, entry.name);
    const basename = path.basename(entry.name, ext);

    if (basename.toLowerCase() === name.toLowerCase()) {
      await fs.promises.unlink(fullPath);
      return true;
    }

    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const envData = parseEnvironment(content, fullPath);
      if (envData.name.toLowerCase() === name.toLowerCase()) {
        await fs.promises.unlink(fullPath);
        return true;
      }
    } catch {
      // continue
    }
  }

  return false;
}

/**
 * Loads the secrets file from `.reqit/secrets.yaml`.
 */
export async function loadSecrets(rootPath: string): Promise<SecretsFile | null> {
  const secretsPath = path.join(path.resolve(rootPath), REQIT_DIR, SECRETS_FILE);
  if (!fs.existsSync(secretsPath)) {
    return null;
  }

  try {
    const content = await fs.promises.readFile(secretsPath, 'utf-8');
    return parseSecrets(content, secretsPath);
  } catch {
    return null;
  }
}

/**
 * Saves the secrets file to `.reqit/secrets.yaml`.
 */
export async function saveSecrets(rootPath: string, data: SecretsFile): Promise<string> {
  const reqitDir = path.join(path.resolve(rootPath), REQIT_DIR);
  await fs.promises.mkdir(reqitDir, { recursive: true });

  const filePath = path.join(reqitDir, SECRETS_FILE);
  const serialized = serializeSecrets(data);
  await fs.promises.writeFile(filePath, serialized, 'utf-8');

  return filePath;
}

/**
 * Ensures `.reqit/secrets.yaml` is added to `.gitignore` and creates the starter secrets file.
 */
export async function ensureSecretsGitignored(rootPath: string): Promise<GitignoreResult> {
  const resolved = path.resolve(rootPath);
  const gitignorePath = path.join(resolved, '.gitignore');
  const reqitDir = path.join(resolved, REQIT_DIR);
  const secretsPath = path.join(reqitDir, SECRETS_FILE);

  let gitignoreCreated = false;
  let added = false;
  let secretsCreated = false;

  // 1. Check or create .gitignore
  const gitignoreRule = '.reqit/secrets.yaml';
  if (!fs.existsSync(gitignorePath)) {
    await fs.promises.writeFile(
      gitignorePath,
      `# Reqit secrets (never commit to git)\n${gitignoreRule}\n`,
      'utf-8',
    );
    gitignoreCreated = true;
    added = true;
  } else {
    const existing = await fs.promises.readFile(gitignorePath, 'utf-8');
    const lines = existing.split('\n').map(l => l.trim());
    const isIgnored = lines.some(
      line =>
        line === gitignoreRule || line === '.reqit/' || line === '.reqit' || line === '.reqit/*',
    );

    if (!isIgnored) {
      const updated = existing.endsWith('\n')
        ? `${existing}\n# Reqit secrets (never commit to git)\n${gitignoreRule}\n`
        : `${existing}\n\n# Reqit secrets (never commit to git)\n${gitignoreRule}\n`;
      await fs.promises.writeFile(gitignorePath, updated, 'utf-8');
      added = true;
    }
  }

  // 2. Check or create .reqit/secrets.yaml
  await fs.promises.mkdir(reqitDir, { recursive: true });
  if (!fs.existsSync(secretsPath)) {
    const initialSecrets: SecretsFile = {
      version: 1,
      environments: {},
    };
    await fs.promises.writeFile(secretsPath, serializeSecrets(initialSecrets), 'utf-8');
    secretsCreated = true;
  }

  return { gitignoreCreated, added, secretsCreated };
}
