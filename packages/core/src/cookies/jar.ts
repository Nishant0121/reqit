import type { Cookie } from '../format/types.js';
import {
  isCookieExpired,
  matchCookie,
  normalizeDomain,
  normalizePath,
  parseSetCookie,
} from './cookie.js';

export class CookieJar {
  private cookies: Map<string, Cookie> = new Map();

  constructor(initialCookies?: Cookie[]) {
    if (initialCookies && Array.isArray(initialCookies)) {
      this.fromJSON(initialCookies);
    }
  }

  private getKey(domain: string, path: string, name: string): string {
    return `${normalizeDomain(domain)}:${normalizePath(path)}:${name}`;
  }

  /**
   * Parses and stores a Set-Cookie header into the jar.
   * If Max-Age=0 or negative, or expires in the past, deletes the existing cookie.
   */
  public setCookie(header: string, requestUrl: string): Cookie | null {
    const cookie = parseSetCookie(header, requestUrl);
    if (!cookie) {
      return null;
    }

    const key = this.getKey(cookie.domain, cookie.path, cookie.name);

    if (isCookieExpired(cookie)) {
      this.cookies.delete(key);
      return null;
    }

    this.cookies.set(key, cookie);
    return cookie;
  }

  /**
   * Adds or replaces a cookie directly in the jar.
   */
  public addCookie(cookie: Cookie): void {
    const key = this.getKey(cookie.domain, cookie.path, cookie.name);
    if (isCookieExpired(cookie)) {
      this.cookies.delete(key);
      return;
    }
    this.cookies.set(key, {
      ...cookie,
      domain: normalizeDomain(cookie.domain),
      path: normalizePath(cookie.path),
      creationDate: cookie.creationDate || Date.now(),
    });
  }

  /**
   * Returns all unexpired cookies that match the request URL.
   */
  public getCookies(requestUrl: string): Cookie[] {
    const now = Date.now();
    const matching: Cookie[] = [];

    // Purge expired and collect matching
    for (const [key, cookie] of this.cookies.entries()) {
      if (isCookieExpired(cookie, now)) {
        this.cookies.delete(key);
        continue;
      }

      if (matchCookie(cookie, requestUrl, now)) {
        matching.push(cookie);
      }
    }

    // Sort by path length descending (longer paths first)
    return matching.sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));
  }

  /**
   * Formats matching cookies into an HTTP Cookie header string.
   */
  public getCookieString(requestUrl: string): string {
    const cookies = this.getCookies(requestUrl);
    if (cookies.length === 0) return '';
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * Returns all stored cookies without filtering by URL.
   */
  public getAllCookies(): Cookie[] {
    const now = Date.now();
    const result: Cookie[] = [];
    for (const [key, cookie] of this.cookies.entries()) {
      if (isCookieExpired(cookie, now)) {
        this.cookies.delete(key);
        continue;
      }
      result.push(cookie);
    }
    return result;
  }

  /**
   * Returns cookies grouped by domain.
   */
  public getCookiesByDomain(): Record<string, Cookie[]> {
    const all = this.getAllCookies();
    const grouped: Record<string, Cookie[]> = {};
    for (const cookie of all) {
      if (!grouped[cookie.domain]) {
        grouped[cookie.domain] = [];
      }
      grouped[cookie.domain]!.push(cookie);
    }
    return grouped;
  }

  /**
   * Removes a single cookie by domain, path, and name.
   */
  public removeCookie(domain: string, path: string, name: string): boolean {
    const key = this.getKey(domain, path, name);
    return this.cookies.delete(key);
  }

  /**
   * Removes all cookies for a given domain.
   */
  public clearDomain(domain: string): void {
    const target = normalizeDomain(domain);
    for (const [key, cookie] of this.cookies.entries()) {
      if (normalizeDomain(cookie.domain) === target) {
        this.cookies.delete(key);
      }
    }
  }

  /**
   * Clears the entire cookie jar.
   */
  public clear(): void {
    this.cookies.clear();
  }

  /**
   * Exports cookies as a JSON-serializable array.
   */
  public toJSON(): Cookie[] {
    return this.getAllCookies();
  }

  /**
   * Populates the cookie jar from a serialized array.
   */
  public fromJSON(cookies: Cookie[]): void {
    this.cookies.clear();
    if (!Array.isArray(cookies)) return;
    for (const c of cookies) {
      if (c && c.name && c.domain) {
        this.addCookie(c);
      }
    }
  }
}
