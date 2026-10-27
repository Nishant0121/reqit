import type { Auth, KeyValue } from '../format/types.js';

export function normalizeUrlString(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (trimmed.startsWith('//')) {
    trimmed = 'http:' + trimmed;
  } else if (!/^https?:\/\//i.test(trimmed)) {
    // If no protocol is specified, default to http://
    trimmed = 'http://' + trimmed;
  }
  return trimmed;
}

export function buildTargetUrl(rawUrl: string, params?: KeyValue[], auth?: Auth): URL {
  const normalized = normalizeUrlString(rawUrl);
  const url = new URL(normalized);

  // Append query params (skipping disabled ones)
  if (params && Array.isArray(params)) {
    for (const param of params) {
      if (param.enabled !== false && param.name) {
        url.searchParams.append(param.name, param.value ?? '');
      }
    }
  }

  // Handle apiKey in query
  if (auth && auth.type === 'apikey' && 'in' in auth && auth.in === 'query') {
    const key = typeof auth.key === 'string' ? auth.key : '';
    const val = typeof auth.value === 'string' ? auth.value : '';
    if (key) {
      url.searchParams.append(key, val);
    }
  }

  return url;
}
