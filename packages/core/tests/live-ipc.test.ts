import { describe, it } from 'vitest';
import { sendRequest, resolveRequest, CookieJar, type RequestFile } from '@reqit/core';

class CookieService {
  private jars: Map<string, CookieJar> = new Map();
  public getJar(collectionPath?: string): CookieJar {
    const key = collectionPath || '__default__';
    if (!this.jars.has(key)) {
      this.jars.set(key, new CookieJar());
    }
    return this.jars.get(key)!;
  }
  public getAll(collectionPath?: string) {
    return this.getJar(collectionPath).getAllCookies();
  }
}

describe('Desktop IPC Exact Simulation', () => {
  it('runs Section A: Session Cookies Handshake', async () => {
    const cookieService = new CookieService();

    // Case 1: No collection open (collectionPath is undefined)
    console.log('=== Case 1: collectionPath is undefined ===');
    const req1: RequestFile = {
      version: 1,
      name: 'Req 1',
      method: 'GET',
      url: 'https://httpbin.org/cookies/set?user_session=token_abc123',
    };
    const resolved1 = resolveRequest(req1, {});
    const jar1 = cookieService.getJar(undefined);
    const options1 = {
      cookieJar: jar1,
      disableCookieJar: req1.disableCookieJar,
      timeoutMs: 30000,
      followRedirects: true,
      maxRedirects: 10,
      validateSsl: true,
    };

    const res1 = await sendRequest(resolved1, options1);
    console.log('Req 1 status:', res1.status);
    console.log('Req 1 cookies property in res1:', res1.cookies);
    console.log('Req 1 body:', res1.body);
    console.log('Jar contents after Req 1:', cookieService.getAll(undefined));

    // Now Req 2: https://httpbin.org/cookies
    const req2: RequestFile = {
      version: 1,
      name: 'Req 2',
      method: 'GET',
      url: 'https://httpbin.org/cookies',
    };
    const resolved2 = resolveRequest(req2, {});
    const jar2 = cookieService.getJar(undefined);
    const options2 = {
      cookieJar: jar2,
      disableCookieJar: req2.disableCookieJar,
      timeoutMs: 30000,
      followRedirects: true,
      maxRedirects: 10,
      validateSsl: true,
    };

    const res2 = await sendRequest(resolved2, options2);
    console.log('Req 2 status:', res2.status);
    console.log('Req 2 body:', res2.body);
  }, 30000);

  it('runs Section C: Digest Auth', async () => {
    const cookieService = new CookieService();
    const req: RequestFile = {
      version: 1,
      name: 'Digest Req',
      method: 'GET',
      url: 'https://httpbin.org/digest-auth/auth/admin/secret',
      auth: {
        type: 'digest',
        username: 'admin',
        password: 'secret',
        realm: '',
      },
    };
    const resolved = resolveRequest(req, {});
    const jar = cookieService.getJar(undefined);
    const options = {
      cookieJar: jar,
      disableCookieJar: req.disableCookieJar,
      timeoutMs: 30000,
      followRedirects: true,
      maxRedirects: 10,
      validateSsl: true,
    };

    const res = await sendRequest(resolved, options);
    console.log('Digest status:', res.status);
    console.log('Digest body:', res.body);
  }, 30000);
});
