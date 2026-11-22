import type { ScriptLogEntry } from '../scripts/types.js';
import type { TestAssertionResult } from '../format/types.js';

export interface RunnerOptions {
  collectionPath: string;
  folderPath?: string;
  folderName?: string;
  environmentName?: string;
  iterations?: number;
  delayMs?: number;
  bail?: boolean;
  timeoutMs?: number;
  insecure?: boolean;
  data?: Record<string, unknown>[];
  secretsPath?: string;
  selectedRequestIds?: string[];
  signal?: AbortSignal;
}

export interface RunnerRequestResult {
  iteration: number;
  id: string;
  name: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  sizeBytes?: number;
  assertions: TestAssertionResult[];
  scriptLogs: ScriptLogEntry[];
  error?: string;
  passed: boolean;
}

export interface RunnerProgressEvent {
  runId: string;
  iteration: number;
  totalIterations: number;
  requestIndex: number;
  totalRequestsInIteration: number;
  currentRequest: { id: string; name: string; method: string; url: string };
  latestResult?: RunnerRequestResult;
  isComplete: boolean;
}

export interface RunnerIterationResult {
  iteration: number;
  dataRow?: Record<string, unknown>;
  results: RunnerRequestResult[];
  passed: boolean;
}

export interface RunnerSummary {
  runId: string;
  collectionName: string;
  environmentName?: string;
  totalIterations: number;
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  totalDurationMs: number;
  startTime: string;
  endTime: string;
  iterations: RunnerIterationResult[];
  results: RunnerRequestResult[];
  success: boolean;
  stoppedEarly?: boolean;
}
