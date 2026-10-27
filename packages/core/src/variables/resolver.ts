import { UndefinedVariableError, VariableCycleError, VariableResolutionError } from './errors.js';
import { getMergedVariables } from './scopes.js';
import type { ResolveOptions, ScopeInput, ScopeVariableEntry } from './types.js';

function resolveInternal(
  str: string,
  mergedVars: Map<string, ScopeVariableEntry>,
  callStack: string[],
  options?: ResolveOptions,
): string {
  // Regex: match (\*)(\{\{([^{}]*)\}\})
  // Group 1: backslashes preceding the {{
  // Group 2: full {{...}} token
  // Group 3: variable name / expression inside braces (can be empty string for {{}})
  let replaced = str.replace(
    /(\\*)(\{\{([^{}]*)\}\})/g,
    (_match, slashes: string, _fullToken: string, varContent: string) => {
      const slashCount = slashes.length;
      const preservedSlashes = '\\'.repeat(Math.floor(slashCount / 2));

      // Odd number of backslashes: this {{ was escaped
      if (slashCount % 2 === 1) {
        return preservedSlashes + '{{' + varContent + '}}';
      }

      // Even number of backslashes: variable is unescaped
      const varName = varContent.trim();
      if (!varName) {
        throw new VariableResolutionError('Empty variable name in template');
      }

      const resolvedValue = resolveVariable(varName, mergedVars, callStack, options);
      return preservedSlashes + resolvedValue;
    },
  );

  // Unescape any dangling \{{ that had no matching }} (negative lookahead for unescaped closing braces)
  replaced = replaced.replace(/(\\+)\{\{(?![^{}]*\}\})/g, (match, slashes: string) => {
    const slashCount = slashes.length;
    const preservedSlashes = '\\'.repeat(Math.floor(slashCount / 2));
    if (slashCount % 2 === 1) {
      return preservedSlashes + '{{';
    }
    return match;
  });

  return replaced;
}

function resolveVariable(
  varName: string,
  mergedVars: Map<string, ScopeVariableEntry>,
  callStack: string[],
  options?: ResolveOptions,
): string {
  // 1. Cycle detection: check if varName is already in the active call stack
  const existingIndex = callStack.indexOf(varName);
  if (existingIndex !== -1) {
    const cycleChain = [...callStack.slice(existingIndex), varName];
    throw new VariableCycleError(cycleChain);
  }

  // 2. Undefined variable check
  const entry = mergedVars.get(varName);
  if (!entry || entry.value === undefined) {
    throw new UndefinedVariableError(varName);
  }

  // 3. Resolve the value with varName pushed to active callStack
  const nextCallStack = [...callStack, varName];
  const rawValue = entry.value;

  if (typeof rawValue === 'string') {
    return resolveInternal(rawValue, mergedVars, nextCallStack, options);
  }

  if (rawValue === null) {
    return 'null';
  }

  if (typeof rawValue === 'object') {
    return JSON.stringify(rawValue);
  }

  return String(rawValue);
}

/**
 * Resolves all {{variable}} placeholders in the given template string
 * using the provided scopes according to priority.
 *
 * Scopes priority order (lowest to highest):
 * collection -> folder -> environment -> secrets -> runtime
 *
 * Supports:
 * - Nested variable references (variables referencing other variables)
 * - Cycle detection with informative chain error reporting
 * - Strict undefined variable reporting (throws an error naming the variable)
 * - Escaped syntax via \{{ (renders literal {{...}} without resolving)
 */
export function resolve(template: string, scopes: ScopeInput, options?: ResolveOptions): string {
  if (typeof template !== 'string') {
    return String(template ?? '');
  }

  if (template === '') {
    return '';
  }

  const mergedVars = getMergedVariables(scopes, options);
  const initialCallStack = options?.callStack ?? [];

  return resolveInternal(template, mergedVars, initialCallStack, options);
}
