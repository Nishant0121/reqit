import type { SecretsFile } from '../format/types.js';
import type {
  ResolveOptions,
  ScopeInput,
  ScopeName,
  ScopeVariableEntry,
  VariableMap,
  VariableScopes,
} from './types.js';
import { SCOPE_PRIORITY } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractVariablesFromScopeValue(
  val: unknown,
  scopeName: string,
  options?: ResolveOptions,
): VariableMap {
  if (!isPlainObject(val)) {
    return {};
  }

  // Check if it's an EnvironmentFile
  if ('variables' in val && isPlainObject(val.variables)) {
    return val.variables as VariableMap;
  }

  // Check if it's a SecretsFile
  if ('environments' in val && isPlainObject(val.environments)) {
    const secrets = val as unknown as SecretsFile;
    const activeEnv = options?.activeEnvironment;
    if (activeEnv && secrets.environments[activeEnv]) {
      return secrets.environments[activeEnv] as VariableMap;
    }
    const envKeys = Object.keys(secrets.environments);
    if (envKeys.length === 1 && envKeys[0] && secrets.environments[envKeys[0]]) {
      return secrets.environments[envKeys[0]] as VariableMap;
    }
    return {};
  }

  // Check if it's a CollectionFile with defaults.variables
  if (
    'defaults' in val &&
    isPlainObject(val.defaults) &&
    'variables' in (val.defaults as Record<string, unknown>)
  ) {
    const defaults = val.defaults as Record<string, unknown>;
    if (isPlainObject(defaults.variables)) {
      return defaults.variables as VariableMap;
    }
  }

  // If it's a FolderFile with a variables field
  if ('variables' in val && isPlainObject(val.variables)) {
    return val.variables as VariableMap;
  }

  return val as VariableMap;
}

export function isVariableScopesObject(obj: unknown): obj is VariableScopes {
  if (!isPlainObject(obj)) return false;
  return Object.entries(obj).some(
    ([k, v]) => SCOPE_PRIORITY.includes(k as ScopeName) && isPlainObject(v),
  );
}

/**
 * Returns all merged variables as a Map of variable names to their entry,
 * strictly respecting scope priority:
 * collection < folder < environment < secrets < runtime.
 * Higher-priority scopes override lower ones.
 */
export function getMergedVariables(
  scopes: ScopeInput,
  options?: ResolveOptions,
): Map<string, ScopeVariableEntry> {
  const merged = new Map<string, ScopeVariableEntry>();

  if (Array.isArray(scopes)) {
    // Array order: later scopes override earlier scopes
    scopes.forEach((scopeMap, index) => {
      if (isPlainObject(scopeMap)) {
        for (const [key, value] of Object.entries(scopeMap)) {
          merged.set(key, {
            name: key,
            value,
            scope: `scope[${index}]`,
          });
        }
      }
    });
    return merged;
  }

  if (isVariableScopesObject(scopes)) {
    // 1. Process known scopes in strict priority order
    for (const scopeName of SCOPE_PRIORITY) {
      const scopeData = scopes[scopeName];
      if (scopeData) {
        const vars = extractVariablesFromScopeValue(scopeData, scopeName, options);
        for (const [key, value] of Object.entries(vars)) {
          merged.set(key, {
            name: key,
            value,
            scope: scopeName,
          });
        }
      }
    }

    // 2. Any additional custom scopes in scopes (treated between collection and runtime if not already added)
    for (const [scopeName, scopeData] of Object.entries(scopes)) {
      if (!SCOPE_PRIORITY.includes(scopeName as ScopeName) && isPlainObject(scopeData)) {
        const vars = extractVariablesFromScopeValue(scopeData, scopeName, options);
        for (const [key, value] of Object.entries(vars)) {
          merged.set(key, {
            name: key,
            value,
            scope: scopeName,
          });
        }
      }
    }

    return merged;
  }

  // Plain flat variable dictionary
  if (isPlainObject(scopes)) {
    for (const [key, value] of Object.entries(scopes)) {
      merged.set(key, {
        name: key,
        value,
        scope: 'runtime',
      });
    }
  }

  return merged;
}

/**
 * Returns a flat Record<string, unknown> of the merged scopes.
 */
export function flattenScopes(
  scopes: ScopeInput,
  options?: ResolveOptions,
): Record<string, unknown> {
  const merged = getMergedVariables(scopes, options);
  const result: Record<string, unknown> = {};
  for (const [k, entry] of merged) {
    result[k] = entry.value;
  }
  return result;
}
