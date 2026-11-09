import type { Cookie } from '../format/types.js';

/**
 * Normalizes domain by trimming, lowercasing, and stripping leading dot.
 */
export function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  if (d.startsWith('.')) {
    d = d.slice(1);
  }
  return d;
}

/**
 * Normalizes cookie path according to RFC 6265.
 */
export function normalizePath(cookiePath?: string, defaultUrlPath = '/'): string {
  if (!cookiePath || !cookiePath.startsWith('/')) {
    // RFC 6265 default path extraction
    if (!defaultUrlPath || defaultUrlPath === '/' || !defaultUrlPath.startsWith('/')) {
      return '/';
    }
    const lastSlash = defaultUrlPath.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '/';
    }
    return defaultUrlPath.slice(0, lastSlash);
  }
  return cookiePath;
}

/**
 * Checks whether cookie has expired based on current timestamp.
 */
export function isCookieExpired(cookie: Cookie, now = Date.now()): boolean {
  if (!cookie.expires) {
    return false; // session cookie
  }
  const expTime = new Date(cookie.expires).getTime();
  return !isNaN(expTime) && expTime <= now;
}

/**
 * RFC 6265 Domain matching algorithm.
 */
export function domainMatch(cookieDomain: string, requestHost: string, hostOnly = false): boolean {
  const cDomain = normalizeDomain(cookieDomain);
  const rHost = normalizeDomain(requestHost);

  if (hostOnly) {
    return cDomain === rHost;
  }

  if (cDomain === rHost) {
    return true;
  }

  // Domain suffix match (e.g. host "api.example.com" matches cookie domain "example.com")
  return rHost.endsWith('.' + cDomain);
}

/**
 * RFC 6265 Path matching algorithm.
 */
export function pathMatch(cookiePath: string, requestPath: string): boolean {
  const cPath = cookiePath || '/';
  const rPath = requestPath || '/';

  if (cPath === rPath) {
    return true;
  }

  if (rPath.startsWith(cPath)) {
    if (cPath.endsWith('/')) {
      return true;
    }
    if (rPath.charAt(cPath.length) === '/') {
      return true;
    }
  }

  return false;
}

/**
 * Parses a Set-Cookie header string into a structured Cookie object.
 */
export function parseSetCookie(header: string, requestUrl: string): Cookie | null {
  if (!header || !header.trim()) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  const parts = header
    .split(';')
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const firstPart = parts[0]!;
  const eqIdx = firstPart.indexOf('=');
  if (eqIdx <= 0) {
    return null;
  }

  const name = firstPart.slice(0, eqIdx).trim();
  const value = firstPart.slice(eqIdx + 1).trim();
  if (!name) return null;

  let domain = '';
  let path = '';
  let expires: string | undefined = undefined;
  let maxAge: number | undefined = undefined;
  let secure = false;
  let httpOnly = false;
  let sameSite: 'Strict' | 'Lax' | 'None' | undefined = undefined;
  let hostOnly = true;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    const separatorIdx = part.indexOf('=');
    const key = (separatorIdx >= 0 ? part.slice(0, separatorIdx) : part).trim().toLowerCase();
    const val = separatorIdx >= 0 ? part.slice(separatorIdx + 1).trim() : '';

    switch (key) {
      case 'domain':
        if (val) {
          domain = normalizeDomain(val);
          hostOnly = false;
        }
        break;
      case 'path':
        if (val) {
          path = val;
        }
        break;
      case 'expires':
        if (val && maxAge === undefined) {
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            expires = parsed.toISOString();
          }
        }
        break;
      case 'max-age': {
        const seconds = parseInt(val, 10);
        if (!isNaN(seconds)) {
          maxAge = seconds;
          expires = new Date(Date.now() + seconds * 1000).toISOString();
        }
        break;
      }
      case 'secure':
        secure = true;
        break;
      case 'httponly':
        httpOnly = true;
        break;
      case 'samesite': {
        const lowerVal = val.toLowerCase();
        if (lowerVal === 'strict') sameSite = 'Strict';
        else if (lowerVal === 'lax') sameSite = 'Lax';
        else if (lowerVal === 'none') sameSite = 'None';
        break;
      }
    }
  }

  if (!domain) {
    domain = normalizeDomain(url.hostname);
    hostOnly = true;
  }

  path = normalizePath(path, url.pathname);

  return {
    name,
    value,
    domain,
    path,
    expires,
    maxAge,
    secure,
    httpOnly,
    sameSite,
    hostOnly,
    creationDate: Date.now(),
  };
}

/**
 * Checks if a cookie matches a specific request URL for inclusion in the Cookie header.
 */
export function matchCookie(cookie: Cookie, requestUrl: string, now = Date.now()): boolean {
  if (isCookieExpired(cookie, now)) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return false;
  }

  if (!domainMatch(cookie.domain, url.hostname, cookie.hostOnly)) {
    return false;
  }

  if (!pathMatch(cookie.path, url.pathname || '/')) {
    return false;
  }

  if (cookie.secure && url.protocol !== 'https:') {
    return false;
  }

  return true;
}

/**
 * Formats a list of matching cookies into an HTTP Cookie header string.
 */
export function formatCookieHeader(cookies: Cookie[]): string {
  // Sort by path length descending (longer paths first) according to RFC 6265
  const sorted = [...cookies].sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));
  return sorted.map(c => `${c.name}=${c.value}`).join('; ');
}
