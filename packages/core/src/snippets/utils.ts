import type { RequestFile } from '../format/types.js';
import { resolveRequest } from '../variables/request.js';
import type { EffectiveRequestData, SnippetOptions } from './types.js';

/**
 * Safely encodes a query parameter while preserving {{variable}} placeholders if present.
 */
export function safeEncodeParam(val: string): string {
  return encodeURIComponent(val)
    .replace(/%7B%7B/g, '{{')
    .replace(/%7D%7D/g, '}}');
}

/**
 * Safely decodes a URL component without throwing on malformed sequences.
 */
function decodeComponentSafe(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Splits a URL into base and query string parts, ignoring any '?' inside {{...}}.
 */
export function splitUrlQuery(url: string): { base: string; search: string } {
  let inDoubleBrace = false;
  for (let i = 0; i < url.length; i++) {
    if (url[i] === '{' && url[i + 1] === '{') {
      inDoubleBrace = true;
      i++;
    } else if (url[i] === '}' && url[i + 1] === '}') {
      inDoubleBrace = false;
      i++;
    } else if (url[i] === '?' && !inDoubleBrace) {
      return {
        base: url.slice(0, i),
        search: url.slice(i + 1),
      };
    }
  }
  return { base: url, search: '' };
}

/**
 * Constructs the full target URL, reconciling query parameters from request.url,
 * request.params, and auth (api-key-in-query) without duplicates.
 */
export function buildEffectiveUrl(request: RequestFile): string {
  const fullUrl = request.url || 'https://httpbin.org/get';

  const { base, search } = splitUrlQuery(fullUrl);

  // Parse existing query parameters from the URL string
  const finalParams: Array<{ name: string; value: string }> = [];
  if (search) {
    const rawPairs = search.split('&');
    for (const pair of rawPairs) {
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        finalParams.push({
          name: decodeComponentSafe(pair.slice(0, eqIdx)),
          value: decodeComponentSafe(pair.slice(eqIdx + 1)),
        });
      } else {
        finalParams.push({
          name: decodeComponentSafe(pair),
          value: '',
        });
      }
    }
  }

  // If request.params is provided, reconcile with URL query
  if (Array.isArray(request.params)) {
    // 1. Remove disabled params from the final query
    const disabledNames = new Set(
      request.params.filter(p => p.enabled === false && p.name).map(p => p.name),
    );

    if (disabledNames.size > 0) {
      for (let i = finalParams.length - 1; i >= 0; i--) {
        if (disabledNames.has(finalParams[i]!.name)) {
          finalParams.splice(i, 1);
        }
      }
    }

    // 2. Merge or update enabled params
    const enabledParams = request.params.filter(p => p.enabled !== false && p.name);
    for (const p of enabledParams) {
      const pName = p.name;
      const pVal = p.value ?? '';
      const existing = finalParams.find(ep => ep.name === pName);
      if (existing) {
        existing.value = pVal;
      } else {
        finalParams.push({ name: pName, value: pVal });
      }
    }
  }

  // 3. Auth API Key in query
  if (request.auth && typeof request.auth === 'object') {
    const a = request.auth as Record<string, unknown>;
    if (a.type === 'apikey') {
      const apiKeyObj = (a.apiKey as Record<string, unknown>) || a;
      if (apiKeyObj.in === 'query' && apiKeyObj.key && apiKeyObj.value) {
        const key = String(apiKeyObj.key);
        const val = String(apiKeyObj.value);
        const existing = finalParams.find(ep => ep.name === key);
        if (existing) {
          existing.value = val;
        } else {
          finalParams.push({ name: key, value: val });
        }
      }
    }
  }

  if (finalParams.length === 0) {
    return base;
  }

  const queryString = finalParams
    .map(p => `${safeEncodeParam(p.name)}=${safeEncodeParam(p.value)}`)
    .join('&');

  return `${base}?${queryString}`;
}

function toBase64(str: string): string {
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }
  return str;
}

/**
 * Normalizes a RequestFile into structured, sanitized EffectiveRequestData.
 */
