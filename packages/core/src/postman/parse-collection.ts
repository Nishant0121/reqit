import type {
  Auth,
  Body,
  CollectionFile,
  FolderFile,
  HttpMethod,
  KeyValue,
  RequestFile,
  SecretsFile,
} from '../format/types.js';
import type {
  ConvertedEnvironmentItem,
  ConvertedFolderItem,
  ConvertedRequestItem,
  PostmanAuth,
  PostmanCollectionV21,
  PostmanEvent,
  PostmanHeader,
  PostmanItem,
  PostmanParsedCollectionResult,
  PostmanRequestBody,
  PostmanRequestObject,
  PostmanUrl,
  PostmanImportReport,
  PostmanImportReportItem,
  PostmanSkippedItem,
} from './types.js';
import { extractPostmanCollection } from './json-utils.js';
import { parsePostmanEnvironment } from './parse-environment.js';

const DYNAMIC_VARIABLE_REGEX = /\{\{\s*(\$[a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Extracts a text description from Postman description fields (string or object).
 */
export function extractDescription(
  desc?: string | { content?: string; type?: string },
): string | undefined {
  if (!desc) return undefined;
  if (typeof desc === 'string') return desc.trim() || undefined;
  if (typeof desc === 'object' && desc.content) return desc.content.trim() || undefined;
  return undefined;
}

/**
 * Scans a string for Postman dynamic variables (e.g. {{$guid}}, {{$randomInt}}).
 */
export function scanDynamicVariables(text: string, context: string, warnings: string[]): void {
  const matches = text.match(DYNAMIC_VARIABLE_REGEX);
  if (matches) {
    const unique = Array.from(new Set(matches));
    warnings.push(
      `Dynamic Postman variable ${unique.join(', ')} detected in ${context}. Reqit currently evaluates environment and collection variables, but dynamic generators may need manual configuration or script support.`,
    );
  }
}

/**
 * Converts Postman Auth into Reqit Auth structure.
 */
export function convertPostmanAuth(
  postmanAuth?: PostmanAuth,
  inheritedAuth?: Auth,
  contextName = 'request',
): { auth?: Auth; warnings: string[] } {
  const warnings: string[] = [];

  if (!postmanAuth || postmanAuth.type === 'inherit') {
    return { auth: inheritedAuth, warnings };
  }

  const type = postmanAuth.type?.toLowerCase();

  if (type === 'noauth') {
    return { auth: { type: 'none' }, warnings };
  }

  if (type === 'bearer') {
    const bearerAttrs = Array.isArray(postmanAuth.bearer) ? postmanAuth.bearer : [];
    const tokenAttr = bearerAttrs.find(a => a.key === 'token') || bearerAttrs[0];
    const token = tokenAttr && tokenAttr.value !== undefined ? String(tokenAttr.value) : '';
    scanDynamicVariables(token, `Bearer token auth in ${contextName}`, warnings);
    return {
      auth: {
        type: 'bearer',
        token,
      },
      warnings,
    };
  }

  if (type === 'basic') {
    const basicAttrs = Array.isArray(postmanAuth.basic) ? postmanAuth.basic : [];
    const userAttr = basicAttrs.find(a => a.key === 'username');
    const passAttr = basicAttrs.find(a => a.key === 'password');
    const username = userAttr && userAttr.value !== undefined ? String(userAttr.value) : '';
    const password = passAttr && passAttr.value !== undefined ? String(passAttr.value) : '';
    scanDynamicVariables(username, `Basic auth username in ${contextName}`, warnings);
    scanDynamicVariables(password, `Basic auth password in ${contextName}`, warnings);
    return {
      auth: {
        type: 'basic',
        username,
        password,
      },
      warnings,
    };
  }

  if (type === 'apikey') {
    const apiAttrs = Array.isArray(postmanAuth.apikey) ? postmanAuth.apikey : [];
    const keyAttr = apiAttrs.find(a => a.key === 'key');
    const valAttr = apiAttrs.find(a => a.key === 'value');
    const inAttr = apiAttrs.find(a => a.key === 'in');

    const key = keyAttr && keyAttr.value !== undefined ? String(keyAttr.value) : 'X-API-Key';
    const value = valAttr && valAttr.value !== undefined ? String(valAttr.value) : '';
    const inLocation =
      inAttr && String(inAttr.value).toLowerCase() === 'query' ? 'query' : 'header';

    scanDynamicVariables(key, `API key name in ${contextName}`, warnings);
    scanDynamicVariables(value, `API key value in ${contextName}`, warnings);

    return {
      auth: {
        type: 'apikey',
        key,
        value,
        in: inLocation,
      },
      warnings,
    };
  }

  if (type === 'oauth2') {
    const oauthAttrs = Array.isArray(postmanAuth.oauth2) ? postmanAuth.oauth2 : [];
    const tokenAttr = oauthAttrs.find(a => a.key === 'accessToken');
    const token = tokenAttr && tokenAttr.value !== undefined ? String(tokenAttr.value) : '';
    warnings.push(
      `OAuth 2.0 configuration approximated for ${contextName}. Please verify credentials in environment/secrets.`,
    );
    return {
      auth: {
        type: 'bearer',
        token,
      },
      warnings,
    };
  }

  // Other or custom auth types
  warnings.push(
    `Auth type "${postmanAuth.type}" in ${contextName} is not natively supported; stored as raw auth configuration.`,
  );
  return {
    auth: {
      ...postmanAuth,
      type: postmanAuth.type,
    },
    warnings,
  };
}

/**
 * Converts Postman URL into base URL and query params.
 */
export function convertPostmanUrl(
  urlInput?: PostmanUrl,
  contextName = 'request',
): { url: string; params?: KeyValue[]; warnings: string[] } {
  const warnings: string[] = [];

  if (!urlInput) {
    return { url: 'https://httpbin.org/get', warnings };
  }

  if (typeof urlInput === 'string') {
    const raw = urlInput.trim();
    scanDynamicVariables(raw, `URL in ${contextName}`, warnings);

    // Extract query string if present
    const queryIdx = raw.indexOf('?');
    if (queryIdx === -1) {
      return { url: raw, warnings };
    }

    const baseUrl = raw.slice(0, queryIdx);
    const queryString = raw.slice(queryIdx + 1);
    const params: KeyValue[] = [];

    if (queryString) {
      const pairs = queryString.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const eqIdx = pair.indexOf('=');
        const name =
          eqIdx !== -1
            ? decodeURIComponentSafe(pair.slice(0, eqIdx))
            : decodeURIComponentSafe(pair);
        const value = eqIdx !== -1 ? decodeURIComponentSafe(pair.slice(eqIdx + 1)) : '';
        params.push({ name, value, enabled: true });
      }
    }

    return {
      url: baseUrl,
      params: params.length > 0 ? params : undefined,
      warnings,
    };
  }

  // url is PostmanUrlObject
  let baseUrl = '';
  if (urlInput.raw) {
    const raw = urlInput.raw.trim();
    scanDynamicVariables(raw, `URL in ${contextName}`, warnings);
    baseUrl = raw.split('?')[0] || raw;
  } else {
    const protocol = urlInput.protocol ? `${urlInput.protocol}://` : 'https://';
    const host = Array.isArray(urlInput.host) ? urlInput.host.join('.') : urlInput.host || '';
    const port = urlInput.port ? `:${urlInput.port}` : '';
    const path = Array.isArray(urlInput.path)
      ? '/' + urlInput.path.join('/')
      : urlInput.path
        ? `/${urlInput.path}`
        : '';
    baseUrl = `${protocol}${host}${port}${path}`;
    scanDynamicVariables(baseUrl, `URL in ${contextName}`, warnings);
  }

  const params: KeyValue[] = [];
  if (Array.isArray(urlInput.query)) {
    for (const q of urlInput.query) {
      if (!q.key && !q.value) continue;
      const name = String(q.key || '');
      const value = q.value !== undefined ? String(q.value) : '';
      scanDynamicVariables(name, `query param name "${name}" in ${contextName}`, warnings);
      scanDynamicVariables(value, `query param value "${name}" in ${contextName}`, warnings);
      params.push({
        name,
        value,
        enabled: q.disabled !== true,
      });
    }
  }

  // Handle path variables if present (e.g. :userId)
  if (Array.isArray(urlInput.variable) && urlInput.variable.length > 0) {
    const pathVars = urlInput.variable.map(v => v.key).filter(Boolean);
    if (pathVars.length > 0) {
      warnings.push(
        `Path variables [${pathVars.join(', ')}] detected in ${contextName}. Ensure matching environment or collection variables are configured.`,
      );
    }
  }

  return {
    url: baseUrl || 'https://httpbin.org/get',
    params: params.length > 0 ? params : undefined,
    warnings,
  };
}

function decodeURIComponentSafe(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Converts Postman headers into Reqit KeyValue[] array.
 */
export function convertPostmanHeaders(
  headerInput?: PostmanHeader[] | string,
  contextName = 'request',
): { headers?: KeyValue[]; warnings: string[] } {
  const warnings: string[] = [];

  if (!headerInput) {
    return { headers: undefined, warnings };
  }

  const headers: KeyValue[] = [];

  if (typeof headerInput === 'string') {
    const lines = headerInput.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const name = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        scanDynamicVariables(name, `header name "${name}" in ${contextName}`, warnings);
        scanDynamicVariables(value, `header value "${name}" in ${contextName}`, warnings);
        headers.push({ name, value, enabled: true });
      }
    }
  } else if (Array.isArray(headerInput)) {
    for (const h of headerInput) {
      if (!h.key && !h.value) continue;
      const name = String(h.key || '');
      const value = h.value !== undefined ? String(h.value) : '';
      scanDynamicVariables(name, `header name "${name}" in ${contextName}`, warnings);
      scanDynamicVariables(value, `header value "${name}" in ${contextName}`, warnings);
      headers.push({
        name,
        value,
        enabled: h.disabled !== true,
      });
    }
  }

  return {
    headers: headers.length > 0 ? headers : undefined,
    warnings,
  };
}

/**
 * Converts Postman Request Body into Reqit Body structure.
 */
export function convertPostmanBody(
  bodyInput?: PostmanRequestBody,
  contextName = 'request',
): { body?: Body; warnings: string[] } {
  const warnings: string[] = [];

  if (!bodyInput || bodyInput.disabled === true) {
    return { body: { type: 'none' }, warnings };
  }

  const mode = bodyInput.mode?.toLowerCase();

  // 1. Raw mode
  if (mode === 'raw') {
    const rawContent = bodyInput.raw || '';
    scanDynamicVariables(rawContent, `body content in ${contextName}`, warnings);

    const lang = bodyInput.options?.raw?.language?.toLowerCase();
    if (lang === 'json') {
      return { body: { type: 'json', content: rawContent }, warnings };
    }

    // Autodetect JSON if language not explicitly set
    const trimmed = rawContent.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(trimmed);
        return { body: { type: 'json', content: rawContent }, warnings };
      } catch {
        // Not valid JSON, keep as text
      }
    }

    return { body: { type: 'text', content: rawContent }, warnings };
  }

  // 2. URL-encoded form
  if (mode === 'urlencoded') {
    const rawList = Array.isArray(bodyInput.urlencoded) ? bodyInput.urlencoded : [];
    const formRows: KeyValue[] = [];

    for (const item of rawList) {
      if (!item.key && !item.value) continue;
      const name = String(item.key || '');
      const value = item.value !== undefined ? String(item.value) : '';
      scanDynamicVariables(name, `urlencoded form key in ${contextName}`, warnings);
      scanDynamicVariables(value, `urlencoded form value in ${contextName}`, warnings);
      formRows.push({
        name,
        value,
        enabled: item.disabled !== true,
      });
    }

    return {
      body: {
        type: 'form',
        form: formRows,
      },
      warnings,
    };
  }

  // 3. Form-data (multipart)
  if (mode === 'formdata') {
    const rawList = Array.isArray(bodyInput.formdata) ? bodyInput.formdata : [];
    const formRows: KeyValue[] = [];

    for (const item of rawList) {
      if (!item.key && !item.value && !item.src) continue;
      const name = String(item.key || '');
      const isFile = item.type === 'file';
      const value = isFile
        ? item.src
          ? String(item.src)
          : ''
        : item.value !== undefined
          ? String(item.value)
          : '';

      scanDynamicVariables(name, `form-data field in ${contextName}`, warnings);
      scanDynamicVariables(value, `form-data value in ${contextName}`, warnings);

      if (isFile) {
        warnings.push(
          `Form-data file field "${name}" in ${contextName} references local file "${value}". Ensure path is valid on this machine.`,
        );
      }

      formRows.push({
        name,
        value,
        isFile,
        enabled: item.disabled !== true,
      });
    }

    return {
      body: {
        type: 'multipart',
        form: formRows,
      },
      warnings,
    };
  }

  // 4. GraphQL
  if (mode === 'graphql') {
    const query = bodyInput.graphql?.query || '';
    let variables = bodyInput.graphql?.variables;

    if (typeof variables === 'string' && variables.trim()) {
      try {
        variables = JSON.parse(variables);
      } catch {
        // Keep as string
      }
    }

    const payload = JSON.stringify({ query, variables: variables || {} }, null, 2);
    scanDynamicVariables(payload, `GraphQL body in ${contextName}`, warnings);
    warnings.push(
      `GraphQL request in ${contextName} converted to standard JSON payload with { query, variables }.`,
    );

    return {
      body: {
        type: 'json',
        content: payload,
      },
      warnings,
    };
  }

  // 5. Binary file
  if (mode === 'file') {
    const src = bodyInput.file?.src || '';
    warnings.push(
      `Binary file upload in ${contextName} references "${src}". Ensure file path is accessible on this machine.`,
    );
    return {
      body: {
        type: 'binary',
        content: src,
      },
      warnings,
    };
  }

  return { body: { type: 'none' }, warnings };
}

