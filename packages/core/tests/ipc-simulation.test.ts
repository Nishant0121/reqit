import { describe, it } from 'vitest';
import { sendRequest } from '../src/engine/send.js';
import { resolveRequest } from '../src/variables/request.js';
import { CookieJar } from '../src/cookies/jar.js';
import type { RequestFile } from '../src/format/types.js';

describe('IPC Simulation', () => {
  it('simulates cookie handshake exactly as ipc.ts does', async () => {
    const jar = new CookieJar();

    // 1. First request: set cookie
    const req1: RequestFile = {
      version: 1,
      name: 'Smoke test GET',
      method: 'GET',
      url: 'https://httpbin.org/cookies/set?user_session=token_abc123',
    };
    const resolvedReq1 = resolveRequest(req1, {});
    const sendOptions1 = {
      cookieJar: jar,
      followRedirects: true,
      maxRedirects: 10,
      validateSsl: true,
    };
    const res1 = await sendRequest(resolvedReq1, sendOptions1);
    console.log('--- Request 1 (Set-Cookie) ---');
    console.log('Status:', res1.status);
    console.log('Cookies in ResponseResult:', res1.cookies);
    console.log('Body:', res1.body);
    console.log('Jar contents after req 1:', jar.getAllCookies());

    // 2. Second request: get cookies
    const req2: RequestFile = {
      version: 1,
      name: 'Smoke test GET',
      method: 'GET',
      url: 'https://httpbin.org/cookies',
    };
    const resolvedReq2 = resolveRequest(req2, {});
    const sendOptions2 = {
      cookieJar: jar,
      followRedirects: true,
      maxRedirects: 10,
      validateSsl: true,
    };
    const res2 = await sendRequest(resolvedReq2, sendOptions2);
    console.log('--- Request 2 (Get Cookies) ---');
    console.log('Status:', res2.status);
    console.log('Body:', res2.body);
  }, 20000);

  it('simulates digest auth exactly as ipc.ts does', async () => {
    const jar = new CookieJar();
    const req: RequestFile = {
      version: 1,
      name: 'Digest',
      method: 'GET',
      url: 'https://httpbin.org/digest-auth/auth/admin/secret',
      auth: {
        type: 'digest',
        username: 'admin',
        password: 'secret',
      },
    };
    const resolvedReq = resolveRequest(req, {});
    const sendOptions = {
      cookieJar: jar,
      followRedirects: true,
      maxRedirects: 10,
      validateSsl: true,
    };
    const res = await sendRequest(resolvedReq, sendOptions);
    console.log('--- Digest Request ---');
    console.log('Status:', res.status);
    console.log('Body:', res.body);
  }, 20000);
});
