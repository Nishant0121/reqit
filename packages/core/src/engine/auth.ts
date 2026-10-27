import type { Auth } from '../format/types.js';

export function prepareAuthHeaders(auth?: Auth): Record<string, string> {
  if (!auth || auth.type === 'none') {
    return {};
  }

  if (auth.type === 'bearer') {
    const token = typeof auth.token === 'string' ? auth.token : '';
    return {
      authorization: `Bearer ${token}`,
    };
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

  return {};
}
