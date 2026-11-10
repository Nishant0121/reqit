import type { RequestFile } from '../format/types.js';
import type { CurlFormatOptions, ShellTarget } from './types.js';

/**
 * Escapes a string for the target shell.
 */
export function escapeShellArg(arg: string, target: ShellTarget = 'bash'): string {
  if (target === 'cmd') {
    // Windows cmd.exe: wrap in double quotes, escape double quotes with \"
    const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
    return `"${escaped}"`;
  }

  if (target === 'powershell') {
    // PowerShell: wrap in single quotes, escape single quote as ''
    const escaped = arg.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  // Default: bash / POSIX / macOS / Linux
  // Single quote string; escape internal single quotes as '\''
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * Generates a runnable cURL command string from a RequestFile.
 */
export function generateCurl(request: RequestFile, options?: CurlFormatOptions): string {
  const { target = 'bash', multiline = true, includeDefaults = false } = options || {};

  const continuation = target === 'cmd' ? ' ^\n  ' : target === 'powershell' ? ' `\n  ' : ' \\\n  ';
  const method = request.method ? request.method.toUpperCase() : 'GET';
  const hasBody =
    request.body &&
    request.body.type !== 'none' &&
    (Boolean(request.body.content) ||
      (Array.isArray(request.body.form) && request.body.form.length > 0));

  // 1. Build target URL with params if not already in URL
  let fullUrl = request.url || 'https://httpbin.org/get';
  if (request.params && Array.isArray(request.params) && request.params.length > 0) {
    try {
      const urlObj = new URL(fullUrl);
      for (const param of request.params) {
        if (param.enabled === false && param.name) {
          urlObj.searchParams.delete(param.name);
        } else if (param.name) {
          urlObj.searchParams.set(param.name, param.value ?? '');
        }
      }
      fullUrl = urlObj.toString();
    } catch {
      const qIdx = fullUrl.indexOf('?');
      const base = qIdx !== -1 ? fullUrl.slice(0, qIdx) : fullUrl;
      const search = qIdx !== -1 ? fullUrl.slice(qIdx + 1) : '';
      const pairs: Array<{ name: string; value: string }> = [];
      if (search) {
        for (const pair of search.split('&')) {
          if (!pair) continue;
          const eq = pair.indexOf('=');
          pairs.push({
            name: eq !== -1 ? pair.slice(0, eq) : pair,
            value: eq !== -1 ? pair.slice(eq + 1) : '',
          });
        }
      }
      for (const param of request.params) {
        if (param.enabled === false && param.name) {
          const idx = pairs.findIndex(p => p.name === param.name);
          if (idx !== -1) pairs.splice(idx, 1);
        } else if (param.name) {
          const safeName = encodeURIComponent(param.name)
            .replace(/%7B%7B/g, '{{')
            .replace(/%7D%7D/g, '}}');
          const safeVal = encodeURIComponent(param.value ?? '')
            .replace(/%7B%7B/g, '{{')
            .replace(/%7D%7D/g, '}}');
          const existing = pairs.find(p => p.name === safeName);
          if (existing) {
            existing.value = safeVal;
          } else {
            pairs.push({ name: safeName, value: safeVal });
          }
        }
      }
      fullUrl =
        pairs.length > 0 ? `${base}?${pairs.map(p => `${p.name}=${p.value}`).join('&')}` : base;
    }
  }

  // If Auth API Key in query
  if (request.auth && typeof request.auth === 'object') {
    const a = request.auth as Record<string, unknown>;
    if (a.type === 'apikey') {
      const apiKeyObj = (a.apiKey as Record<string, unknown>) || a;
      if (apiKeyObj.in === 'query' && apiKeyObj.key && apiKeyObj.value) {
        const joinChar = fullUrl.includes('?') ? '&' : '?';
        const safeKey = encodeURIComponent(String(apiKeyObj.key))
          .replace(/%7B%7B/g, '{{')
          .replace(/%7D%7D/g, '}}');
        const safeVal = encodeURIComponent(String(apiKeyObj.value))
          .replace(/%7B%7B/g, '{{')
          .replace(/%7D%7D/g, '}}');
        fullUrl += `${joinChar}${safeKey}=${safeVal}`;
      }
    }
  }

  // 2. Command base: curl [-X METHOD] <URL>
  const firstParts = ['curl'];
  if (method !== 'GET' || hasBody) {
    firstParts.push(`-X ${method}`);
  }
  firstParts.push(escapeShellArg(fullUrl, target));
  const firstLine = firstParts.join(' ');

  const otherParts: string[] = [];

  // 3. Headers
  const headers = request.headers ? [...request.headers] : [];
  const existingHeaderNames = new Set(headers.map(h => h.name.toLowerCase()));

  // Auth: Bearer / Basic / API Key in header
  if (request.auth && typeof request.auth === 'object') {
    const a = request.auth as Record<string, unknown>;
    if (a.type === 'bearer') {
      const token = (a.bearer as Record<string, unknown>)?.token || a.token;
      if (token && !existingHeaderNames.has('authorization')) {
        headers.push({ name: 'Authorization', value: `Bearer ${token}`, enabled: true });
        existingHeaderNames.add('authorization');
      }
    } else if (a.type === 'basic') {
      const username = (a.basic as Record<string, unknown>)?.username || a.username || '';
      const password = (a.basic as Record<string, unknown>)?.password || a.password || '';
      if (!existingHeaderNames.has('authorization')) {
        otherParts.push(`-u ${escapeShellArg(`${username}:${password}`, target)}`);
      }
    } else if (a.type === 'apikey') {
      const apiKeyObj = (a.apiKey as Record<string, unknown>) || a;
      const inType = apiKeyObj.in || 'header';
      if (inType === 'header' && apiKeyObj.key && apiKeyObj.value) {
        const key = String(apiKeyObj.key);
        if (!existingHeaderNames.has(key.toLowerCase())) {
          headers.push({ name: key, value: String(apiKeyObj.value), enabled: true });
          existingHeaderNames.add(key.toLowerCase());
        }
      }
    }
  }

  // Content-Type default from body
  if (request.body && request.body.type === 'json' && !existingHeaderNames.has('content-type')) {
    headers.push({ name: 'Content-Type', value: 'application/json', enabled: true });
    existingHeaderNames.add('content-type');
  }

  for (const h of headers) {
    if (h.enabled !== false && h.name) {
      otherParts.push(`-H ${escapeShellArg(`${h.name}: ${h.value ?? ''}`, target)}`);
    }
  }

  // 4. Body
  if (request.body && request.body.type !== 'none') {
    if (request.body.type === 'multipart' && Array.isArray(request.body.form)) {
      for (const field of request.body.form) {
        if (field.enabled !== false && field.name) {
          const val = field.isFile ? `@${field.value}` : field.value;
          otherParts.push(`-F ${escapeShellArg(`${field.name}=${val}`, target)}`);
        }
      }
    } else if (request.body.type === 'form' && Array.isArray(request.body.form)) {
      for (const field of request.body.form) {
        if (field.enabled !== false && field.name) {
          otherParts.push(
            `--data-urlencode ${escapeShellArg(`${field.name}=${field.value}`, target)}`,
          );
        }
      }
    } else if (typeof request.body.content === 'string' && request.body.content.length > 0) {
      otherParts.push(`-d ${escapeShellArg(request.body.content, target)}`);
    }
  }

  // 5. Flags (redirects, ssl, timeout, defaults)
  if (request.followRedirects === true) {
    otherParts.push('-L');
  }
  if (request.validateSsl === false) {
    otherParts.push('-k');
  }
  if (typeof request.timeoutMs === 'number' && request.timeoutMs > 0) {
    otherParts.push(`-m ${Math.round(request.timeoutMs / 1000)}`);
  }
  if (includeDefaults) {
    otherParts.push('--compressed');
  }

  if (otherParts.length === 0) {
    return firstLine;
  }

  if (multiline) {
    return `${firstLine}${continuation}${otherParts.join(continuation)}`;
  }

  return `${firstLine} ${otherParts.join(' ')}`;
}
