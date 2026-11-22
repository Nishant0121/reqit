import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanCollection } from '../collection/scanner.js';
import { loadEnvironments, loadSecrets } from '../collection/environments.js';
import { CookieJar } from '../cookies/jar.js';
import { sendRequest } from '../engine/send.js';
import { parseRequest } from '../format/parser.js';
import type { FolderFile, HttpMethod, RequestFile, TestAssertionResult } from '../format/types.js';
import {
  executePostResponseScript,
  executePreRequestScript,
  executeTestAssertions,
  formatScriptError,
} from '../scripts/runner.js';
import type { ScriptLogEntry } from '../scripts/types.js';
import { applyFolderInheritance } from '../variables/inheritance.js';
import { resolveRequest } from '../variables/request.js';
import { flattenScopes } from '../variables/scopes.js';
import type { VariableScopes } from '../variables/types.js';
import type {
  RunnerIterationResult,
  RunnerOptions,
  RunnerProgressEvent,
  RunnerRequestResult,
  RunnerSummary,
} from './types.js';

interface RequestItem {
  id: string;
  name: string;
  path: string;
  request: RequestFile;
  folders: FolderFile[];
}

function collectRequestsFromNodes(
  nodes: import('../collection/types.js').CollectionTreeNode[],
  parentFolders: FolderFile[] = [],
  selectedIds?: Set<string>,
): RequestItem[] {
  const items: RequestItem[] = [];

  for (const node of nodes) {
    if (node.type === 'folder') {
      const currentFolders = node.folder ? [...parentFolders, node.folder] : parentFolders;
      if (node.children && node.children.length > 0) {
        items.push(...collectRequestsFromNodes(node.children, currentFolders, selectedIds));
      }
    } else if (node.type === 'request' && node.request) {
      if (!selectedIds || selectedIds.has(node.id) || selectedIds.has(node.path)) {
        items.push({
          id: node.id || node.path,
          name: node.request.name || node.name,
          path: node.path,
          request: node.request,
          folders: parentFolders,
        });
      }
    }
  }

  return items;
}

function findFolderNode(
  nodes: import('../collection/types.js').CollectionTreeNode[],
  folderQuery: string,
): import('../collection/types.js').CollectionTreeNode | undefined {
  const target = folderQuery.trim().toLowerCase();

  for (const node of nodes) {
    if (node.type === 'folder') {
      if (
        node.name.toLowerCase() === target ||
        node.relativePath.toLowerCase() === target ||
        node.path.toLowerCase() === target ||
        node.relativePath.toLowerCase().endsWith(`/${target}`) ||
        node.relativePath.toLowerCase().endsWith(`\\${target}`)
      ) {
        return node;
      }
      if (node.children) {
        const found = findFolderNode(node.children, folderQuery);
        if (found) return found;
      }
    }
  }

  return undefined;
}

