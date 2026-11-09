import * as crypto from 'node:crypto';

/**
 * Generates a cryptographically random PKCE code verifier (RFC 7636).
 */
export function generateCodeVerifier(length = 64): string {
  const allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += allowed[bytes[i]! % allowed.length];
  }
  return result;
}

/**
 * Computes S256 code challenge from a code verifier (RFC 7636).
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}
