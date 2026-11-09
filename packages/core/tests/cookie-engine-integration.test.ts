import * as http from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sendRequest } from '../src/engine/send.js';
import { CookieJar } from '../src/cookies/jar.js';
import type { RequestFile } from '../src/format/types.js';

describe('Cookie Engine Integration (Phase 18 Done-When Requirement)', () => {
  let server: http.Server;
  let serverPort: number;
  let receivedCookiesOnProfile: string | undefined;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/login') {
        // Sets a session cookie
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session_token=reqit_secret_sess_999; Path=/; HttpOnly',
        });
        res.end(JSON.stringify({ status: 'logged_in' }));
        return;
      }

      if (url.pathname === '/profile') {
        receivedCookiesOnProfile = req.headers['cookie'];
        if (req.headers['cookie']?.includes('session_token=reqit_secret_sess_999')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ user: 'authenticated_user' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('sets a session cookie on login that is sent automatically on the next request', async () => {
    const jar = new CookieJar();

    // 1. Send Login Request
    const loginReq: RequestFile = {
      version: 1,
      name: 'Login',
      method: 'POST',
      url: `http://127.0.0.1:${serverPort}/login`,
    };

    const loginRes = await sendRequest(loginReq, { cookieJar: jar });
    expect(loginRes.status).toBe(200);
    expect(loginRes.cookies).toHaveLength(1);
    expect(loginRes.cookies?.[0]?.name).toBe('session_token');
    expect(loginRes.cookies?.[0]?.value).toBe('reqit_secret_sess_999');

    // Verify cookie was stored inside the collection jar
    expect(jar.getCookieString(`http://127.0.0.1:${serverPort}/profile`)).toBe(
      'session_token=reqit_secret_sess_999',
    );

    // 2. Send Profile Request (does NOT explicitly define Cookie header)
    const profileReq: RequestFile = {
      version: 1,
      name: 'Get Profile',
      method: 'GET',
      url: `http://127.0.0.1:${serverPort}/profile`,
    };

    const profileRes = await sendRequest(profileReq, { cookieJar: jar });
    expect(profileRes.status).toBe(200);
    expect(receivedCookiesOnProfile).toBe('session_token=reqit_secret_sess_999');
    expect(profileRes.json<{ user: string }>().user).toBe('authenticated_user');
  });

  it('respects disableCookieJar option per request', async () => {
    const jar = new CookieJar();
    jar.setCookie('session_token=reqit_secret_sess_999; Path=/', `http://127.0.0.1:${serverPort}`);

    const profileReq: RequestFile = {
      version: 1,
      name: 'Get Profile Disabled Cookies',
      method: 'GET',
      url: `http://127.0.0.1:${serverPort}/profile`,
      disableCookieJar: true,
    };

    receivedCookiesOnProfile = undefined;
    const profileRes = await sendRequest(profileReq, { cookieJar: jar });
    expect(profileRes.status).toBe(401);
    expect(receivedCookiesOnProfile).toBeUndefined();
  });
});
