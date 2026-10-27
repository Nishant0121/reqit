import type * as http from 'node:http';
import type * as https from 'node:https';
import type { KeyValue } from '../format/types.js';

export interface ResponseTiming {
  /** Time spent resolving the host name via DNS (in milliseconds) */
  dnsMs: number;
  /** Time spent establishing the TCP connection (in milliseconds) */
  tcpMs: number;
  /** Time spent performing the TLS/SSL handshake (in milliseconds) */
  tlsMs: number;
  /** Time from connection ready to the first byte of response headers (in milliseconds) */
  ttfbMs: number;
  /** Time spent downloading the response body (in milliseconds) */
  downloadMs: number;
  /** Total wall-clock time for the request hop (in milliseconds) */
  totalMs: number;
}

export interface SendOptions {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to follow HTTP 3xx redirects (default: true) */
  followRedirects?: boolean;
  /** Maximum number of redirects to follow (default: 5) */
  maxRedirects?: number;
  /** Whether to reject unauthorized SSL/TLS certificates (default: true) */
  validateSsl?: boolean;
  /** Optional AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Threshold in bytes above which the body is streamed to disk (default: 5MB) */
  maxInMemoryBytes?: number;
  /** Directory where large bodies are streamed as temp files */
  tempDir?: string;
  /** Custom HTTP/HTTPS agent (e.g. for connection pooling / keep-alive) */
  agent?: http.Agent | https.Agent;
  /** Internal tracking for redirect count and loop detection */
  redirectCount?: number;
  visitedUrls?: string[];
  redirectHops?: ResponseTiming[];
}

export interface ResponseResult {
  status: number;
  statusText: string;
  headers: KeyValue[];
  body?: string;
  bodyPath?: string;
  sizeBytes: number;
  totalMs: number;
  /** Timing breakdown for the final request hop */
  timing: ResponseTiming;
  /** Timing breakdown for any preceding redirect hops */
  redirectHops?: ResponseTiming[];
  /** Alias for redirectHops */
  redirects?: ResponseTiming[];
  /** Helper to look up a response header (case-insensitive) */
  getHeader: (name: string) => string | undefined;
  /** Helper to parse JSON body */
  json: <T = unknown>() => T;
}
