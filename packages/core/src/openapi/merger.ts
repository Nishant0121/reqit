import * as fs from 'node:fs';
import { parseRequest } from '../format/parser.js';
import type { KeyValue, RequestFile } from '../format/types.js';
import type { ImportMode } from './types.js';

export interface MergeResult {
  request: RequestFile;
  status: 'created' | 'merged' | 'skipped';
  details?: string;
}

/**
 * Merges parameter lists, preserving existing user values and custom params,
 * while adding newly defined parameters from the incoming specification.
 */
function mergeKeyValues(
  existingList: KeyValue[] | undefined,
  incomingList: KeyValue[] | undefined,
): KeyValue[] | undefined {
  if (!existingList && !incomingList) return undefined;
  if (!existingList) return incomingList;
  if (!incomingList) return existingList;

  const result = [...existingList];
  const existingNames = new Set(existingList.map(item => item.name.toLowerCase()));

  for (const inc of incomingList) {
    if (!existingNames.has(inc.name.toLowerCase())) {
      result.push(inc);
      existingNames.add(inc.name.toLowerCase());
    }
  }

  return result;
}

/**
 * Handles merging an incoming converted request with an existing request file on disk,
 * according to the selected ImportMode.
 */
export async function mergeOrPreserveRequest(
  targetFilePath: string,
  incomingRequest: RequestFile,
  mode: ImportMode,
): Promise<MergeResult> {
  // If file doesn't exist on disk, it's a new file
  if (!fs.existsSync(targetFilePath)) {
    return {
      request: incomingRequest,
      status: 'created',
      details: 'New request created from specification',
    };
  }

  // File exists: handle according to mode
  if (mode === 'add-new') {
    // Read existing file and do not overwrite
    try {
      const existingContent = await fs.promises.readFile(targetFilePath, 'utf-8');
      const existingRequest = parseRequest(existingContent);
      return {
        request: existingRequest,
        status: 'skipped',
        details: 'Preserved existing request file (add-new mode)',
      };
    } catch {
      return {
        request: incomingRequest,
        status: 'skipped',
        details: 'Preserved existing file (could not parse, left unchanged)',
      };
    }
  }

  if (mode === 'clean') {
    return {
      request: incomingRequest,
      status: 'created',
      details: 'Overwrote existing file (clean mode)',
    };
  }

  // mode === 'merge'
  try {
    const existingContent = await fs.promises.readFile(targetFilePath, 'utf-8');
    const existingRequest = parseRequest(existingContent);

    // Merge: Preserve user-authored scripts, tests, auth customizations, and custom headers/params
    const mergedRequest: RequestFile = {
      version: incomingRequest.version,
      name: existingRequest.name || incomingRequest.name,
      method: incomingRequest.method,
      url: incomingRequest.url,
      params: mergeKeyValues(existingRequest.params, incomingRequest.params),
      headers: mergeKeyValues(existingRequest.headers, incomingRequest.headers),
      // Preserve existing user auth if configured, otherwise use incoming
      auth: existingRequest.auth ?? incomingRequest.auth,
      // Preserve existing body if present and non-empty, otherwise update
      body: existingRequest.body ?? incomingRequest.body,
      // Preserve existing user scripts (pre/post)
      scripts: existingRequest.scripts ?? incomingRequest.scripts,
      // Preserve existing user test assertions
      tests: existingRequest.tests ?? incomingRequest.tests,
      disableCookieJar: existingRequest.disableCookieJar ?? incomingRequest.disableCookieJar,
      docs: existingRequest.docs ?? incomingRequest.docs,
    };

    return {
      request: mergedRequest,
      status: 'merged',
      details:
        'Merged specification updates while preserving user scripts, tests, and custom parameters',
    };
  } catch {
    // If existing file is unparseable, fallback to overwriting
    return {
      request: incomingRequest,
      status: 'created',
      details: 'Overwrote existing unparseable file',
    };
  }
}
