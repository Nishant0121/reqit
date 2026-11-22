import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { validateSafePath, sanitizeLogContent } from '../src/security/index.js';

describe('Security - validateSafePath', () => {
  it('rejects empty or invalid paths', () => {
    // @ts-expect-error testing invalid inputs
    expect(validateSafePath(null).safe).toBe(false);
    expect(validateSafePath('').safe).toBe(false);
  });

  it('rejects paths containing null byte characters', () => {
    const res = validateSafePath('/user/project/file\0.json');
    expect(res.safe).toBe(false);
    expect(res.error).toMatch(/null byte/i);
  });

  it('rejects sensitive system paths', () => {
    const winRes = validateSafePath('C:\\Windows\\System32\\calc.exe');
    expect(winRes.safe).toBe(false);
    expect(winRes.error).toMatch(/forbidden/i);

    const posixRes = validateSafePath('/etc/passwd');
    expect(posixRes.safe).toBe(false);
    expect(posixRes.error).toMatch(/forbidden/i);
  });

  it('allows safe legitimate paths within allowedRoot', () => {
    const root = path.resolve('tmp/my-collection');
    const target = path.join(root, 'requests', 'get-user.reqit.json');

    const res = validateSafePath(target, root);
    expect(res.safe).toBe(true);
    expect(res.resolvedPath).toBe(target);
  });

  it('detects directory traversal escaping allowedRoot with ../', () => {
    const root = path.resolve('tmp/my-collection');
    const target = path.join(root, '..', '..', 'secret.txt');

    const res = validateSafePath(target, root);
    expect(res.safe).toBe(false);
    expect(res.error).toMatch(/Path traversal detected/i);
  });
});

describe('Security - sanitizeLogContent', () => {
  it('redacts Bearer tokens', () => {
    const raw = 'Request sent with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID token';
    const sanitized = sanitizeLogContent(raw);
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1Ni');
    expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
  });

  it('redacts Basic Auth credentials in URLs', () => {
    const raw = 'Connecting to https://admin:superSecret123@api.example.com/data';
    const sanitized = sanitizeLogContent(raw);
    expect(sanitized).not.toContain('superSecret123');
    expect(sanitized).toContain('https://admin:[REDACTED_PASSWORD]@api.example.com/data');
  });

  it('redacts Authorization headers', () => {
    const raw = 'Header: authorization: Basic dXNlcjpwYXNz';
    const sanitized = sanitizeLogContent(raw);
    expect(sanitized).not.toContain('dXNlcjpwYXNz');
    expect(sanitized).toContain('authorization: [REDACTED_AUTH]');
  });

  it('redacts Cookies', () => {
    const raw = 'cookie: session_id=abc123xyz; secure_token=xyz987';
    const sanitized = sanitizeLogContent(raw);
    expect(sanitized).not.toContain('session_id=abc123xyz');
    expect(sanitized).toContain('cookie: [REDACTED_COOKIES]');
  });

  it('redacts sensitive JSON keys', () => {
    const jsonStr = JSON.stringify({
      username: 'nishant',
      password: 'mySecretPassword!1',
      token: 'secret-tok-999',
      apiKey: 'api-key-live-12345',
      clientSecret: 'oauth-secret-abcd',
    });
    const sanitized = sanitizeLogContent(jsonStr);
    expect(sanitized).not.toContain('mySecretPassword!1');
    expect(sanitized).not.toContain('secret-tok-999');
    expect(sanitized).not.toContain('api-key-live-12345');
    expect(sanitized).not.toContain('oauth-secret-abcd');
    expect(sanitized).toContain('nishant');
  });
});
