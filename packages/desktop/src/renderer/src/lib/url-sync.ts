import type { KeyValueRow } from '../components/ui/KeyValueTable';

/**
 * Parses query parameters from a URL string, reconciling with existing rows
 * to preserve row IDs, disabled states, and descriptions where appropriate.
 */
export function parseUrlQueryParams(
  url: string,
  existingParams: KeyValueRow[] = [],
): KeyValueRow[] {
  const queryIndex = findQueryStartIndex(url);
  if (queryIndex === -1) {
    // No query string in URL: retain existing disabled rows if any, or return empty
    return existingParams.filter(p => !p.enabled && p.key.trim() !== '');
  }

  // Extract query string up to '#' if present
  let queryString = url.slice(queryIndex + 1);
  const hashIndex = queryString.indexOf('#');
  if (hashIndex !== -1) {
    queryString = queryString.slice(0, hashIndex);
  }

  if (!queryString.trim()) {
    return existingParams.filter(p => !p.enabled && p.key.trim() !== '');
  }

  const pairs = queryString.split('&');
  const result: KeyValueRow[] = [];

  // Index existing params to preserve IDs and descriptions
  const existingPool = [...existingParams];

  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    let key = '';
    let value = '';

    if (eqIdx !== -1) {
      key = decodeComponentSafe(pair.slice(0, eqIdx));
      value = decodeComponentSafe(pair.slice(eqIdx + 1));
    } else {
      key = decodeComponentSafe(pair);
      value = '';
    }

    // Check if we can reuse an existing enabled row matching key
    const foundIdx = existingPool.findIndex(p => p.enabled && p.key === key);
    if (foundIdx !== -1) {
      const existing = existingPool.splice(foundIdx, 1)[0]!;
      result.push({
        ...existing,
        value,
      });
    } else {
      result.push({
        id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        enabled: true,
        key,
        value,
      });
    }
  }

  // Preserve any previously disabled params from existing rows
  const disabledRows = existingPool.filter(p => !p.enabled && p.key.trim() !== '');
  result.push(...disabledRows);

  return result;
}

/**
 * Reconstructs a URL string by applying the enabled query parameters.
 */
export function syncUrlWithParams(currentUrl: string, params: KeyValueRow[]): string {
  const queryIndex = findQueryStartIndex(currentUrl);
  let base = currentUrl;
  let hash = '';

  const hashIndex = currentUrl.indexOf('#');
  if (hashIndex !== -1) {
    hash = currentUrl.slice(hashIndex);
  }

  if (queryIndex !== -1) {
    base = currentUrl.slice(0, queryIndex);
  } else if (hashIndex !== -1) {
    base = currentUrl.slice(0, hashIndex);
  }

  const enabledParams = params.filter(p => p.enabled && p.key.trim() !== '');
  if (enabledParams.length === 0) {
    return `${base}${hash}`;
  }

  const queryString = enabledParams
    .map(p => {
      const k = encodeComponentSafe(p.key);
      const v = encodeComponentSafe(p.value);
      return `${k}=${v}`;
    })
    .join('&');

  return `${base}?${queryString}${hash}`;
}

/**
 * Finds the index of '?' that starts the query parameters,
 * ignoring any '?' inside variable expressions like '{{...}}'.
 */
function findQueryStartIndex(url: string): number {
  let inDoubleBrace = false;
  for (let i = 0; i < url.length; i++) {
    if (url[i] === '{' && url[i + 1] === '{') {
      inDoubleBrace = true;
      i++;
    } else if (url[i] === '}' && url[i + 1] === '}') {
      inDoubleBrace = false;
      i++;
    } else if (url[i] === '?' && !inDoubleBrace) {
      return i;
    }
  }
  return -1;
}

/**
 * Safe component encoding that preserves template variables like {{userId}}
 */
function encodeComponentSafe(str: string): string {
  if (str.includes('{{') && str.includes('}}')) {
    // If it contains template variables, don't mangle the braces
    return str.replace(/ /g, '%20');
  }
  return encodeURIComponent(str);
}

/**
 * Safe component decoding
 */
function decodeComponentSafe(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}
