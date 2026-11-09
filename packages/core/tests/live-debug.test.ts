import { describe, it } from 'vitest';
import { parseDigestChallenge, createDigestAuthHeader } from '../src/engine/digest.js';

describe('Digest Regex Debug', () => {
  it('parses header', () => {
    const raw =
      'Digest realm="me@kennethreitz.com", nonce="04d8ec7e2a232ec461c367423aeb4d9d", qop="auth", opaque="b61847b2f0c947ff30eebcaedca3d9c8", algorithm=MD5, stale=FALSE';
    const parsed = parseDigestChallenge(raw);
    console.log('Parsed challenge:', parsed);

    const authHeader = createDigestAuthHeader(
      parsed!,
      { username: 'admin', password: 'secret' },
      'GET',
      '/digest-auth/auth/admin/secret',
    );
    console.log('Auth header:', authHeader);
  });
});