export async function runCollectionRunner(
  options: RunnerOptions,
  onProgress?: (event: RunnerProgressEvent) => void,
): Promise<RunnerSummary> {
  const runId = crypto.randomUUID();
  const startTime = new Date().toISOString();
  const startTs = Date.now();

  const resolvedTarget = path.resolve(options.collectionPath);
  if (!fs.existsSync(resolvedTarget)) {
    throw new Error(`Collection path does not exist: ${options.collectionPath}`);
  }

  const stat = await fs.promises.stat(resolvedTarget);
  let collectionRoot = '';
  let collectionName = '';
  let requestItems: RequestItem[] = [];

  const selectedIds =
    options.selectedRequestIds && options.selectedRequestIds.length > 0
      ? new Set(options.selectedRequestIds)
      : undefined;

  let collectionDefaults: Record<string, unknown> | undefined = undefined;

  if (stat.isFile()) {
    // Single request file mode
    collectionRoot = path.dirname(resolvedTarget);
    collectionName = path.basename(resolvedTarget, path.extname(resolvedTarget));
    const content = await fs.promises.readFile(resolvedTarget, 'utf-8');
    const req = parseRequest(content, resolvedTarget);

    requestItems = [
      {
        id: resolvedTarget,
        name: req.name || collectionName,
        path: resolvedTarget,
        request: req,
        folders: [],
      },
    ];
  } else {
    // Collection directory mode
    collectionRoot = resolvedTarget;
    const tree = await scanCollection(resolvedTarget);
    collectionName = tree.collection?.name || path.basename(resolvedTarget);
    collectionDefaults = tree.collection?.defaults as Record<string, unknown> | undefined;

    const folderTarget = options.folderPath || options.folderName;
    if (folderTarget) {
      const folderNode = findFolderNode(tree.tree, folderTarget);
      if (!folderNode) {
        throw new Error(`Target folder "${folderTarget}" not found in collection.`);
      }
      requestItems = collectRequestsFromNodes(
        folderNode.children || [],
        folderNode.folder ? [folderNode.folder] : [],
        selectedIds,
      );
    } else {
      requestItems = collectRequestsFromNodes(tree.tree, [], selectedIds);
    }
  }

  // Load environments and secrets
  const availableEnvironments = await loadEnvironments(collectionRoot);
  let activeEnv = options.environmentName
    ? availableEnvironments[options.environmentName]
    : undefined;
  if (!activeEnv && options.environmentName) {
    for (const env of Object.values(availableEnvironments)) {
      if (env.name.toLowerCase() === options.environmentName.toLowerCase()) {
        activeEnv = env;
        break;
      }
    }
  }

  const fileSecrets = await loadSecrets(collectionRoot);
  const baseSecrets: Record<string, string> = {};
  if (fileSecrets?.environments) {
    if (options.environmentName && fileSecrets.environments[options.environmentName]) {
      Object.assign(baseSecrets, fileSecrets.environments[options.environmentName]);
    } else {
      const firstEnv = Object.keys(fileSecrets.environments)[0];
      if (firstEnv && fileSecrets.environments[firstEnv]) {
        Object.assign(baseSecrets, fileSecrets.environments[firstEnv]);
      }
    }
  }

  // Check system env REQIT_SECRET_* variables
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('REQIT_SECRET_') && typeof value === 'string') {
      baseSecrets[key.slice('REQIT_SECRET_'.length)] = value;
    }
  }

  const baseScopes: VariableScopes = {
    environment: activeEnv?.variables ? { ...activeEnv.variables } : {},
    secrets: baseSecrets,
    runtime: {},
  };

  if (
    collectionDefaults &&
    'variables' in collectionDefaults &&
    typeof collectionDefaults.variables === 'object'
  ) {
    baseScopes.collection = collectionDefaults.variables as Record<string, unknown>;
  }

  const totalIterations =
    options.data && options.data.length > 0
      ? options.iterations && options.iterations > 0
        ? options.iterations
        : options.data.length
      : options.iterations && options.iterations > 0
        ? options.iterations
        : 1;

  const iterationsResult: RunnerIterationResult[] = [];
  const allResults: RunnerRequestResult[] = [];

  let passedRequests = 0;
  let failedRequests = 0;
  let totalAssertions = 0;
  let passedAssertions = 0;
  let failedAssertions = 0;
  let stoppedEarly = false;

  const cookieJar = new CookieJar();

  for (let iter = 1; iter <= totalIterations; iter++) {
    if (options.signal?.aborted) {
      stoppedEarly = true;
      break;
    }

    const dataRow =
      options.data && options.data.length > 0
        ? options.data[iter - 1] || options.data[0]
        : undefined;

    // Per-iteration runtime variables
    const runtimeVariables: Record<string, unknown> = {};

    // Combine scopes for this iteration
    const iterationScopes: VariableScopes = {
      ...baseScopes,
      runtime: runtimeVariables,
    };

    // If dataRow present, merge into environment scope for highest variable priority
    if (dataRow) {
      iterationScopes.environment = {
        ...(baseScopes.environment as Record<string, unknown>),
        ...dataRow,
      };
    }

    const iterResults: RunnerRequestResult[] = [];

    for (let rIdx = 0; rIdx < requestItems.length; rIdx++) {
      if (options.signal?.aborted) {
        stoppedEarly = true;
        break;
      }

      const item = requestItems[rIdx]!;

      // Delay between requests
      if ((rIdx > 0 || iter > 1) && options.delayMs && options.delayMs > 0) {
        await new Promise(r => setTimeout(r, options.delayMs));
      }

      // Notify progress start of request
      if (onProgress) {
        onProgress({
          runId,
          iteration: iter,
          totalIterations,
          requestIndex: rIdx + 1,
          totalRequestsInIteration: requestItems.length,
          currentRequest: {
            id: item.id,
            name: item.name,
            method: (item.request.method || 'GET').toUpperCase(),
            url: item.request.url,
          },
          isComplete: false,
        });
      }

      const scriptLogs: ScriptLogEntry[] = [];
      let reqError: string | undefined = undefined;

      // 1. Folder inheritance
      const currentReq: RequestFile = applyFolderInheritance(item.request, item.folders);

      // 2. Pre-request script
      const preScript = (currentReq.scripts?.preRequest || currentReq.scripts?.pre) as
        string | undefined;
      if (preScript && typeof preScript === 'string' && preScript.trim()) {
        try {
          const preOutput = await executePreRequestScript({
            script: preScript,
            request: {
              url: currentReq.url,
              method: currentReq.method,
              headers: currentReq.headers,
              body:
                typeof currentReq.body === 'string' ? currentReq.body : currentReq.body?.content,
            },
            variables: flattenScopes(iterationScopes),
            runtimeVariables,
            timeoutMs: options.timeoutMs,
          });

          if (preOutput.logs) scriptLogs.push(...preOutput.logs);
          if (preOutput.runtimeVariables)
            Object.assign(runtimeVariables, preOutput.runtimeVariables);
          iterationScopes.runtime = runtimeVariables;

          if (preOutput.modifiedRequest) {
            if (preOutput.modifiedRequest.url) currentReq.url = preOutput.modifiedRequest.url;
            if (preOutput.modifiedRequest.method)
              currentReq.method = preOutput.modifiedRequest.method as HttpMethod;
            if (preOutput.modifiedRequest.headers)
              currentReq.headers = preOutput.modifiedRequest.headers;
            if (preOutput.modifiedRequest.body !== undefined) {
              currentReq.body = {
                type: currentReq.body?.type || 'raw',
                content: preOutput.modifiedRequest.body,
              };
            }
          }

          if (preOutput.error) {
            reqError = formatScriptError(preOutput.error);
          }
        } catch (err: unknown) {
          reqError = `Pre-request script error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      // 3. Variable resolution
      let resolvedRequest: RequestFile = currentReq;
      try {
        resolvedRequest = resolveRequest(currentReq, iterationScopes, {
          activeEnvironment: activeEnv?.name || options.environmentName,
        });
      } catch (err: unknown) {
        reqError = `Variable resolution error: ${err instanceof Error ? err.message : String(err)}`;
      }

      // 4. Send HTTP request
      let response: import('../engine/types.js').ResponseResult | undefined = undefined;
      let durationMs = 0;

      if (!reqError) {
        const reqStart = Date.now();
        try {
          response = await sendRequest(resolvedRequest, {
            timeoutMs: options.timeoutMs,
            validateSsl: !options.insecure,
            cookieJar: currentReq.disableCookieJar ? undefined : cookieJar,
            followRedirects: true,
            signal: options.signal,
          });
          durationMs = Date.now() - reqStart;
        } catch (err: unknown) {
          durationMs = Date.now() - reqStart;
          reqError = err instanceof Error ? err.message : String(err);
        }
      }

      // 5. Post-response script
      if (response) {
        const postScript = (currentReq.scripts?.postResponse || currentReq.scripts?.post) as
          string | undefined;
        if (postScript && typeof postScript === 'string' && postScript.trim()) {
          try {
            const postOutput = await executePostResponseScript({
              script: postScript,
              request: {
                url: resolvedRequest.url,
                method: resolvedRequest.method,
                headers: resolvedRequest.headers,
                body:
                  typeof resolvedRequest.body === 'string'
                    ? resolvedRequest.body
                    : resolvedRequest.body?.content,
              },
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: response.body,
                totalMs: response.totalMs,
              },
              variables: flattenScopes(iterationScopes),
              runtimeVariables,
              timeoutMs: options.timeoutMs,
            });

            if (postOutput.logs) scriptLogs.push(...postOutput.logs);
            if (postOutput.runtimeVariables)
              Object.assign(runtimeVariables, postOutput.runtimeVariables);
            iterationScopes.runtime = runtimeVariables;

            if (postOutput.error) {
              const errStr = formatScriptError(postOutput.error);
              reqError = reqError ? `${reqError}; ${errStr}` : errStr;
            }
          } catch (err: unknown) {
            const errStr = `Post-response script error: ${err instanceof Error ? err.message : String(err)}`;
            reqError = reqError ? `${reqError}; ${errStr}` : errStr;
          }
        }
      }

      // 6. Test assertions
      let assertions: TestAssertionResult[] = [];
      if (response && currentReq.tests && currentReq.tests.length > 0) {
        const enabledTests = currentReq.tests.filter(t => t.enabled !== false);
        if (enabledTests.length > 0) {
          try {
            const testOutput = await executeTestAssertions({
              tests: enabledTests,
              request: {
                url: resolvedRequest.url,
                method: resolvedRequest.method,
                headers: resolvedRequest.headers,
                body:
                  typeof resolvedRequest.body === 'string'
                    ? resolvedRequest.body
                    : resolvedRequest.body?.content,
              },
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: response.body,
                totalMs: response.totalMs,
              },
              variables: flattenScopes(iterationScopes),
              runtimeVariables,
              timeoutMs: options.timeoutMs,
            });

            if (testOutput.logs) scriptLogs.push(...testOutput.logs);
            assertions = testOutput.results || [];

            if (testOutput.error) {
              const errStr = formatScriptError(testOutput.error);
              reqError = reqError ? `${reqError}; ${errStr}` : errStr;
            }
          } catch (err: unknown) {
            const errStr = `Test assertion error: ${err instanceof Error ? err.message : String(err)}`;
            reqError = reqError ? `${reqError}; ${errStr}` : errStr;
          }
        }
      }

      const anyAssertionFailed = assertions.some(a => !a.passed);
      const statusFailed = !response || (assertions.length === 0 && response.status >= 400);
      const passed = !reqError && !anyAssertionFailed && !statusFailed;

      if (passed) {
        passedRequests++;
      } else {
        failedRequests++;
      }

      totalAssertions += assertions.length;
      passedAssertions += assertions.filter(a => a.passed).length;
      failedAssertions += assertions.filter(a => !a.passed).length;

      const runResult: RunnerRequestResult = {
        iteration: iter,
        id: item.id,
        name: item.name,
        method: (resolvedRequest.method || 'GET').toUpperCase(),
        url: resolvedRequest.url,
        status: response?.status,
        statusText: response?.statusText,
        durationMs,
        sizeBytes: response?.sizeBytes,
        assertions,
        scriptLogs,
        error: reqError,
        passed,
      };

      iterResults.push(runResult);
      allResults.push(runResult);

      if (onProgress) {
        onProgress({
          runId,
          iteration: iter,
          totalIterations,
          requestIndex: rIdx + 1,
          totalRequestsInIteration: requestItems.length,
          currentRequest: {
            id: item.id,
            name: item.name,
            method: (resolvedRequest.method || 'GET').toUpperCase(),
            url: resolvedRequest.url,
          },
          latestResult: runResult,
          isComplete: false,
        });
      }

      if (options.bail && !passed) {
        stoppedEarly = true;
        break;
      }
    }

    const iterPassed = iterResults.every(r => r.passed);
    iterationsResult.push({
      iteration: iter,
      dataRow,
      results: iterResults,
      passed: iterPassed,
    });

    if (stoppedEarly) {
      break;
    }
  }

  const endTime = new Date().toISOString();
  const totalDurationMs = Date.now() - startTs;
  const success = !stoppedEarly && failedRequests === 0 && failedAssertions === 0;

  const summary: RunnerSummary = {
    runId,
    collectionName,
    environmentName: activeEnv?.name || options.environmentName,
    totalIterations: iterationsResult.length,
    totalRequests: allResults.length,
    passedRequests,
    failedRequests,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    totalDurationMs,
    startTime,
    endTime,
    iterations: iterationsResult,
    results: allResults,
    success,
    stoppedEarly,
  };

  if (onProgress) {
    onProgress({
      runId,
      iteration: iterationsResult.length,
      totalIterations,
      requestIndex: requestItems.length,
      totalRequestsInIteration: requestItems.length,
      currentRequest: { id: '', name: '', method: '', url: '' },
      isComplete: true,
    });
  }

  return summary;
}
