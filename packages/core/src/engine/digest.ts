import * as crypto from 'node:crypto';

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  algorithm?: string;
  opaque?: string;
  domain?: string;
}

export interface DigestCredentials {
  username: string;
  password?: string;
}

/**
 * Parses the WWW-Authenticate: Digest header into structured challenge parameters.
 */
export function parseDigestChallenge(header: string): DigestChallenge | null {
  if (!header || !header.trim().toLowerCase().startsWith('digest')) {
    return null;
  }

  const raw = header.replace(/^digest\s+/i, '').trim();
  const challenge: Record<string, string> = {};

  // Regex to extract key="value" or key=value pairs
  const regex = /(\w+)=(?:"([^"]*)"|([^,]+))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const key = match[1]!.toLowerCase();
    const val = (match[2] !== undefined ? match[2] : match[3] || '').trim();
    challenge[key] = val;
  }

  if (!challenge.realm || !challenge.nonce) {
    return null;
  }

  // Handle qop which can be a comma-separated list like "auth,auth-int"
  let qop = challenge.qop;
  if (qop) {
    const qopList = qop.split(',').map(s => s.trim().toLowerCase());
    if (qopList.includes('auth')) {
      qop = 'auth';
    } else if (qopList.includes('auth-int')) {
      qop = 'auth-int';
    }
  }

  return {
    realm: challenge.realm,
    nonce: challenge.nonce,
    qop,
    algorithm: challenge.algorithm,
    opaque: challenge.opaque,
    domain: challenge.domain,
  };
}

/**
 * Computes the Authorization: Digest ... header string according to RFC 7616 / RFC 2617.
 */
export function createDigestAuthHeader(
  challenge: DigestChallenge,
  credentials: DigestCredentials,
  method: string,
  uri: string,
  ncCount = 1,
): string {
  const username = credentials.username;
  const password = credentials.password || '';
  const algorithm = (challenge.algorithm || 'MD5').toUpperCase();
  const isSha256 = algorithm === 'SHA-256' || algorithm === 'SHA256';

  const hash = (input: string): string => {
    return crypto
      .createHash(isSha256 ? 'sha256' : 'md5')
      .update(input)
      .digest('hex');
  };

  const cnonce = crypto.randomBytes(8).toString('hex');
  const nc = ncCount.toString(16).padStart(8, '0');

  // HA1 = H(username:realm:password)
  const ha1 = hash(`${username}:${challenge.realm}:${password}`);

  // HA2 = H(method:digestURI)
  const ha2 = hash(`${method.toUpperCase()}:${uri}`);

  let response: string;
  if (challenge.qop) {
    // response = H(HA1:nonce:nc:cnonce:qop:HA2)
    response = hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`);
  } else {
    // response = H(HA1:nonce:HA2)
    response = hash(`${ha1}:${challenge.nonce}:${ha2}`);
  }

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];

  if (challenge.qop) {
    parts.push(`qop=${challenge.qop}`);
    parts.push(`nc=${nc}`);
    parts.push(`cnonce="${cnonce}"`);
  }

  if (challenge.opaque) {
    parts.push(`opaque="${challenge.opaque}"`);
  }

  if (challenge.algorithm) {
    parts.push(`algorithm=${challenge.algorithm}`);
  }

  return `Digest ${parts.join(', ')}`;
}
