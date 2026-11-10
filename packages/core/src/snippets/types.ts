import type { ScopeInput } from '../variables/types.js';

export type SnippetTarget = 'curl' | 'fetch' | 'axios' | 'python' | 'node-http' | 'go' | 'java';

export type SnippetSyntaxMode = 'bash' | 'javascript' | 'python' | 'go' | 'java';

export interface SnippetTargetInfo {
  id: SnippetTarget;
  name: string;
  category: string;
  description: string;
  syntaxMode: SnippetSyntaxMode;
  extension: string;
}

export interface SnippetOptions {
  /** Target language or library to generate */
  target?: SnippetTarget;
  /**
   * If true, {{variables}} will be resolved against the provided scopes.
   * If false, {{variables}} will be retained as raw placeholder strings.
   * Default: true
   */
  resolveVariables?: boolean;
  /** Variable scopes for resolving {{variables}} */
  scopes?: ScopeInput;
  /** Indentation string (defaults to two spaces) */
  indent?: string;
}

export interface EffectiveRequestData {
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  body?: {
    type: 'none' | 'json' | 'text' | 'form' | 'multipart';
    content?: string;
    form?: Array<{ name: string; value: string; isFile?: boolean }>;
    jsonParsed?: unknown;
  };
  auth?: {
    type: string;
    bearer?: string;
    basic?: { username: string; password: string };
    apiKey?: { key: string; value: string; in: 'header' | 'query' };
  };
  followRedirects?: boolean;
  validateSsl?: boolean;
  timeoutMs?: number;
}
