import path from 'node:path';

/**
 * Validates that a file or folder path is safe from path traversal attacks and system file corruption.
 */
export function validateSafePath(
  targetPath: string,
  allowedRoot?: string,
): { safe: boolean; resolvedPath: string; error?: string } {
  if (!targetPath || typeof targetPath !== 'string') {
    return { safe: false, resolvedPath: '', error: 'Path is empty or invalid.' };
  }

  // 1. Check for null byte injection
  if (targetPath.includes('\0')) {
    return {
      safe: false,
      resolvedPath: '',
      error: 'Path contains prohibited null byte characters.',
    };
  }

  const resolved = path.resolve(targetPath);

  // 2. Prevent targeting sensitive root system directories on Windows / POSIX
  const normalized = resolved.toLowerCase().replace(/\\/g, '/');
  const withoutDrive = normalized.replace(/^[a-z]:/, '');
  const forbiddenSystemPaths = [
    'c:/windows',
    'c:/program files',
    'c:/program files (x86)',
    '/etc',
    '/bin',
    '/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/system',
    '/library',
  ];

  for (const sysPath of forbiddenSystemPaths) {
    if (
      normalized === sysPath ||
      normalized.startsWith(`${sysPath}/`) ||
      withoutDrive === sysPath ||
      withoutDrive.startsWith(`${sysPath}/`)
    ) {
      return {
        safe: false,
        resolvedPath: resolved,
        error: `Access to system directory is forbidden: ${targetPath}`,
      };
    }
  }

  // 3. If an allowed root directory is specified (e.g. the active collection),
  // verify targetPath does not escape via relative navigation (../)
  if (allowedRoot) {
    const resolvedRoot = path.resolve(allowedRoot);
    const relative = path.relative(resolvedRoot, resolved);

    // If relative starts with '..' or is absolute (different drive on Windows), it escaped the root
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return {
        safe: false,
        resolvedPath: resolved,
        error: `Path traversal detected: Path is outside allowed collection root: ${targetPath}`,
      };
    }
  }

  return { safe: true, resolvedPath: resolved };
}

/**
 * Redacts sensitive tokens, passwords, cookies, and secret values from log messages or diagnostic outputs.
 */
export function sanitizeLogContent(content: string): string {
  if (!content || typeof content !== 'string') return '';

  return (
    content
      // Redact Bearer tokens
      .replace(/(bearer\s+)([a-zA-Z0-9_\-.~+/]+=*)/gi, '$1[REDACTED_TOKEN]')
      // Redact Authorization headers
      .replace(/(authorization:\s*)([^\r\n]+)/gi, '$1[REDACTED_AUTH]')
      // Redact basic auth in URLs e.g. https://user:pass@example.com
      .replace(/(https?:\/\/)([^:\s]+):([^@\s]+)@/gi, '$1$2:[REDACTED_PASSWORD]@')
      // Redact JSON password / secret fields
      .replace(
        /("(?:password|secret|apiKey|token|access_token|refresh_token|clientSecret)":\s*")([^"]+)(")/gi,
        '$1[REDACTED]$3',
      )
      // Redact Cookie header session values
      .replace(/(cookie:\s*)([^\r\n]+)/gi, '$1[REDACTED_COOKIES]')
  );
}
