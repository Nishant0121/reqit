import type { EnvironmentFile, SecretsFile } from '../format/types.js';
import type { PostmanEnvironmentV21 } from './types.js';
import { parseAllJsonObjects } from './json-utils.js';

const SENSITIVE_KEY_REGEX =
  /secret|password|token|apikey|api[_-]?key|auth|bearer|private|credential/i;

/**
 * Checks whether a key is sensitive based on name heuristic or Postman type.
 */
export function isSecretVariable(key: string, type?: string): boolean {
  if (type === 'secret') {
    return true;
  }
  return SENSITIVE_KEY_REGEX.test(key);
}

export interface ParseEnvironmentResult {
  environment: EnvironmentFile;
  secrets?: SecretsFile;
  reportNotes: {
    warnings: string[];
    secretCount: number;
    variableCount: number;
  };
}

/**
 * Parses a Postman Environment JSON string or object into a Reqit EnvironmentFile
 * and isolates sensitive/secret variables into a SecretsFile.
 */
export function parsePostmanEnvironment(
  rawInput: string | PostmanEnvironmentV21,
): ParseEnvironmentResult {
  let envObj: PostmanEnvironmentV21;

  if (typeof rawInput === 'string') {
    const candidates = parseAllJsonObjects(rawInput);
    if (candidates.length === 0) {
      throw new Error('Invalid Postman environment format: content is empty.');
    }
    const envCandidate = candidates.find(
      c => c && typeof c === 'object' && Array.isArray((c as Record<string, unknown>).values),
    );
    envObj = (envCandidate || candidates[0]) as PostmanEnvironmentV21;
  } else {
    envObj = rawInput;
  }

  if (!envObj || typeof envObj !== 'object') {
    throw new Error('Invalid Postman environment format: root must be a JSON object.');
  }

  const envName = (envObj.name || 'imported-environment').trim();
  const rawValues = Array.isArray(envObj.values) ? envObj.values : [];

  const variables: Record<string, string> = {};
  const secretEntries: Record<string, string> = {};
  const warnings: string[] = [];

  for (const item of rawValues) {
    if (!item || typeof item !== 'object' || !item.key) {
      continue;
    }

    if (item.enabled === false) {
      // Skipped / disabled environment variable
      continue;
    }

    const key = String(item.key).trim();
    const strVal = item.value !== undefined && item.value !== null ? String(item.value) : '';

    // Flag unsupported Postman dynamic variables in environment values
    const dynamicMatches = strVal.match(/\{\{\s*(\$[a-zA-Z0-9_]+)\s*\}\}/g);
    if (dynamicMatches) {
      warnings.push(
        `Environment "${envName}" variable "${key}" contains dynamic variable ${dynamicMatches.join(', ')}.`,
      );
    }

    if (isSecretVariable(key, item.type)) {
      secretEntries[key] = strVal;
    } else {
      variables[key] = strVal;
    }
  }

  const environment: EnvironmentFile = {
    version: 1,
    name: envName,
    variables,
  };

  let secrets: SecretsFile | undefined = undefined;
  const secretCount = Object.keys(secretEntries).length;

  if (secretCount > 0) {
    secrets = {
      version: 1,
      environments: {
        [envName]: secretEntries,
      },
    };
  }

  return {
    environment,
    secrets,
    reportNotes: {
      warnings,
      secretCount,
      variableCount: Object.keys(variables).length,
    },
  };
}