export function getEffectiveRequestData(
  rawRequest: RequestFile,
  options?: SnippetOptions,
): EffectiveRequestData {
  const shouldResolve = options?.resolveVariables !== false;
  const request: RequestFile = shouldResolve
    ? resolveRequest(rawRequest, options?.scopes ?? {}, { allowUndefined: true })
    : rawRequest;

  const method = (request.method || 'GET').toUpperCase();
  const url = buildEffectiveUrl(request);

  const headers: Array<{ name: string; value: string }> = [];
  const existingHeaderNames = new Set<string>();

  if (Array.isArray(request.headers)) {
    for (const h of request.headers) {
      if (h.enabled !== false && h.name) {
        headers.push({ name: h.name, value: h.value ?? '' });
        existingHeaderNames.add(h.name.toLowerCase());
      }
    }
  }

  // Handle Authentication
  let bearerToken: string | undefined;
  let basicAuth: { username: string; password: string } | undefined;
  let apiKeyAuth: { key: string; value: string; in: 'header' | 'query' } | undefined;

  if (request.auth && typeof request.auth === 'object') {
    const a = request.auth as Record<string, unknown>;
    const authType = String(a.type || '');

    if (authType === 'bearer') {
      const token = (a.bearer as Record<string, unknown>)?.token ?? a.token;
      if (token) {
        bearerToken = String(token);
        if (!existingHeaderNames.has('authorization')) {
          headers.push({ name: 'Authorization', value: `Bearer ${bearerToken}` });
          existingHeaderNames.add('authorization');
        }
      }
    } else if (authType === 'oauth2') {
      const token = a.accessToken;
      if (token) {
        bearerToken = String(token);
        if (!existingHeaderNames.has('authorization')) {
          headers.push({ name: 'Authorization', value: `Bearer ${bearerToken}` });
          existingHeaderNames.add('authorization');
        }
      }
    } else if (authType === 'basic') {
      const username = String((a.basic as Record<string, unknown>)?.username ?? a.username ?? '');
      const password = String((a.basic as Record<string, unknown>)?.password ?? a.password ?? '');
      basicAuth = { username, password };
      if (!existingHeaderNames.has('authorization')) {
        const credentials = toBase64(`${username}:${password}`);
        headers.push({ name: 'Authorization', value: `Basic ${credentials}` });
        existingHeaderNames.add('authorization');
      }
    } else if (authType === 'apikey') {
      const apiKeyObj = (a.apiKey as Record<string, unknown>) || a;
      const inType = apiKeyObj.in === 'query' ? 'query' : 'header';
      const key = String(apiKeyObj.key || '');
      const value = String(apiKeyObj.value || '');
      apiKeyAuth = { key, value, in: inType };

      if (inType === 'header' && key) {
        if (!existingHeaderNames.has(key.toLowerCase())) {
          headers.push({ name: key, value });
          existingHeaderNames.add(key.toLowerCase());
        }
      }
    }
  }

  // Handle Body
  let bodyData: EffectiveRequestData['body'];

  if (request.body && request.body.type !== 'none') {
    const bType = request.body.type;

    if (bType === 'json') {
      const content = request.body.content || '';
      let jsonParsed: unknown = undefined;
      try {
        jsonParsed = JSON.parse(content);
      } catch {
        // May contain template placeholders or be raw text
      }

      if (!existingHeaderNames.has('content-type')) {
        headers.push({ name: 'Content-Type', value: 'application/json' });
        existingHeaderNames.add('content-type');
      }

      bodyData = {
        type: 'json',
        content,
        jsonParsed,
      };
    } else if (bType === 'form') {
      const formFields: Array<{ name: string; value: string }> = [];
      if (Array.isArray(request.body.form)) {
        for (const item of request.body.form) {
          if (item.enabled !== false && item.name) {
            formFields.push({ name: item.name, value: item.value ?? '' });
          }
        }
      }

      if (!existingHeaderNames.has('content-type')) {
        headers.push({ name: 'Content-Type', value: 'application/x-www-form-urlencoded' });
        existingHeaderNames.add('content-type');
      }

      bodyData = {
        type: 'form',
        form: formFields,
      };
    } else if (bType === 'multipart') {
      const formFields: Array<{ name: string; value: string; isFile?: boolean }> = [];
      if (Array.isArray(request.body.form)) {
        for (const item of request.body.form) {
          if (item.enabled !== false && item.name) {
            formFields.push({
              name: item.name,
              value: item.value ?? '',
              isFile: item.isFile === true,
            });
          }
        }
      }

      bodyData = {
        type: 'multipart',
        form: formFields,
      };
    } else if (bType === 'text') {
      const content = request.body.content || '';
      if (!existingHeaderNames.has('content-type')) {
        headers.push({ name: 'Content-Type', value: 'text/plain' });
        existingHeaderNames.add('content-type');
      }

      bodyData = {
        type: 'text',
        content,
      };
    }
  }

  return {
    method,
    url,
    headers,
    body: bodyData,
    auth: {
      type: request.auth?.type || 'none',
      bearer: bearerToken,
      basic: basicAuth,
      apiKey: apiKeyAuth,
    },
    followRedirects:
      typeof request.followRedirects === 'boolean' ? request.followRedirects : undefined,
    validateSsl: typeof request.validateSsl === 'boolean' ? request.validateSsl : undefined,
    timeoutMs: typeof request.timeoutMs === 'number' ? request.timeoutMs : undefined,
  };
}

/**
 * Escapes a string value for safe inclusion inside JavaScript/TypeScript double/single quotes.
 */
export function escapeJsString(str: string, quoteChar: "'" | '"' = "'"): string {
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');

  if (quoteChar === "'") {
    return `'${escaped.replace(/'/g, "\\'")}'`;
  }
  return `"${escaped.replace(/"/g, '\\"')}"`;
}

/**
 * Escapes a string for safe inclusion in Python string literals.
 */
export function escapePythonString(str: string): string {
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/**
 * Escapes a string for safe inclusion in Go string literals.
 */
export function escapeGoString(str: string): string {
  // If string contains no newlines or backticks, raw string literals `...` are clearest
  if (!str.includes('`') && (str.includes('\n') || str.includes('"'))) {
    return `\`${str}\``;
  }
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/**
 * Escapes a string for safe inclusion in Java string literals.
 */
export function escapeJavaString(str: string): string {
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}
