import { spawn } from 'node:child_process';
import { WORKER_BOOTSTRAP_CODE } from './worker-code.js';
import type {
  PostResponseInput,
  PostResponseOutput,
  PreRequestInput,
  PreRequestOutput,
  ScriptError,
  ScriptLogEntry,
  TestAssertionInput,
  TestAssertionOutput,
} from './types.js';
import type { TestAssertionResult } from '../format/types.js';

export const DEFAULT_SCRIPT_TIMEOUT_MS = 3000;
export const DEFAULT_SCRIPT_MEMORY_MB = 64;

export function formatScriptError(error: ScriptError): string {
  const loc = error.line
    ? ` (line ${error.line}${error.column ? `, col ${error.column}` : ''})`
    : '';
  return `ScriptError${loc}: ${error.message}`;
}

interface WorkerMessagePayload {
  success: boolean;
  runtimeVariables?: Record<string, unknown>;
  modifiedRequest?: {
    url: string;
    method: string;
    headers?: Array<{ name: string; value: string; enabled?: boolean }>;
    body?: string;
  };
  testResults?: TestAssertionResult[];
  logs?: ScriptLogEntry[];
  error?: ScriptError;
}

function runScriptInProcess<T extends PreRequestOutput | PostResponseOutput | TestAssertionOutput>(
  type: 'pre' | 'post' | 'tests',
  payload: Record<string, unknown>,
  timeoutMs: number = DEFAULT_SCRIPT_TIMEOUT_MS,
  memoryLimitMb: number = DEFAULT_SCRIPT_MEMORY_MB,
  initialRuntime: Record<string, unknown> = {},
): Promise<T> {
  const startTime = Date.now();

  const createFallbackTestResults = (errMsg: string, duration = 0): TestAssertionResult[] => {
    if (Array.isArray(payload.tests)) {
      return (payload.tests as Array<{ name?: string; assert?: string }>).map(t => ({
        name: t.name || 'Assertion',
        assert: t.assert || '',
        passed: false,
        message: errMsg,
        durationMs: duration,
      }));
    }
    return [];
  };

  return new Promise<T>(resolve => {
    let completed = false;

    // Launch child process with memory cap and Electron-as-Node flag
    const child = spawn(process.execPath, [`--max-old-space-size=${memoryLimitMb}`, '-'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });

    const cleanup = () => {
      clearTimeout(timer);
      try {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      } catch {
        // ignore
      }
    };

    const finish = (result: T) => {
      if (completed) return;
      completed = true;
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      const durationMs = Date.now() - startTime;
      const timeoutError: ScriptError = {
        message: `Script execution timed out after ${timeoutMs}ms`,
      };
      finish({
        success: false,
        error: timeoutError,
        runtimeVariables: initialRuntime,
        results: createFallbackTestResults(`Execution timed out after ${timeoutMs}ms`, durationMs),
        logs: [
          {
            level: 'error',
            args: [formatScriptError(timeoutError)],
            timestamp: Date.now(),
          },
        ],
        durationMs,
      } as unknown as T);
    }, timeoutMs);

    child.on('message', (responseMsg: WorkerMessagePayload) => {
      const durationMs = Date.now() - startTime;
      const logs = responseMsg.logs || [];

      if (!responseMsg.success && responseMsg.error) {
        logs.push({
          level: 'error',
          args: [formatScriptError(responseMsg.error)],
          timestamp: Date.now(),
        });
      }

      finish({
        success: responseMsg.success,
        runtimeVariables: responseMsg.runtimeVariables || initialRuntime,
        modifiedRequest: responseMsg.modifiedRequest,
        results: responseMsg.testResults || [],
        logs,
        error: responseMsg.error,
        durationMs,
      } as unknown as T);
    });

    child.on('exit', (code, signal) => {
      if (completed) return;
      const durationMs = Date.now() - startTime;

      let msg = `Script process terminated unexpectedly (exit code ${code}, signal ${signal})`;
      if (code === 134 || signal === 'SIGABRT') {
        msg = `Script execution exceeded memory limit of ${memoryLimitMb}MB`;
      }

      const err: ScriptError = { message: msg };
      finish({
        success: false,
        error: err,
        runtimeVariables: initialRuntime,
        results: createFallbackTestResults(msg, durationMs),
        logs: [
          {
            level: 'error',
            args: [formatScriptError(err)],
            timestamp: Date.now(),
          },
        ],
        durationMs,
      } as unknown as T);
    });

    child.on('error', err => {
      if (completed) return;
      const durationMs = Date.now() - startTime;
      const scriptErr: ScriptError = { message: err.message };
      finish({
        success: false,
        error: scriptErr,
        runtimeVariables: initialRuntime,
        results: createFallbackTestResults(err.message, durationMs),
        logs: [
          {
            level: 'error',
            args: [formatScriptError(scriptErr)],
            timestamp: Date.now(),
          },
        ],
        durationMs,
      } as unknown as T);
    });

    // Write worker runner into stdin and send execution message
    try {
      if (child.stdin) {
        child.stdin.write(WORKER_BOOTSTRAP_CODE);
        child.stdin.end();
      }
      child.send({
        type,
        timeoutMs: Math.max(500, timeoutMs - 200), // slightly smaller timeout for vm.Script
        ...payload,
      });
    } catch (err: unknown) {
      const scriptErr: ScriptError = {
        message: err instanceof Error ? err.message : String(err),
      };
      finish({
        success: false,
        error: scriptErr,
        runtimeVariables: initialRuntime,
        logs: [
          {
            level: 'error',
            args: [formatScriptError(scriptErr)],
            timestamp: Date.now(),
          },
        ],
        durationMs: Date.now() - startTime,
      } as unknown as T);
    }
  });
}