/**
 * Carries over Postman scripts (prerequest and test) into Reqit request scripts.
 */
export function convertPostmanScripts(
  events?: PostmanEvent[],
  contextName = 'request',
): { scripts?: { pre?: string; post?: string }; warnings: string[] } {
  const warnings: string[] = [];

  if (!Array.isArray(events) || events.length === 0) {
    return { scripts: undefined, warnings };
  }

  let preScript = '';
  let postScript = '';

  for (const ev of events) {
    if (ev.disabled === true || !ev.script) continue;

    let code = '';
    if (Array.isArray(ev.script.exec)) {
      code = ev.script.exec.join('\n');
    } else if (typeof ev.script.exec === 'string') {
      code = ev.script.exec;
    }

    if (!code.trim()) continue;

    const hasPmCalls = /\bpm\./.test(code);
    if (hasPmCalls) {
      warnings.push(
        `Script in ${contextName} (${ev.listen}) contains Postman pm.* calls (e.g. pm.environment.set). Preserved as script with compatibility notice.`,
      );
      code = `// [Postman ${ev.listen === 'prerequest' ? 'Pre-request' : 'Test'} Script]\n// Note: Unconverted pm.* calls detected.\n${code}`;
    }

    if (ev.listen === 'prerequest') {
      preScript = preScript ? `${preScript}\n\n${code}` : code;
    } else if (ev.listen === 'test') {
      postScript = postScript ? `${postScript}\n\n${code}` : code;
    }
  }

  if (!preScript && !postScript) {
    return { scripts: undefined, warnings };
  }

  return {
    scripts: {
      pre: preScript || undefined,
      post: postScript || undefined,
    },
    warnings,
  };
}

