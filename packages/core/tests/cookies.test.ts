import { describe, it, expect, beforeEach } from 'vitest';
import { CookieJar, parseSetCookie, domainMatch, pathMatch } from '../src/cookies/index.js';

describe('Cookies & Cookie Jar (Phase 18)', () => {
  describe('RFC 6265 Cookie Parsing', () => {
    it('parses basic name and value', () => {
      const cookie = parseSetCookie('session_id=xyz123', 'https://example.com/api/users');
      expect(cookie).not.toBeNull();
      expect(cookie?.name).toBe('session_id');
      expect(cookie?.value).toBe('xyz123');
      expect(cookie?.domain).toBe('example.com');
      expect(cookie?.path).toBe('/api');
      expect(cookie?.hostOnly).toBe(true);
      expect(cookie?.secure).toBe(false);
      expect(cookie?.httpOnly).toBe(false);
    });

    it('parses full attributes: Domain, Path, Max-Age, Secure, HttpOnly, SameSite', () => {
      const header =
        'auth_token=token456; Domain=.example.com; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Strict';
      const cookie = parseSetCookie(header, 'https://sub.example.com/login');
      expect(cookie).not.toBeNull();
      expect(cookie?.name).toBe('auth_token');
      expect(cookie?.value).toBe('token456');
      expect(cookie?.domain).toBe('example.com');
      expect(cookie?.path).toBe('/');
      expect(cookie?.hostOnly).toBe(false);
      expect(cookie?.secure).toBe(true);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('Strict');
      expect(cookie?.maxAge).toBe(3600);
      expect(cookie?.expires).toBeDefined();
    });

    it('parses Expires date string', () => {
      const header = 'pref=dark; Expires=Wed, 21 Oct 2035 07:28:00 GMT; Path=/';
      const cookie = parseSetCookie(header, 'https://example.com');
      expect(cookie?.expires).toBe(new Date('Wed, 21 Oct 2035 07:28:00 GMT').toISOString());
    });

    it('handles malformed or empty inputs gracefully', () => {
      expect(parseSetCookie('', 'https://example.com')).toBeNull();
      expect(parseSetCookie('invalid-no-equal', 'https://example.com')).toBeNull();
      expect(parseSetCookie('name=val', 'not a valid url')).toBeNull();
    });
  });

  describe('RFC 6265 Domain & Path Matching', () => {
    it('matches hostOnly cookies strictly', () => {
      expect(domainMatch('example.com', 'example.com', true)).toBe(true);
      expect(domainMatch('example.com', 'sub.example.com', true)).toBe(false);
    });

    it('matches domain cookies for subdomains', () => {
      expect(domainMatch('example.com', 'example.com', false)).toBe(true);
      expect(domainMatch('example.com', 'api.example.com', false)).toBe(true);
      expect(domainMatch('example.com', 'deep.sub.example.com', false)).toBe(true);
      expect(domainMatch('example.com', 'other.com', false)).toBe(false);
    });

    it('matches paths correctly', () => {
      expect(pathMatch('/', '/')).toBe(true);
      expect(pathMatch('/', '/api/v1')).toBe(true);
      expect(pathMatch('/api', '/api')).toBe(true);
      expect(pathMatch('/api', '/api/users')).toBe(true);
      expect(pathMatch('/api', '/apikey')).toBe(false);
    });
  });

  describe('CookieJar Storage & Lifecycle', () => {
    let jar: CookieJar;

    beforeEach(() => {
      jar = new CookieJar();
    });

    it('stores session cookie and returns it on subsequent matching requests', () => {
      jar.setCookie('sid=session123; Path=/', 'https://api.test.com/login');

      // Request to same domain matches
      const cookies = jar.getCookies('https://api.test.com/users');
      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.name).toBe('sid');
      expect(cookies[0]?.value).toBe('session123');

      // Header string
      expect(jar.getCookieString('https://api.test.com/users')).toBe('sid=session123');

      // Request to different domain does not match
      expect(jar.getCookies('https://other.com')).toHaveLength(0);
    });

    it('enforces secure flag against plain http', () => {
      jar.setCookie('sec_token=xyz; Path=/; Secure', 'https://secure.com');
      expect(jar.getCookies('https://secure.com')).toHaveLength(1);
      expect(jar.getCookies('http://secure.com')).toHaveLength(0);
    });

    it('deletes cookie when expired or Max-Age is 0', () => {
      jar.setCookie('user=alice; Path=/', 'https://example.com');
      expect(jar.getAllCookies()).toHaveLength(1);

      // Overwrite with Max-Age=0
      jar.setCookie('user=; Max-Age=0; Path=/', 'https://example.com');
      expect(jar.getAllCookies()).toHaveLength(0);
    });

    it('groups cookies by domain and clears per domain', () => {
      jar.setCookie('a=1; Path=/', 'https://one.com');
      jar.setCookie('b=2; Path=/', 'https://two.com');

      const grouped = jar.getCookiesByDomain();
      expect(grouped['one.com']).toHaveLength(1);
      expect(grouped['two.com']).toHaveLength(1);

      jar.clearDomain('one.com');
      expect(jar.getAllCookies()).toHaveLength(1);
      expect(jar.getCookiesByDomain()['one.com']).toBeUndefined();
    });

    it('serializes to and from JSON', () => {
      jar.setCookie('saved=true; Path=/; Domain=.example.com', 'https://example.com');
      const json = jar.toJSON();

      const newJar = new CookieJar();
      newJar.fromJSON(json);
      expect(newJar.getCookieString('https://api.example.com')).toBe('saved=true');
    });
  });
});
