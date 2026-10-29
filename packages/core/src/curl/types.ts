import type { HttpMethod, RequestFile, KeyValue } from '../format/types.js';

export type ShellTarget = 'bash' | 'cmd' | 'powershell';

export interface CurlParseResult {
  request: RequestFile;
  warnings: string[];
}

export interface CurlFormatOptions {
  /** Target shell environment for escaping (default: 'bash') */
  target?: ShellTarget;
  /** Whether to format command on multiple lines with line continuation (default: true) */
  multiline?: boolean;
  /** Whether to include client default flags like --compressed or timeout */
  includeDefaults?: boolean;
  /** Whether to format body with indentation if valid JSON (default: true) */
  beautifyJson?: boolean;
}

export interface ParsedCurlOptions {
  method?: HttpMethod;
  url?: string;
  headers: KeyValue[];
  params: KeyValue[];
  dataChunks: string[];
  urlEncodeChunks: Array<{ name?: string; value: string }>;
  formFields: Array<{
    name: string;
    value: string;
    isFile?: boolean;
    fileName?: string;
    contentType?: string;
  }>;
  user?: { username: string; password?: string };
  followRedirects?: boolean;
  validateSsl?: boolean;
  timeoutMs?: number;
  compressed?: boolean;
  warnings: string[];
}
