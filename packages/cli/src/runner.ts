import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyFolderInheritance,
  CookieJar,
  executePostResponseScript,
  executePreRequestScript,
  executeTestAssertions,
  flattenScopes,
  formatScriptError,
  parseRequest,
  resolveRequest,
  scanCollection,
  sendRequest,
  type CollectionTree,
  type CollectionTreeNode,
  type FolderFile,
  type HttpMethod,
  type RequestFile,
  type ResponseResult,
  type ScriptLogEntry,
  type TestAssertionResult,
} from '@reqit/core';
import { resolveCliScopes } from './env.js';
import type { CliRunOptions, CollectionRunSummary, RequestRunResult } from './types.js';

interface RequestItem {
  node: CollectionTreeNode;
  request: RequestFile;
  folders: FolderFile[];
}

function collectRequestsFromNodes(
  nodes: CollectionTreeNode[],
  parentFolders: FolderFile[] = [],
): RequestItem[] {
  const items: RequestItem[] = [];

  for (const node of nodes) {
    if (node.type === 'folder') {
      const currentFolders = node.folder ? [...parentFolders, node.folder] : parentFolders;
      if (node.children && node.children.length > 0) {
        items.push(...collectRequestsFromNodes(node.children, currentFolders));
      }
    } else if (node.type === 'request') {
      if (node.request) {
        items.push({
          node,
          request: node.request,
          folders: parentFolders,
        });
      }
    }
  }

  return items;
}

function findFolderNode(
  nodes: CollectionTreeNode[],
  folderName: string,
): CollectionTreeNode | undefined {
  const target = folderName.trim().toLowerCase();

  for (const node of nodes) {
    if (node.type === 'folder') {
      if (
        node.name.toLowerCase() === target ||
        node.relativePath.toLowerCase() === target ||
        node.relativePath.toLowerCase().endsWith(`/${target}`) ||
        node.relativePath.toLowerCase().endsWith(`\\${target}`)
      ) {
        return node;
      }
      if (node.children) {
        const found = findFolderNode(node.children, folderName);
        if (found) return found;
      }
    }
  }

  return undefined;
}

function listAllFolderNames(nodes: CollectionTreeNode[]): string[] {
  const names: string[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      names.push(node.relativePath || node.name);
      if (node.children) {
        names.push(...listAllFolderNames(node.children));
      }
    }
  }
  return names;
}

