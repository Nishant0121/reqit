import type { Auth, AuthAwsV4 } from '../format/types.js';
import { signAwsV4 } from './awsv4.js';

export function prepareAuthHeaders(
  auth?: Auth,
  requestContext?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  },
): Record<string, string> {
  if (!auth || auth.type === 'none') {
    return {};
  }

  if (auth.type === 'bearer') {
    const token = typeof auth.token === 'string' ? auth.token : '';
    return {
      authorization: `Bearer ${token}`,
    };
  }

  if (auth.type === 'oauth2') {
    const token = typeof auth.accessToken === 'string' ? auth.accessToken : '';
    if (token) {
      return {
        authorization: `Bearer ${token}`,
      };
    }
    return {};
  }

  if (auth.type === 'basic') {
    const user = typeof auth.username === 'string' ? auth.username : '';
    const pass = typeof auth.password === 'string' ? auth.password : '';
    const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
    return {
      authorization: `Basic ${encoded}`,
    };
  }

  if (auth.type === 'apikey' && 'in' in auth && auth.in === 'header') {
    const key = typeof auth.key === 'string' ? auth.key : '';
    const val = typeof auth.value === 'string' ? auth.value : '';
    if (key) {
      return {
        [key.toLowerCase()]: val,
      };
    }
  }

  if (auth.type === 'awsv4' && requestContext) {
    try {
      return signAwsV4(requestContext, auth as AuthAwsV4);
    } catch {
      // fallback
    }
  }

  return {};
}
