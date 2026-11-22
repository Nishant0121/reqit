import type { ResponseResult, TestAssertionResult, ScriptLogEntry } from '@reqit/core';

export interface CliRunOptions {
  env?: string;
  folder?: string;
  secrets?: string;
  bail?: boolean;
  timeout?: number;
  delay?: number;
  insecure?: boolean;
  reporter?: string | string[];
  output?: string;
}

export interface RequestRunResult {
  id: string;
  name: string;
  filePath: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  sizeBytes?: number;
  response?: ResponseResult;
  assertions: TestAssertionResult[];
  scriptLogs: ScriptLogEntry[];
  error?: string;
  passed: boolean;
}

export interface CollectionRunSummary {
  collectionName: string;
  environmentName?: string;
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  totalDurationMs: number;
  startTime: string;
  endTime: string;
  results: RequestRunResult[];
  success: boolean;
}
