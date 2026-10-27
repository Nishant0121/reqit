import type { Auth, FolderFile, KeyValue, RequestFile } from '../format/types.js';

function cloneKeyValue(kv: KeyValue): KeyValue {
  return { ...kv };
}

function cloneAuth(auth: Auth | undefined): Auth | undefined {
  if (!auth) return undefined;
  return JSON.parse(JSON.stringify(auth)) as Auth;
}

/**
 * Merges folder headers across a folder hierarchy (root to leaf).
 * Later folders in the list override earlier folders.
 */
function mergeFolderHeaders(folders: FolderFile[]): KeyValue[] {
  const merged: KeyValue[] = [];
  const nameToIndex = new Map<string, number>();

  for (const folder of folders) {
    if (!folder.headers || !Array.isArray(folder.headers)) {
      continue;
    }

    for (const header of folder.headers) {
      const lower = header.name.toLowerCase();
      if (nameToIndex.has(lower)) {
        const index = nameToIndex.get(lower)!;
        merged[index] = cloneKeyValue(header);
      } else {
        nameToIndex.set(lower, merged.length);
        merged.push(cloneKeyValue(header));
      }
    }
  }

  return merged;
}

/**
 * Resolves effective folder auth across a folder hierarchy (root to leaf).
 * Later folders override earlier folders unless they specify 'inherit'.
 */
function resolveEffectiveFolderAuth(folders: FolderFile[]): Auth | undefined {
  let effectiveAuth: Auth | undefined = undefined;

  for (const folder of folders) {
    if (!folder.auth) {
      continue;
    }
    if (folder.auth.type === 'inherit') {
      continue;
    }
    effectiveAuth = cloneAuth(folder.auth);
  }

  return effectiveAuth;
}

/**
 * Merges folder-level headers and auth into a request.
 * Request-level headers and auth always win when defined.
 *
 * Header merging:
 * - If request defines a header with the same name (case-insensitive), the request header wins.
 * - Folder headers not present in the request are inherited.
 *
 * Auth merging:
 * - If request.auth is undefined or { type: 'inherit' }, inherits the folder's auth.
 * - If request defines its own auth (including { type: 'none' }), the request auth wins.
 *
 * @param request The request to merge into (not mutated)
 * @param folder A folder or list of folders ordered from root to leaf
 * @returns A new RequestFile with folder defaults inherited
 */
export function applyFolderInheritance(
  request: RequestFile,
  folder?: FolderFile | FolderFile[],
): RequestFile {
  if (!folder) {
    return {
      ...request,
      headers: request.headers ? request.headers.map(cloneKeyValue) : undefined,
      auth: cloneAuth(request.auth),
    };
  }

  const folderList = Array.isArray(folder) ? folder : [folder];
  const effectiveFolderHeaders = mergeFolderHeaders(folderList);
  const effectiveFolderAuth = resolveEffectiveFolderAuth(folderList);

  // 1. Merge headers
  let mergedHeaders: KeyValue[] | undefined = undefined;

  if (request.headers && request.headers.length > 0) {
    const requestHeaderNames = new Set(request.headers.map(h => h.name.toLowerCase()));

    const inheritedHeaders = effectiveFolderHeaders.filter(
      h => !requestHeaderNames.has(h.name.toLowerCase()),
    );

    mergedHeaders = [...inheritedHeaders, ...request.headers.map(cloneKeyValue)];
  } else if (effectiveFolderHeaders.length > 0) {
    mergedHeaders = effectiveFolderHeaders.map(cloneKeyValue);
  } else if (request.headers) {
    mergedHeaders = [];
  }

  // 2. Merge auth
  let mergedAuth: Auth | undefined = undefined;

  if (request.auth && request.auth.type !== 'inherit') {
    // Request defines its own auth (even 'none') -> request wins
    mergedAuth = cloneAuth(request.auth);
  } else if (effectiveFolderAuth) {
    // Request auth is missing or 'inherit' -> folder auth is inherited
    mergedAuth = cloneAuth(effectiveFolderAuth);
  } else if (request.auth) {
    mergedAuth = cloneAuth(request.auth);
  }

  return {
    ...request,
    headers: mergedHeaders,
    auth: mergedAuth,
  };
}
