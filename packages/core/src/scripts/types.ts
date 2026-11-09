import type { Body, KeyValue } from '../format/types.js';

export type ScriptType = 'pre' | 'post' | 'tests';

export interface ScriptLogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  args: string[];
  timestamp: number;
}

export interface ScriptError {
  message: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface ScriptRequestData {
  url: string;
  method: string;
  headers?: KeyValue[];
  body?: string | Body;
}

export interface ScriptResponseData {
  status: number;
  statusText: string;
  headers?: KeyValue[];
  body?: string;
  totalMs?: number;
}

export interface PreRequestInput {
  script: string;
  request: ScriptRequestData;
  variables?: Record<string, unknown>;
  runtimeVariables?: Record<string, unknown>;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface PreRequestOutput {
  success: boolean;
  modifiedRequest?: {
    url: string;
    method: string;
    headers?: KeyValue[];
    body?: string;
  };
  runtimeVariables: Record<string, unknown>;
  logs: ScriptLogEntry[];
  error?: ScriptError;
  durationMs: number;
}

export interface PostResponseInput {
  script: string;
  request: ScriptRequestData;
  response: ScriptResponseData;
  variables?: Record<string, unknown>;
  runtimeVariables?: Record<string, unknown>;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface PostResponseOutput {
  success: boolean;
  runtimeVariables: Record<string, unknown>;
  logs: ScriptLogEntry[];
  error?: ScriptError;
  durationMs: number;
}

export interface TestAssertionInput {
  tests: Array<{ name: string; assert: string; enabled?: boolean; [key: string]: unknown }>;
  request: ScriptRequestData;
  response: ScriptResponseData;
  variables?: Record<string, unknown>;
  runtimeVariables?: Record<string, unknown>;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface TestAssertionOutput {
  success: boolean;
  results: import('../format/types.js').TestAssertionResult[];
  logs: ScriptLogEntry[];
  error?: ScriptError;
  durationMs: number;
}
