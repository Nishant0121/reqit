import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  loadEnvironments,
  loadSecrets,
  parseSecrets,
  type EnvironmentFile,
  type SecretsFile,
  type VariableScopes,
} from '@reqit/core';

export const ENV_SECRET_PREFIX = 'REQIT_SECRET_';

/**
 * Extracts secrets from system environment variables prefixed with REQIT_SECRET_.
 * Example: REQIT_SECRET_token="abc123" -> { token: "abc123" }
 */
export function getEnvVarSecrets(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const secrets: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(ENV_SECRET_PREFIX) && typeof value === 'string') {
      const varName = key.slice(ENV_SECRET_PREFIX.length);
      if (varName) {
        secrets[varName] = value;
      }
    }
  }

  return secrets;
}

export interface ResolvedCollectionScopes {
  environmentName?: string;
  scopes: VariableScopes;
  rawEnvironment?: EnvironmentFile;
}

/**
 * Resolves the full variable scopes for a CLI run session.
 */
export async function resolveCliScopes(
  collectionRoot: string,
  options: {
    envName?: string;
    secretsPath?: string;
  } = {},
): Promise<ResolvedCollectionScopes> {
  const { envName, secretsPath } = options;

  // 1. Environments
  const availableEnvironments = await loadEnvironments(collectionRoot);
  let activeEnvFile: EnvironmentFile | undefined = undefined;

  if (envName) {
    activeEnvFile = availableEnvironments[envName];
    if (!activeEnvFile) {
      // Try case-insensitive or by env.name matching
      for (const env of Object.values(availableEnvironments)) {
        if (env.name.toLowerCase() === envName.toLowerCase()) {
          activeEnvFile = env;
          break;
        }
      }
    }

    if (!activeEnvFile) {
      const known = Object.keys(availableEnvironments);
      const hint =
        known.length > 0
          ? `Available environments: ${known.join(', ')}`
          : 'No environments found in environments/';
      throw new Error(`Environment "${envName}" not found. ${hint}`);
    }
  }

  const envVariables: Record<string, string> = activeEnvFile?.variables
    ? { ...activeEnvFile.variables }
    : {};

  // 2. Secrets from file (.reqit/secrets.yaml or custom --secrets file)
  let fileSecrets: SecretsFile | null = null;

  if (secretsPath) {
    const resolvedPath = path.resolve(secretsPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Specified secrets file not found: ${secretsPath}`);
    }
    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    fileSecrets = parseSecrets(content, resolvedPath);
  } else {
    fileSecrets = await loadSecrets(collectionRoot);
  }

  // Extract secrets for active environment (or default single env)
  const secretsVars: Record<string, string> = {};
  if (fileSecrets?.environments) {
    if (envName && fileSecrets.environments[envName]) {
      Object.assign(secretsVars, fileSecrets.environments[envName]);
    } else {
      const envKeys = Object.keys(fileSecrets.environments);
      if (envKeys.length === 1 && envKeys[0] && fileSecrets.environments[envKeys[0]]) {
        Object.assign(secretsVars, fileSecrets.environments[envKeys[0]]);
      }
    }
  }

  // 3. Environment variable secrets (REQIT_SECRET_*) take highest precedence for CI
  const envVarSecrets = getEnvVarSecrets();
  Object.assign(secretsVars, envVarSecrets);

  const scopes: VariableScopes = {
    environment: envVariables,
    secrets: secretsVars,
    runtime: {},
  };

  return {
    environmentName: activeEnvFile?.name || envName,
    scopes,
    rawEnvironment: activeEnvFile,
  };
}
