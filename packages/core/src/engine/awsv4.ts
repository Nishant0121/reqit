import * as crypto from 'node:crypto';
import type { AuthAwsV4 } from '../format/types.js';

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Signs an HTTP request using AWS Signature Version 4.
 */
export function signAwsV4(
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  },
  auth: AuthAwsV4,
  timestamp: Date = new Date(),
): Record<string, string> {
  const parsedUrl = new URL(request.url);
  const method = (request.method || 'GET').toUpperCase();

  // Basic ISO 8601 formatting: YYYYMMDDTHHMMSSZ
  const amzDate = timestamp.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payload = request.body || '';
  const payloadHash = sha256Hex(payload);

  // Headers to sign
  const headersToSign: Record<string, string> = {
    host: parsedUrl.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  if (auth.sessionToken) {
    headersToSign['x-amz-security-token'] = auth.sessionToken;
  }

  // Include any custom headers passed in that are relevant
  if (request.headers) {
    for (const [k, v] of Object.entries(request.headers)) {
      const lower = k.toLowerCase();
      if (!headersToSign[lower] && lower !== 'authorization') {
        headersToSign[lower] = String(v).trim();
      }
    }
  }

  // Sorted header keys
  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headersToSign[k]}\n`).join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  // Canonical URI (must be URI-encoded)
  let canonicalUri = parsedUrl.pathname;
  if (!canonicalUri) {
    canonicalUri = '/';
  } else {
    canonicalUri = canonicalUri
      .split('/')
      .map(segment => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
  }

  // Canonical Query String
  const queryParams: Array<[string, string]> = [];
  parsedUrl.searchParams.forEach((val, key) => {
    queryParams.push([encodeURIComponent(key), encodeURIComponent(val)]);
  });
  queryParams.sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });
  const canonicalQueryString = queryParams.map(([k, v]) => `${k}=${v}`).join('&');

  // Canonical Request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Credential Scope
  const credentialScope = `${dateStamp}/${auth.region}/${auth.service}/aws4_request`;

  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Derive signing key
  const kDate = hmacSha256(`AWS4${auth.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, auth.region);
  const kService = hmacSha256(kRegion, auth.service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${auth.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization: authorizationHeader,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(auth.sessionToken ? { 'x-amz-security-token': auth.sessionToken } : {}),
  };
}
