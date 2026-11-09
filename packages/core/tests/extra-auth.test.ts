import { describe, it, expect } from 'vitest';
import { parseDigestChallenge, createDigestAuthHeader } from '../src/engine/digest.js';
import { signAwsV4 } from '../src/engine/awsv4.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizationUrl,
} from '../src/oauth/index.js';

describe('Extra Auth & OAuth (Phase 18)', () => {
  describe('Digest Authentication (RFC 7616 / RFC 2617)', () => {
    it('parses WWW-Authenticate: Digest header correctly', () => {
      const header =
        'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"';
      const challenge = parseDigestChallenge(header);
      expect(challenge).not.toBeNull();
      expect(challenge?.realm).toBe('testrealm@host.com');
      expect(challenge?.nonce).toBe('dcd98b7102dd2f0e8b11d0f600bfb0c093');
      expect(challenge?.qop).toBe('auth');
      expect(challenge?.opaque).toBe('5ccc069c403ebaf9f0171e9517f40e41');
    });

    it('generates valid Digest Authorization response header', () => {
      const challenge = {
        realm: 'myrealm',
        nonce: 'noncestring123',
        qop: 'auth',
        opaque: 'opaquestring',
      };
      const authHeader = createDigestAuthHeader(
        challenge,
        { username: 'Mufasa', password: 'CircleOfLife' },
        'GET',
        '/dir/index.html',
        1,
      );

      expect(authHeader).toContain('Digest username="Mufasa"');
      expect(authHeader).toContain('realm="myrealm"');
      expect(authHeader).toContain('nonce="noncestring123"');
      expect(authHeader).toContain('uri="/dir/index.html"');
      expect(authHeader).toContain('qop=auth');
      expect(authHeader).toContain('nc=00000001');
      expect(authHeader).toContain('cnonce=');
      expect(authHeader).toContain('response=');
    });
  });

  describe('AWS Signature Version 4', () => {
    it('generates signed AWS4-HMAC-SHA256 headers', () => {
      const fixedTime = new Date('2026-11-02T12:00:00Z');
      const headers = signAwsV4(
        {
          method: 'POST',
          url: 'https://dynamodb.us-east-1.amazonaws.com/',
          body: '{"TableName":"Users"}',
        },
        {
          type: 'awsv4',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'us-east-1',
          service: 'dynamodb',
        },
        fixedTime,
      );

      expect(headers['authorization']).toContain('AWS4-HMAC-SHA256');
      expect(headers['authorization']).toContain(
        'Credential=AKIAIOSFODNN7EXAMPLE/20261102/us-east-1/dynamodb/aws4_request',
      );
      expect(headers['authorization']).toContain('SignedHeaders=');
      expect(headers['authorization']).toContain('Signature=');
      expect(headers['x-amz-date']).toBe('20261102T120000Z');
      expect(headers['x-amz-content-sha256']).toBeDefined();
    });
  });

  describe('OAuth 2.0 PKCE & URL Builder', () => {
    it('generates compliant code verifier and S256 challenge', () => {
      const verifier = generateCodeVerifier(64);
      expect(verifier).toHaveLength(64);
      expect(/^[A-Za-z0-9\-._~]+$/.test(verifier)).toBe(true);

      const challenge = generateCodeChallenge(verifier);
      expect(challenge).toBeDefined();
      expect(challenge.length).toBeGreaterThan(20);
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
    });

    it('builds full authorization url with query parameters and PKCE', () => {
      const url = buildAuthorizationUrl({
        authUrl: 'https://auth.example.com/oauth/authorize',
        clientId: 'my-client-id',
        redirectUri: 'http://127.0.0.1:41920/callback',
        scope: 'openid profile email',
        state: 'random-state-123',
        codeChallenge: 'challenge-xyz',
        codeChallengeMethod: 'S256',
      });

      const parsed = new URL(url);
      expect(parsed.origin).toBe('https://auth.example.com');
      expect(parsed.pathname).toBe('/oauth/authorize');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('my-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:41920/callback');
      expect(parsed.searchParams.get('scope')).toBe('openid profile email');
      expect(parsed.searchParams.get('state')).toBe('random-state-123');
      expect(parsed.searchParams.get('code_challenge')).toBe('challenge-xyz');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });
});