/**
 * Sanitizes a title/name to create a safe file system slug.
 */
export function sanitizeSlug(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Untitled';
}

/**
 * Main parser: converts a Postman Collection v2.1 JSON string or object
 * into Reqit collection, folder, and request structures in memory.
 */
export function parsePostmanCollection(
  rawInput: string | PostmanCollectionV21,
  collectionNameOverride?: string,
): PostmanParsedCollectionResult {
  const extracted = extractPostmanCollection(rawInput);
  const colObj = extracted.collection;

  // Determine collection name
  const collectionName =
    collectionNameOverride?.trim() || colObj.info?.name?.trim() || 'Imported Collection';

  const collectionDescription = extractDescription(colObj.info?.description);

  // Extract collection variables into collection defaults
  const defaultVariables: Record<string, string> = {};
  const globalWarnings: string[] = [];

  if (Array.isArray(colObj.variable)) {
    for (const v of colObj.variable) {
      if (v.key && v.disabled !== true) {
        const key = String(v.key).trim();
        const val = v.value !== undefined ? String(v.value) : '';
        scanDynamicVariables(val, `collection variable "${key}"`, globalWarnings);
        defaultVariables[key] = val;
      }
    }
  }

  // Convert collection-level auth
  const { auth: collectionAuth, warnings: authWarnings } = convertPostmanAuth(
    colObj.auth,
    undefined,
    `Collection "${collectionName}"`,
  );
  globalWarnings.push(...authWarnings);

  const collectionFile: CollectionFile = {
    version: 1,
    name: collectionName,
    docs: collectionDescription,
    defaults: {
      variables: Object.keys(defaultVariables).length > 0 ? defaultVariables : undefined,
      auth: collectionAuth,
    },
  };

  const convertedItems: PostmanImportReportItem[] = [];
  const skippedItems: PostmanSkippedItem[] = [];
  let totalRequests = 0;
  let totalFolders = 0;

  function traverseItems(
    items: PostmanItem[],
    currentParentAuth?: Auth,
    depth = 0,
  ): Array<ConvertedRequestItem | ConvertedFolderItem> {
    const results: Array<ConvertedRequestItem | ConvertedFolderItem> = [];
    const usedSlugs = new Set<string>();

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        skippedItems.push({
          name: 'Invalid item',
          reason: 'Item entry is not a valid object',
        });
        continue;
      }

      const itemName = (item.name || 'Untitled').trim();
      const baseSlug = sanitizeSlug(itemName);
      let uniqueSlug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(uniqueSlug.toLowerCase())) {
        uniqueSlug = `${baseSlug} ${++counter}`;
      }
      usedSlugs.add(uniqueSlug.toLowerCase());

      // Case A: Item is a Folder (contains child item array)
      if (Array.isArray(item.item)) {
        totalFolders++;
        const folderDescription = extractDescription(item.description);

        const { auth: folderAuth, warnings: fAuthWarnings } = convertPostmanAuth(
          item.auth,
          currentParentAuth,
          `folder "${itemName}"`,
        );
        globalWarnings.push(...fAuthWarnings);

        // Recursively convert children
        const children = traverseItems(item.item, folderAuth || currentParentAuth, depth + 1);

        // Record child filenames for folder.yaml order
        const orderList = children.map(c =>
          c.type === 'request' ? `${c.relativePath}.yaml` : c.relativePath,
        );

        const folderData: FolderFile = {
          version: 1,
          name: itemName,
          docs: folderDescription,
          auth: folderAuth,
          order: orderList,
        };

        const convertedFolder: ConvertedFolderItem = {
          type: 'folder',
          name: itemName,
          relativePath: uniqueSlug,
          folder: folderData,
          children,
        };

        results.push(convertedFolder);
        convertedItems.push({
          type: 'folder',
          name: itemName,
          path: uniqueSlug,
          details: `${children.length} items`,
        });
        continue;
      }

      // Case B: Item is a Request
      if (item.request) {
        totalRequests++;
        const reqObj: PostmanRequestObject =
          typeof item.request === 'string' ? { method: 'GET', url: item.request } : item.request;

        const requestWarnings: string[] = [];

        // Method
        const rawMethod = (reqObj.method || 'GET').toUpperCase();
        const method: HttpMethod = [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'HEAD',
          'OPTIONS',
        ].includes(rawMethod)
          ? (rawMethod as HttpMethod)
          : 'GET';

        if (method !== rawMethod) {
          requestWarnings.push(`Method "${rawMethod}" in request "${itemName}" mapped to GET.`);
        }

        // URL and Params
        const {
          url,
          params,
          warnings: urlWarnings,
        } = convertPostmanUrl(reqObj.url, `request "${itemName}"`);
        requestWarnings.push(...urlWarnings);

        // Headers
        const { headers, warnings: headerWarnings } = convertPostmanHeaders(
          reqObj.header,
          `request "${itemName}"`,
        );
        requestWarnings.push(...headerWarnings);

        // Auth (inherits from folder/collection if not specified or set to inherit)
        const { auth: reqAuth, warnings: rAuthWarnings } = convertPostmanAuth(
          reqObj.auth || item.auth,
          currentParentAuth,
          `request "${itemName}"`,
        );
        requestWarnings.push(...rAuthWarnings);

        // Body
        const { body, warnings: bodyWarnings } = convertPostmanBody(
          reqObj.body,
          `request "${itemName}"`,
        );
        requestWarnings.push(...bodyWarnings);

        // Scripts
        const { scripts, warnings: scriptWarnings } = convertPostmanScripts(
          item.event,
          `request "${itemName}"`,
        );
        requestWarnings.push(...scriptWarnings);

        // Description / Docs
        const docs = extractDescription(reqObj.description || item.description);

        const requestFile: RequestFile = {
          version: 1,
          name: itemName,
          method,
          url,
          params,
          headers,
          auth: reqAuth,
          body,
          scripts,
          docs,
        };

        const convertedReq: ConvertedRequestItem = {
          type: 'request',
          name: itemName,
          relativePath: uniqueSlug,
          request: requestFile,
          warnings: requestWarnings,
        };

        results.push(convertedReq);
        globalWarnings.push(...requestWarnings);
        convertedItems.push({
          type: 'request',
          name: itemName,
          path: `${uniqueSlug}.yaml`,
          details: `${method} ${url}`,
        });
        continue;
      }

      // Neither folder nor request
      skippedItems.push({
        name: itemName,
        reason: 'Item is neither a folder nor a request',
      });
    }

    return results;
  }

  const rawItemList = Array.isArray(colObj.item) ? colObj.item : [];
  const items = traverseItems(rawItemList, collectionAuth);

  const environments: ConvertedEnvironmentItem[] = [];
  let secrets: SecretsFile | undefined = undefined;

  if (extracted.embeddedEnvironment) {
    try {
      const parsedEnv = parsePostmanEnvironment(extracted.embeddedEnvironment);
      environments.push({
        type: 'environment',
        name: parsedEnv.environment.name,
        environment: parsedEnv.environment,
        secretCount: parsedEnv.reportNotes.secretCount,
      });
      secrets = parsedEnv.secrets;
      globalWarnings.push(...parsedEnv.reportNotes.warnings);
    } catch {
      // ignore
    }
  }

  const report: PostmanImportReport = {
    collectionName,
    totalRequests,
    totalFolders,
    totalEnvironments: environments.length,
    totalSecrets: environments.reduce((sum, e) => sum + e.secretCount, 0),
    warnings: Array.from(new Set(globalWarnings)),
    convertedItems,
    skippedItems,
    summaryText: `Successfully imported "${collectionName}": ${totalRequests} request(s), ${totalFolders} folder(s).`,
  };

  return {
    collection: collectionFile,
    items,
    environments,
    secrets,
    report,
  };
}