export function executePreRequestScript(input: PreRequestInput): Promise<PreRequestOutput> {
  const {
    script,
    request,
    variables = {},
    runtimeVariables = {},
    timeoutMs = DEFAULT_SCRIPT_TIMEOUT_MS,
    memoryLimitMb = DEFAULT_SCRIPT_MEMORY_MB,
  } = input;

  if (!script || !script.trim()) {
    return Promise.resolve({
      success: true,
      runtimeVariables,
      logs: [],
      durationMs: 0,
    });
  }

  return runScriptInProcess<PreRequestOutput>(
    'pre',
    {
      script,
      request,
      variables,
      runtimeVariables,
    },
    timeoutMs,
    memoryLimitMb,
    runtimeVariables,
  );
}

export function executePostResponseScript(input: PostResponseInput): Promise<PostResponseOutput> {
  const {
    script,
    request,
    response,
    variables = {},
    runtimeVariables = {},
    timeoutMs = DEFAULT_SCRIPT_TIMEOUT_MS,
    memoryLimitMb = DEFAULT_SCRIPT_MEMORY_MB,
  } = input;

  if (!script || !script.trim()) {
    return Promise.resolve({
      success: true,
      runtimeVariables,
      logs: [],
      durationMs: 0,
    });
  }

  return runScriptInProcess<PostResponseOutput>(
    'post',
    {
      script,
      request,
      response,
      variables,
      runtimeVariables,
    },
    timeoutMs,
    memoryLimitMb,
    runtimeVariables,
  );
}

export function executeTestAssertions(input: TestAssertionInput): Promise<TestAssertionOutput> {
  const {
    tests,
    request,
    response,
    variables = {},
    runtimeVariables = {},
    timeoutMs = DEFAULT_SCRIPT_TIMEOUT_MS,
    memoryLimitMb = DEFAULT_SCRIPT_MEMORY_MB,
  } = input;

  if (!tests || tests.length === 0) {
    return Promise.resolve({
      success: true,
      results: [],
      logs: [],
      durationMs: 0,
    });
  }

  return runScriptInProcess<TestAssertionOutput>(
    'tests',
    {
      tests,
      request,
      response,
      variables,
      runtimeVariables,
    },
    timeoutMs,
    memoryLimitMb,
    runtimeVariables,
  );
}
