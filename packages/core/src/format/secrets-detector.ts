import type { RequestFile } from './types.js';

export interface HardcodedSecretFinding {
  field: string;
  value: string;
  reason: string;
}

// Patterns that typically identify hardcoded secret tokens
const JWT_REGEX = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const TOKEN_PREFIX_REGEX = /^(ghp_|gho_|sk-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|xoxb-|Bearer\s+)/;

/**
 * Detects hardcoded secret tokens in a request file.
 */
export function detectHardcodedSecrets(request: RequestFile): HardcodedSecretFinding[] {
  const findings: HardcodedSecretFinding[] = [];

  const checkValue = (val: unknown, field: string) => {
    if (typeof val !== 'string') return;
    const trimmed = val.trim();
    if (!trimmed || trimmed.includes('{{')) return;

    if (JWT_REGEX.test(trimmed)) {
      findings.push({
        field,
        value: trimmed,
        reason: 'Looks like a JWT token. Move it to an environment variable or secrets.',
      });
      return;
    }

    if (TOKEN_PREFIX_REGEX.test(trimmed)) {
      findings.push({
        field,
        value: trimmed,
        reason: 'Matches a known API token pattern. Move it to secrets.',
      });
      return;
    }

    // High entropy or long non-placeholder secret in sensitive fields
    const isSensitiveField =
      field.includes('auth') ||
      field.toLowerCase().includes('apikey') ||
      field.toLowerCase().includes('token') ||
      field.toLowerCase().includes('authorization');

    if (isSensitiveField && trimmed.length >= 20 && !trimmed.includes(' ')) {
      findings.push({
        field,
        value: trimmed,
        reason: 'Long sensitive token detected. Consider using a {{variable}}.',
      });
    }
  };

  // 1. Auth check
  if (request.auth) {
    const a = request.auth as Record<string, unknown>;
    if (typeof a.token === 'string') checkValue(a.token, 'auth.token');
    if (typeof a.password === 'string') checkValue(a.password, 'auth.password');
    if (typeof a.value === 'string') checkValue(a.value, 'auth.value');
  }

  // 2. Headers check
  if (request.headers) {
    for (const h of request.headers) {
      const nameLower = h.name.toLowerCase();
      if (
        nameLower === 'authorization' ||
        nameLower === 'x-api-key' ||
        nameLower === 'api-key' ||
        nameLower.includes('token')
      ) {
        checkValue(h.value, `headers[${h.name}]`);
      }
    }
  }

  return findings;
}
