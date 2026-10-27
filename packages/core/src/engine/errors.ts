export class EngineError extends Error {
  public code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

export class DnsError extends EngineError {
  public hostname: string;

  constructor(hostname: string, originalCode?: string) {
    super(
      `DNS lookup failed for host "${hostname}" (${originalCode || 'ENOTFOUND'})`,
      originalCode || 'ENOTFOUND',
    );
    this.name = 'DnsError';
    this.hostname = hostname;
  }
}

export class ConnectionRefusedError extends EngineError {
  public host: string;
  public port?: number;

  constructor(host: string, port?: number) {
    const portStr = port ? `:${port}` : '';
    super(`Connection refused by server at ${host}${portStr} (ECONNREFUSED)`, 'ECONNREFUSED');
    this.name = 'ConnectionRefusedError';
    this.host = host;
    this.port = port;
  }
}

export class TimeoutError extends EngineError {
  public timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, 'ETIMEDOUT');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class TlsError extends EngineError {
  constructor(message: string, code?: string) {
    super(`TLS certificate verification failed: ${message}`, code || 'TLS_ERROR');
    this.name = 'TlsError';
  }
}

export class RequestAbortedError extends EngineError {
  constructor(message: string = 'Request was cancelled') {
    super(message, 'ABORT_ERR');
    this.name = 'RequestAbortedError';
  }
}

export class MaxRedirectsError extends EngineError {
  public maxRedirects: number;

  constructor(maxRedirects: number) {
    super(`Maximum redirect limit reached (${maxRedirects})`, 'MAX_REDIRECTS');
    this.name = 'MaxRedirectsError';
    this.maxRedirects = maxRedirects;
  }
}

export class RedirectLoopError extends EngineError {
  public url: string;

  constructor(url: string) {
    super(`Redirect loop detected for "${url}"`, 'REDIRECT_LOOP');
    this.name = 'RedirectLoopError';
    this.url = url;
  }
}

const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'CERT_SIGNATURE_FAILURE',
  'CRL_SIGNATURE_FAILURE',
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'CRL_NOT_YET_VALID',
  'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD',
  'OUT_OF_MEM',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_CHAIN_TOO_LONG',
  'CERT_REVOKED',
  'INVALID_CA',
  'PATH_LENGTH_EXCEEDED',
  'INVALID_PURPOSE',
  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'HOSTNAME_MISMATCH',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export function classifyNetworkError(
  err: unknown,
  context: { hostname: string; port?: number; timeoutMs?: number },
): Error {
  if (err instanceof EngineError) {
    return err;
  }

  if (err instanceof Error) {
    const code = (err as { code?: string }).code || '';

    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return new DnsError(context.hostname, code);
    }

    if (code === 'ECONNREFUSED') {
      return new ConnectionRefusedError(context.hostname, context.port);
    }

    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      return new TimeoutError(context.timeoutMs ?? 0);
    }

    if (code === 'ABORT_ERR' || err.name === 'AbortError') {
      return new RequestAbortedError(err.message || 'Request was cancelled');
    }

    if (TLS_ERROR_CODES.has(code) || /certificate|ssl|tls/i.test(err.message)) {
      return new TlsError(err.message, code);
    }

    return new EngineError(err.message, code);
  }

  return new EngineError(String(err));
}
