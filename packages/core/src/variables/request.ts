import type { Auth, Body, KeyValue, RequestFile } from '../format/types.js';
import { UndefinedVariableError } from './errors.js';
import { applyFolderInheritance } from './inheritance.js';
import { resolve } from './resolver.js';
import type { ResolveRequestOptions, ScopeInput } from './types.js';

function resolveStringField(
  val: string,
  field: string,
  requestName: string,
  scopes: ScopeInput,
  options?: ResolveRequestOptions,
): string {
  try {
    return resolve(val, scopes, options);
  } catch (err) {
    if (err instanceof UndefinedVariableError) {
      err.requestName = requestName;
      err.field = field;
    }
    throw err;
  }
}

function resolveKeyValueList(
  list: KeyValue[],
  listName: string,
  requestName: string,
  scopes: ScopeInput,
  options?: ResolveRequestOptions,
): KeyValue[] {
  return list.map((item, idx) => {
    const next: KeyValue = { ...item };
    if (typeof item.name === 'string') {
      next.name = resolveStringField(
        item.name,
        `${listName}[${idx}].name`,
        requestName,
        scopes,
        options,
      );
    }
    if (typeof item.value === 'string') {
      next.value = resolveStringField(
        item.value,
        `${listName}[${idx}].value`,
        requestName,
        scopes,
        options,
      );
    }
    return next;
  });
}

function resolveAuth(
  auth: Auth,
  requestName: string,
  scopes: ScopeInput,
  options?: ResolveRequestOptions,
): Auth {
  const resolvedAuth: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(auth)) {
    if (key === 'type') {
      resolvedAuth[key] = value;
    } else if (typeof value === 'string') {
      resolvedAuth[key] = resolveStringField(value, `auth.${key}`, requestName, scopes, options);
    } else {
      resolvedAuth[key] = value;
    }
  }

  return resolvedAuth as Auth;
}

function resolveBody(
  body: Body,
  requestName: string,
  scopes: ScopeInput,
  options?: ResolveRequestOptions,
): Body {
  const resolvedBody: Body = { ...body };

  if (typeof body.content === 'string') {
    resolvedBody.content = resolveStringField(
      body.content,
      'body.content',
      requestName,
      scopes,
      options,
    );
  }

  if (body.form && Array.isArray(body.form)) {
    resolvedBody.form = resolveKeyValueList(body.form, 'body.form', requestName, scopes, options);
  }

  return resolvedBody;
}

/**
 * Resolves all variables in a request across URL, query params, headers, auth, and body.
 * If options.folder is provided, folder inheritance is applied first.
 * Does not mutate the input request object.
 */
export function resolveRequest(
  request: RequestFile,
  scopes: ScopeInput,
  options?: ResolveRequestOptions,
): RequestFile {
  // 1. Apply folder inheritance if folder(s) provided
  const targetRequest = options?.folder ? applyFolderInheritance(request, options.folder) : request;

  // 2. Resolve URL
  const resolvedUrl = resolveStringField(
    targetRequest.url,
    'url',
    targetRequest.name,
    scopes,
    options,
  );

  // 3. Resolve params
  const resolvedParams = targetRequest.params
    ? resolveKeyValueList(targetRequest.params, 'params', targetRequest.name, scopes, options)
    : undefined;

  // 4. Resolve headers
  const resolvedHeaders = targetRequest.headers
    ? resolveKeyValueList(targetRequest.headers, 'headers', targetRequest.name, scopes, options)
    : undefined;

  // 5. Resolve auth
  const resolvedAuth = targetRequest.auth
    ? resolveAuth(targetRequest.auth, targetRequest.name, scopes, options)
    : undefined;

  // 6. Resolve body
  const resolvedBody = targetRequest.body
    ? resolveBody(targetRequest.body, targetRequest.name, scopes, options)
    : undefined;

  return {
    ...targetRequest,
    url: resolvedUrl,
    params: resolvedParams,
    headers: resolvedHeaders,
    auth: resolvedAuth,
    body: resolvedBody,
  };
}
