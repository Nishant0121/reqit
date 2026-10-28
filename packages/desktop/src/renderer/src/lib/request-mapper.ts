import type { RequestFile } from '@reqit/core';
import type { RequestDraft, MultipartRow } from '../stores/requestStore.js';
import type { KeyValueRow } from '../components/ui/KeyValueTable.js';
import type { AuthType, BodyType } from '../components/RequestPanel.js';

/**
 * Converts a parsed `RequestFile` from disk into a UI editable `RequestDraft`.
 */
export function requestFileToDraft(
  file: RequestFile,
  filePath?: string,
  idOverride?: string,
): RequestDraft {
  const id = idOverride ?? filePath ?? `req-${Date.now()}`;

  // Headers
  const headers: KeyValueRow[] = (file.headers || []).map((h, i) => ({
    id: `hdr-${i}-${Date.now()}`,
    key: h.name,
    value: h.value,
    enabled: h.enabled ?? true,
  }));

  // Params (if explicitly listed in file or extracted from url)
  const params: KeyValueRow[] = (file.params || []).map((p, i) => ({
    id: `prm-${i}-${Date.now()}`,
    key: p.name,
    value: p.value,
    enabled: p.enabled ?? true,
  }));

  // Auth mapping
  let authType: AuthType = 'none';
  let bearerToken = '';
  let basicUser = '';
  let basicPass = '';
  let apiKeyName = '';
  let apiKeyValue = '';
  let apiKeyIn: 'header' | 'query' = 'header';

  if (file.auth) {
    const a = file.auth as Record<string, unknown>;
    if (a.type === 'bearer') {
      authType = 'bearer';
      bearerToken = typeof a.token === 'string' ? a.token : '';
    } else if (a.type === 'basic') {
      authType = 'basic';
      basicUser = typeof a.username === 'string' ? a.username : '';
      basicPass = typeof a.password === 'string' ? a.password : '';
    } else if (a.type === 'apikey') {
      authType = 'apiKey';
      apiKeyName = typeof a.key === 'string' ? a.key : '';
      apiKeyValue = typeof a.value === 'string' ? a.value : '';
      apiKeyIn = a.in === 'query' ? 'query' : 'header';
    }
  }

  // Body mapping
  let bodyType: BodyType = 'none';
  let bodyContent = '';
  const bodyFormRows: KeyValueRow[] = [];
  const bodyMultipartRows: MultipartRow[] = [];

  if (file.body) {
    if (file.body.type === 'json' || file.body.type === 'text') {
      bodyType = file.body.type;
      bodyContent = file.body.content ?? '';
    } else if (file.body.type === 'form') {
      bodyType = 'form';
      (file.body.form || []).forEach((row, i) => {
        bodyFormRows.push({
          id: `f-${i}-${Date.now()}`,
          key: row.name,
          value: row.value,
          enabled: row.enabled ?? true,
        });
      });
    } else if (file.body.type === 'multipart') {
      bodyType = 'multipart';
      (file.body.form || []).forEach((row, i) => {
        bodyMultipartRows.push({
          id: `mp-${i}-${Date.now()}`,
          key: row.name,
          type: row.isFile ? 'file' : 'text',
          value: row.value,
          fileName: typeof row.fileName === 'string' ? row.fileName : undefined,
          description: typeof row.description === 'string' ? row.description : undefined,
          enabled: row.enabled ?? true,
        });
      });
    }
  }

  return {
    id,
    filePath,
    name: file.name,
    method: file.method,
    url: file.url,
    params,
    headers,
    authType,
    bearerToken,
    basicUser,
    basicPass,
    apiKeyName,
    apiKeyValue,
    apiKeyIn,
    bodyType,
    bodyContent,
    bodyFormRows,
    bodyMultipartRows,
    isDirty: false,
    rawRequest: file,
  };
}

/**
 * Converts a UI `RequestDraft` back into a `RequestFile` for execution or file persistence.
 */
export function draftToRequestFile(draft: RequestDraft): RequestFile {
  // If draft is completely untouched and we have rawRequest, return it directly to preserve raw symbols
  if (!draft.isDirty && draft.rawRequest) {
    return draft.rawRequest;
  }

  // Headers: keep enabled non-empty rows
  const headers = draft.headers
    .filter(row => row.enabled && row.key.trim() !== '')
    .map(row => ({ name: row.key.trim(), value: row.value, enabled: true }));

  // Params
  const params = draft.params
    .filter(row => row.enabled && row.key.trim() !== '')
    .map(row => ({ name: row.key.trim(), value: row.value, enabled: true }));

  // Auth
  let auth = undefined;
  if (draft.authType === 'bearer' && draft.bearerToken) {
    auth = { type: 'bearer' as const, token: draft.bearerToken };
  } else if (draft.authType === 'basic' && (draft.basicUser || draft.basicPass)) {
    auth = {
      type: 'basic' as const,
      username: draft.basicUser,
      password: draft.basicPass,
    };
  } else if (draft.authType === 'apiKey' && draft.apiKeyName) {
    auth = {
      type: 'apikey' as const,
      key: draft.apiKeyName,
      value: draft.apiKeyValue,
      in: draft.apiKeyIn || ('header' as const),
    };
  }

  // Body
  let body = undefined;
  if (draft.bodyType === 'json' || draft.bodyType === 'text') {
    if (draft.bodyContent) {
      body = { type: draft.bodyType, content: draft.bodyContent };
    }
  } else if (draft.bodyType === 'form') {
    const enabledForm = (draft.bodyFormRows || [])
      .filter(r => r.enabled && r.key.trim() !== '')
      .map(r => ({ name: r.key.trim(), value: r.value, enabled: true }));
    if (enabledForm.length > 0) {
      body = { type: 'form' as const, form: enabledForm };
    }
  } else if (draft.bodyType === 'multipart') {
    const enabledMultipart = (draft.bodyMultipartRows || [])
      .filter(r => r.enabled && r.key.trim() !== '')
      .map(r => ({
        name: r.key.trim(),
        value: r.value,
        type: r.type,
        isFile: r.type === 'file',
        enabled: true,
      }));
    if (enabledMultipart.length > 0) {
      body = { type: 'multipart' as const, form: enabledMultipart };
    }
  }

  return {
    version: 1,
    name: draft.name,
    method: draft.method,
    url: draft.url,
    headers: headers.length > 0 ? headers : undefined,
    params: params.length > 0 ? params : undefined,
    auth,
    body,
  };
}