export async function runCollection(
  targetPath: string,
  options: CliRunOptions = {},
  onProgress?: (result: RequestRunResult) => void,
): Promise<CollectionRunSummary> {
  const startTime = new Date().toISOString();
  const startTs = Date.now();

  const resolvedTarget = path.resolve(targetPath);
  if (!fs.existsSync(resolvedTarget)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  const stat = await fs.promises.stat(resolvedTarget);
  let collectionRoot = '';
  let collectionName = '';
  let requestItems: RequestItem[] = [];
  let tree: CollectionTree | undefined = undefined;

  if (stat.isFile()) {
    // Single request file mode
    collectionRoot = path.dirname(resolvedTarget);
    collectionName = path.basename(resolvedTarget, path.extname(resolvedTarget));
    const content = await fs.promises.readFile(resolvedTarget, 'utf-8');
    const req = parseRequest(content, resolvedTarget);

    const singleNode: CollectionTreeNode = {
      id: resolvedTarget,
      name: req.name || collectionName,
      path: resolvedTarget,
      relativePath: path.basename(resolvedTarget),
      type: 'request',
      method: req.method,
      request: req,
    };

    requestItems = [{ node: singleNode, request: req, folders: [] }];
  } else {
    // Collection directory mode
    collectionRoot = resolvedTarget;
    tree = await scanCollection(resolvedTarget);
    collectionName = tree.collection?.name || path.basename(resolvedTarget);

    if (options.folder) {
      const folderNode = findFolderNode(tree.tree, options.folder);
      if (!folderNode) {
        const available = listAllFolderNames(tree.tree);
        const hint =
          available.length > 0
            ? `Available folders: ${available.join(', ')}`
            : 'Collection contains no folders.';
        throw new Error(`Folder "${options.folder}" not found in collection. ${hint}`);
      }
      requestItems = collectRequestsFromNodes(
        folderNode.children || [],
        folderNode.folder ? [folderNode.folder] : [],
      );
    } else {
      requestItems = collectRequestsFromNodes(tree.tree, []);
    }
  }

  // Resolve scopes (environments, secrets, REQIT_SECRET_* env vars)
  const { environmentName, scopes } = await resolveCliScopes(collectionRoot, {
    envName: options.env,
    secretsPath: options.secrets,
  });

  if (tree?.collection?.defaults && 'variables' in tree.collection.defaults) {
    const collVars = (tree.collection.defaults as Record<string, unknown>).variables;
    if (typeof collVars === 'object' && collVars !== null) {
      scopes.collection = collVars as Record<string, unknown>;
    }
  }

  const runtimeVariables: Record<string, unknown> = {};
  scopes.runtime = runtimeVariables;

  const cookieJar = new CookieJar();
  const results: RequestRunResult[] = [];

  let passedRequests = 0;
  let failedRequests = 0;
  let totalAssertions = 0;
  let passedAssertions = 0;
  let failedAssertions = 0;

  for (let i = 0; i < requestItems.length; i++) {
    const item = requestItems[i]!;

    // Delay between requests
    if (i > 0 && options.delay && options.delay > 0) {
      await new Promise(res => setTimeout(res, options.delay));
    }

    const scriptLogs: ScriptLogEntry[] = [];
    let reqError: string | undefined = undefined;

    // 1. Inherit folder headers & auth
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
            body: typeof currentReq.body === 'string' ? currentReq.body : currentReq.body?.content,
          },
          variables: flattenScopes(scopes),
          runtimeVariables,
          timeoutMs: options.timeout,
        });

        if (preOutput.logs) scriptLogs.push(...preOutput.logs);
        if (preOutput.runtimeVariables) Object.assign(runtimeVariables, preOutput.runtimeVariables);
        scopes.runtime = runtimeVariables;

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
      resolvedRequest = resolveRequest(currentReq, scopes, {
        activeEnvironment: environmentName,
      });
    } catch (err: unknown) {
      reqError = `Variable resolution error: ${err instanceof Error ? err.message : String(err)}`;
    }

    // 4. Send HTTP request
    let response: ResponseResult | undefined = undefined;
    let durationMs = 0;

    if (!reqError) {
      const reqStart = Date.now();
      try {
        response = await sendRequest(resolvedRequest, {
          timeoutMs: options.timeout,
          validateSsl: !options.insecure,
          cookieJar: currentReq.disableCookieJar ? undefined : cookieJar,
          followRedirects: true,
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
            variables: flattenScopes(scopes),
            runtimeVariables,
            timeoutMs: options.timeout,
          });

          if (postOutput.logs) scriptLogs.push(...postOutput.logs);
          if (postOutput.runtimeVariables)
            Object.assign(runtimeVariables, postOutput.runtimeVariables);
          scopes.runtime = runtimeVariables;

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
            variables: flattenScopes(scopes),
            runtimeVariables,
            timeoutMs: options.timeout,
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

    // Evaluate result status
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

    const requestResult: RequestRunResult = {
      id: item.node.id,
      name: item.request.name || item.node.name,
      filePath: item.node.path,
      method: (resolvedRequest.method || 'GET').toUpperCase(),
      url: resolvedRequest.url,
      status: response?.status,
      statusText: response?.statusText,
      durationMs,
      sizeBytes: response?.sizeBytes,
      response,
      assertions,
      scriptLogs,
      error: reqError,
      passed,
    };

    results.push(requestResult);
    if (onProgress) {
      onProgress(requestResult);
    }

    // Bail check
    if (options.bail && !passed) {
      break;
    }
  }

  const endTime = new Date().toISOString();
  const totalDurationMs = Date.now() - startTs;
  const success = failedRequests === 0 && failedAssertions === 0;

  return {
    collectionName,
    environmentName,
    totalRequests: results.length,
    passedRequests,
    failedRequests,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    totalDurationMs,
    startTime,
    endTime,
    results,
    success,
  };
}
