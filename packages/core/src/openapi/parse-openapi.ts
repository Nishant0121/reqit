import YAML from 'yaml';
import type {
  Auth,
  Body,
  CollectionFile,
  FolderFile,
  HttpMethod,
  KeyValue,
  RequestFile,
  EnvironmentFile,
} from '../format/types.js';
import type {
  OpenApiConvertedFolderItem,
  OpenApiConvertedRequestItem,
  OpenApiDoc,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiParsedResult,
  OpenApiRequestBody,
  OpenApiSecurityScheme,
  SpecFormat,
  SwaggerDoc,
  SwaggerOperation,
  SwaggerParameter,
  SwaggerSecurityDefinition,
} from './types.js';
import { generateExampleFromSchema, resolveRef } from './schema-generator.js';

const VALID_HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
];

/**
 * Strips characters that are invalid or problematic in filesystem filenames.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'request';
}

/**
 * Converts OpenAPI path template e.g. "/users/{userId}/posts/{postId}"
 * to REST client path parameter syntax "/users/:userId/posts/:postId".
 */
export function convertPathParameters(pathStr: string): string {
  return pathStr.replace(/\{([a-zA-Z0-9_-]+)\}/g, ':$1');
}

/**
 * Parses raw JSON or YAML text into an OpenAPI or Swagger object.
 */
export function parseSpecContent(
  content: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof content === 'object' && content !== null) {
    return content;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('OpenAPI specification content is empty.');
  }

  // Try JSON first if it looks like JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // Fallback to YAML
    }
  }

  try {
    const parsed = YAML.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    throw new Error('Specification parsed to a non-object value.');
  } catch (err) {
    throw new Error(
      `Failed to parse specification as JSON or YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Detects whether the parsed document is OpenAPI 3.x, Swagger 2.0, or unknown.
 */
export function detectSpecFormat(doc: Record<string, unknown>): {
  format: SpecFormat;
  version: string;
} {
  if (typeof doc.openapi === 'string') {
    return { format: 'openapi3', version: doc.openapi };
  }
  if (typeof doc.swagger === 'string') {
    return { format: 'swagger2', version: doc.swagger };
  }
  return { format: 'unknown', version: '0.0.0' };
}

/**
 * Resolves server base URL from OpenAPI 3.x servers or Swagger 2.0 host/basePath.
 */
export function extractBaseUrl(
  doc: Record<string, unknown>,
  format: SpecFormat,
  defaultBaseUrl?: string,
): string {
  if (format === 'openapi3') {
    const servers = (doc as unknown as OpenApiDoc).servers;
    if (Array.isArray(servers) && servers.length > 0 && servers[0]?.url) {
      let rawUrl = servers[0].url.trim();
      // Replace server variables if present
      if (servers[0].variables) {
        for (const [varName, varDef] of Object.entries(servers[0].variables)) {
          rawUrl = rawUrl.replace(new RegExp(`\\{${varName}\\}`, 'g'), varDef.default || '');
        }
      }
      if (rawUrl.startsWith('//')) {
        rawUrl = `https:${rawUrl}`;
      } else if (
        !rawUrl.startsWith('http://') &&
        !rawUrl.startsWith('https://') &&
        !rawUrl.startsWith('{')
      ) {
        if (rawUrl.startsWith('/')) {
          rawUrl = `https://api.example.com${rawUrl}`;
        } else {
          rawUrl = `https://${rawUrl}`;
        }
      }
      return rawUrl.replace(/\/+$/, '');
    }
  } else if (format === 'swagger2') {
    const swDoc = doc as unknown as SwaggerDoc;
    const scheme = swDoc.schemes && swDoc.schemes.length > 0 ? swDoc.schemes[0] : 'https';
    const host = swDoc.host || 'api.example.com';
    const basePath = swDoc.basePath ? swDoc.basePath.replace(/\/+$/, '') : '';
    return `${scheme}://${host}${basePath}`.replace(/\/+$/, '');
  }

  return defaultBaseUrl ? defaultBaseUrl.replace(/\/+$/, '') : 'https://api.example.com';
}

/**
 * Maps an OpenAPI 3.x security scheme or Swagger 2.0 security definition to Reqit Auth.
 */
export function mapSecuritySchemeToAuth(
  schemeName: string,
  schemeDef: OpenApiSecurityScheme | SwaggerSecurityDefinition | undefined,
): Auth | undefined {
  if (!schemeDef) return undefined;

  // OpenAPI 3.x HTTP Bearer
  if (
    'type' in schemeDef &&
    schemeDef.type === 'http' &&
    (schemeDef as OpenApiSecurityScheme).scheme?.toLowerCase() === 'bearer'
  ) {
    return {
      type: 'bearer',
      token: `{{${schemeName}Token || token}}`,
    };
  }

  // HTTP Basic (OpenAPI 3 or Swagger 2)
  if (
    ('type' in schemeDef &&
      schemeDef.type === 'http' &&
      (schemeDef as OpenApiSecurityScheme).scheme?.toLowerCase() === 'basic') ||
    schemeDef.type === 'basic'
  ) {
    return {
      type: 'basic',
      username: '{{username}}',
      password: '{{password}}',
    };
  }

  // API Key (header or query)
  if (schemeDef.type === 'apiKey') {
    const paramName = schemeDef.name || 'X-API-Key';
    const inLoc: 'header' | 'query' = schemeDef.in === 'query' ? 'query' : 'header';
    return {
      type: 'apikey',
      key: paramName,
      value: `{{${schemeName} || apiKey}}`,
      in: inLoc,
    };
  }

  // OAuth2
  if (schemeDef.type === 'oauth2') {
    return {
      type: 'oauth2',
      grantType: 'authorization_code',
      accessToken: `{{${schemeName}Token || oauthToken}}`,
    };
  }

  return undefined;
}

/**
 * Extracts Auth for a specific operation, checking operation-level security first
 * and falling back to document-level security.
 */
function resolveOperationAuth(
  operation: OpenApiOperation,
  rootSecurity: Array<Record<string, string[]>> | undefined,
  securitySchemes: Record<string, OpenApiSecurityScheme | SwaggerSecurityDefinition>,
): Auth | undefined {
  // If operation specifies security: [] -> security is explicitly disabled
  if (Array.isArray(operation.security)) {
    if (operation.security.length === 0) {
      return { type: 'none' };
    }
    const firstReq = operation.security[0];
    if (firstReq) {
      const schemeKey = Object.keys(firstReq)[0];
      if (schemeKey && securitySchemes[schemeKey]) {
        return mapSecuritySchemeToAuth(schemeKey, securitySchemes[schemeKey]);
      }
    }
  }

  // Document-level security fallback
  if (Array.isArray(rootSecurity) && rootSecurity.length > 0 && rootSecurity[0]) {
    const firstReq = rootSecurity[0];
    const schemeKey = Object.keys(firstReq)[0];
    if (schemeKey && securitySchemes[schemeKey]) {
      return mapSecuritySchemeToAuth(schemeKey, securitySchemes[schemeKey]);
    }
  }

  return undefined;
}

/**
 * Converts OpenAPI / Swagger parameters (query, header, path) into Reqit KeyValue items.
 */
function extractParameters(
  params: Array<OpenApiParameter | SwaggerParameter | { $ref: string }>,
  rootDoc: Record<string, unknown>,
): {
  queryParams: KeyValue[];
  headerParams: KeyValue[];
  pathParams: KeyValue[];
} {
  const queryParams: KeyValue[] = [];
  const headerParams: KeyValue[] = [];
  const pathParams: KeyValue[] = [];

  for (const rawParam of params) {
    let param: OpenApiParameter | SwaggerParameter | null = null;
    if ('$ref' in rawParam && typeof rawParam.$ref === 'string') {
      const resolved = resolveRef(rawParam.$ref, rootDoc);
      if (resolved && typeof resolved === 'object') {
        param = resolved as OpenApiParameter;
      }
    } else {
      param = rawParam as OpenApiParameter | SwaggerParameter;
    }

    if (!param || !param.name) continue;

    let paramValue = '';
    if (param.example !== undefined) {
      paramValue = String(param.example);
    } else if (param.default !== undefined) {
      paramValue = String(param.default);
    } else if ('schema' in param && param.schema) {
      const ex = generateExampleFromSchema(param.schema, rootDoc, { propertyName: param.name });
      if (ex !== null && ex !== undefined) {
        paramValue = typeof ex === 'object' ? JSON.stringify(ex) : String(ex);
      }
    }

    const item: KeyValue = {
      name: param.name,
      value: paramValue,
      enabled: true,
      description: param.description || undefined,
    };

    if (param.in === 'query') {
      queryParams.push(item);
    } else if (param.in === 'header') {
      // Avoid duplicate standard pseudo-headers
      if (!['authorization', 'content-type', 'accept'].includes(param.name.toLowerCase())) {
        headerParams.push(item);
      }
    } else if (param.in === 'path') {
      pathParams.push(item);
    }
  }

  return { queryParams, headerParams, pathParams };
}

/**
 * Extracts request body for OpenAPI 3.x operation.
 */
function extractOpenApi3Body(
  requestBody: OpenApiRequestBody | { $ref: string } | undefined,
  rootDoc: Record<string, unknown>,
  _warnings?: string[],
): { body?: Body; contentType?: string } {
  if (!requestBody) return {};

  let resolvedBody: OpenApiRequestBody | null = null;
  if ('$ref' in requestBody && typeof requestBody.$ref === 'string') {
    const resolved = resolveRef(requestBody.$ref, rootDoc);
    if (resolved && typeof resolved === 'object') {
      resolvedBody = resolved as OpenApiRequestBody;
    }
  } else {
    resolvedBody = requestBody as OpenApiRequestBody;
  }

  if (!resolvedBody || !resolvedBody.content) return {};

  const content = resolvedBody.content;

  // 1. Check application/json
  if (content['application/json']) {
    const media = content['application/json'];
    let exampleVal = media.example;
    if (exampleVal === undefined && media.examples) {
      const firstEx = Object.values(media.examples)[0];
      if (firstEx && typeof firstEx === 'object' && 'value' in firstEx) {
        exampleVal = firstEx.value;
      }
    }
    if (exampleVal === undefined && media.schema) {
      exampleVal = generateExampleFromSchema(media.schema, rootDoc);
    }

    const rawJson =
      exampleVal !== undefined && exampleVal !== null
        ? typeof exampleVal === 'string'
          ? exampleVal
          : JSON.stringify(exampleVal, null, 2)
        : '{}';

    return {
      body: {
        type: 'json',
        content: rawJson,
      },
      contentType: 'application/json',
    };
  }

  // 2. Check application/x-www-form-urlencoded
  if (content['application/x-www-form-urlencoded']) {
    const media = content['application/x-www-form-urlencoded'];
    const formItems: KeyValue[] = [];
    if (media.schema && media.schema.properties) {
      for (const [key, propSchema] of Object.entries(media.schema.properties)) {
        const val = generateExampleFromSchema(propSchema, rootDoc, { propertyName: key });
        formItems.push({
          name: key,
          value: val !== null && val !== undefined ? String(val) : '',
          enabled: true,
        });
      }
    }

    return {
      body: {
        type: 'form',
        form: formItems,
      },
      contentType: 'application/x-www-form-urlencoded',
    };
  }

  // 3. Check multipart/form-data
  if (content['multipart/form-data']) {
    const media = content['multipart/form-data'];
    const formItems: KeyValue[] = [];
    if (media.schema && media.schema.properties) {
      for (const [key, propSchema] of Object.entries(media.schema.properties)) {
        const val = generateExampleFromSchema(propSchema, rootDoc, { propertyName: key });
        formItems.push({
          name: key,
          value: val !== null && val !== undefined ? String(val) : '',
          enabled: true,
          type:
            propSchema.format === 'binary' ||
            (propSchema.type === 'string' && propSchema.format === 'byte')
              ? 'file'
              : 'text',
        });
      }
    }

    return {
      body: {
        type: 'multipart',
        form: formItems,
      },
      contentType: 'multipart/form-data',
    };
  }

  // 4. Raw text or XML
  const otherTypes = Object.keys(content);
  if (otherTypes.length > 0 && otherTypes[0]) {
    const ct = otherTypes[0];
    const media = content[ct];
    const exampleVal =
      media?.example ?? (media?.schema ? generateExampleFromSchema(media.schema, rootDoc) : '');
    return {
      body: {
        type: 'text',
        content:
          typeof exampleVal === 'object'
            ? JSON.stringify(exampleVal, null, 2)
            : String(exampleVal ?? ''),
      },
      contentType: ct,
    };
  }

  return {};
}

/**
 * Extracts request body for Swagger 2.0 operation from body/formData parameters.
 */
function extractSwagger2Body(
  params: Array<SwaggerParameter | { $ref: string }>,
  consumes: string[] | undefined,
  rootDoc: Record<string, unknown>,
): { body?: Body; contentType?: string } {
  // Check in: 'body'
  const bodyParam = params.find(p => !('$ref' in p) && p.in === 'body') as
    SwaggerParameter | undefined;
  if (bodyParam && bodyParam.schema) {
    const exampleVal = bodyParam.example ?? generateExampleFromSchema(bodyParam.schema, rootDoc);
    const rawJson =
      exampleVal !== undefined && exampleVal !== null
        ? typeof exampleVal === 'string'
          ? exampleVal
          : JSON.stringify(exampleVal, null, 2)
        : '{}';

    return {
      body: {
        type: 'json',
        content: rawJson,
      },
      contentType: 'application/json',
    };
  }

  // Check in: 'formData'
  const formParams = params.filter(
    p => !('$ref' in p) && p.in === 'formData',
  ) as SwaggerParameter[];
  if (formParams.length > 0) {
    const isMultipart =
      consumes?.some(c => c.includes('multipart/form-data')) ||
      formParams.some(p => p.type === 'file');

    const formItems: KeyValue[] = formParams.map(p => ({
      name: p.name,
      value:
        p.example !== undefined
          ? String(p.example)
          : p.default !== undefined
            ? String(p.default)
            : '',
      enabled: true,
      type: p.type === 'file' ? 'file' : 'text',
      description: p.description || undefined,
    }));

    if (isMultipart) {
      return {
        body: {
          type: 'multipart',
          form: formItems,
        },
        contentType: 'multipart/form-data',
      };
    } else {
      return {
        body: {
          type: 'form',
          form: formItems,
        },
        contentType: 'application/x-www-form-urlencoded',
      };
    }
  }

  return {};
}

/**
 * Main parser: Parses an OpenAPI 3.x or Swagger 2.0 specification into Reqit structures.
 */
export function parseOpenApiSpec(
  input: string | Record<string, unknown>,
  options: {
    collectionNameOverride?: string;
    defaultBaseUrl?: string;
  } = {},
): OpenApiParsedResult {
  const rootDoc = parseSpecContent(input);
  const { format, version } = detectSpecFormat(rootDoc);

  const warnings: string[] = [];
  if (format === 'unknown') {
    warnings.push(
      'Specification format could not be definitively recognized. Attempting best-effort parsing as OpenAPI 3.x.',
    );
  }

  // 1. Basic collection info
  const rawInfo = (rootDoc.info || {}) as Record<string, unknown>;
  const collectionName =
    options.collectionNameOverride ||
    (typeof rawInfo.title === 'string' ? rawInfo.title.trim() : 'OpenAPI Collection');
  const collectionDesc =
    typeof rawInfo.description === 'string' ? rawInfo.description.trim() : undefined;

  // 2. Base URL
  const baseUrl = extractBaseUrl(rootDoc, format, options.defaultBaseUrl);

  // 3. Security Schemes
  const securitySchemes: Record<string, OpenApiSecurityScheme | SwaggerSecurityDefinition> = {};
  if (format === 'openapi3') {
    const components = (rootDoc.components || {}) as Record<string, unknown>;
    const sec = (components.securitySchemes || {}) as Record<string, OpenApiSecurityScheme>;
    Object.assign(securitySchemes, sec);
  } else if (format === 'swagger2') {
    const sec = ((rootDoc as unknown as SwaggerDoc).securityDefinitions || {}) as Record<
      string,
      SwaggerSecurityDefinition
    >;
    Object.assign(securitySchemes, sec);
  }

  // 4. Default / Collection-level security
  const rootSecurity = (rootDoc.security || []) as Array<Record<string, string[]>>;
  let collectionDefaultAuth: Auth | undefined;
  if (rootSecurity.length > 0 && rootSecurity[0]) {
    const firstKey = Object.keys(rootSecurity[0])[0];
    if (firstKey && securitySchemes[firstKey]) {
      collectionDefaultAuth = mapSecuritySchemeToAuth(firstKey, securitySchemes[firstKey]);
    }
  }

  // 5. Tags metadata lookup
  const tagDescriptions: Record<string, string> = {};
  if (Array.isArray(rootDoc.tags)) {
    for (const tag of rootDoc.tags) {
      if (tag && typeof tag === 'object' && typeof tag.name === 'string') {
        if (typeof tag.description === 'string' && tag.description.trim()) {
          tagDescriptions[tag.name.trim()] = tag.description.trim();
        }
      }
    }
  }

  // 6. Iterate paths and operations
  const foldersMap = new Map<string, OpenApiConvertedFolderItem>();
  const rootRequests: OpenApiConvertedRequestItem[] = [];
  const allRequests: OpenApiConvertedRequestItem[] = [];

  const paths = (rootDoc.paths || {}) as Record<string, Record<string, unknown>>;

  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // Common path-level parameters
    const pathLevelParams = Array.isArray(pathItem.parameters)
      ? (pathItem.parameters as Array<OpenApiParameter | SwaggerParameter | { $ref: string }>)
      : [];

    for (const [rawMethod, rawOp] of Object.entries(pathItem)) {
      const upperMethod = rawMethod.toUpperCase() as HttpMethod;
      if (!VALID_HTTP_METHODS.includes(upperMethod)) {
        continue;
      }
      if (!rawOp || typeof rawOp !== 'object') {
        continue;
      }

      const operation = rawOp as OpenApiOperation;
      const opWarnings: string[] = [];

      // Combine parameters: operation parameters override path-level parameters with same name & in
      const opParams = Array.isArray(operation.parameters)
        ? (operation.parameters as Array<OpenApiParameter | SwaggerParameter | { $ref: string }>)
        : [];

      const combinedParams = [...pathLevelParams];
      for (const opP of opParams) {
        if ('$ref' in opP) {
          combinedParams.push(opP);
        } else {
          const idx = combinedParams.findIndex(
            p => !('$ref' in p) && p.name === opP.name && p.in === opP.in,
          );
          if (idx !== -1) {
            combinedParams[idx] = opP;
          } else {
            combinedParams.push(opP);
          }
        }
      }

      // Extract parameters
      const { queryParams, headerParams } = extractParameters(combinedParams, rootDoc);

      // Extract body
      let bodyResult: { body?: Body; contentType?: string } = {};
      if (format === 'openapi3') {
        bodyResult = extractOpenApi3Body(operation.requestBody, rootDoc, opWarnings);
      } else {
        const consumes =
          (operation as SwaggerOperation).consumes || (rootDoc as unknown as SwaggerDoc).consumes;
        bodyResult = extractSwagger2Body(
          combinedParams as Array<SwaggerParameter | { $ref: string }>,
          consumes,
          rootDoc,
        );
      }

      // If Content-Type was identified and not already in headerParams, add it
      if (bodyResult.contentType) {
        const hasCt = headerParams.some(h => h.name.toLowerCase() === 'content-type');
        if (!hasCt) {
          headerParams.unshift({
            name: 'Content-Type',
            value: bodyResult.contentType,
            enabled: true,
          });
        }
      }

      // Extract Auth
      const operationAuth = resolveOperationAuth(operation, rootSecurity, securitySchemes);

      // Build request name and URL
      const convertedUrlPath = convertPathParameters(rawPath);
      const fullUrl = `{{baseUrl}}${convertedUrlPath.startsWith('/') ? '' : '/'}${convertedUrlPath}`;

      let requestName =
        operation.summary?.trim() || operation.operationId?.trim() || `${upperMethod} ${rawPath}`;
      requestName = sanitizeFilename(requestName);

      const requestFile: RequestFile = {
        version: 1,
        name: requestName,
        method: upperMethod,
        url: fullUrl,
        params: queryParams.length > 0 ? queryParams : undefined,
        headers: headerParams.length > 0 ? headerParams : undefined,
        auth: operationAuth,
        body: bodyResult.body,
        docs: operation.description?.trim() || undefined,
      };

      // Folder assignment via primary tag
      const primaryTag =
        Array.isArray(operation.tags) && operation.tags.length > 0 && operation.tags[0]
          ? sanitizeFilename(operation.tags[0].trim())
          : undefined;

      const relativePath = primaryTag ? `${primaryTag}/${requestName}` : requestName;

      const convertedReq: OpenApiConvertedRequestItem = {
        type: 'request',
        name: requestName,
        folderPath: primaryTag,
        relativePath,
        method: upperMethod,
        url: fullUrl,
        request: requestFile,
        warnings: opWarnings,
      };

      allRequests.push(convertedReq);

      if (primaryTag) {
        if (!foldersMap.has(primaryTag)) {
          const folderFile: FolderFile = {
            version: 1,
            name: primaryTag,
            docs: tagDescriptions[primaryTag] || undefined,
          };
          foldersMap.set(primaryTag, {
            type: 'folder',
            name: primaryTag,
            relativePath: primaryTag,
            folder: folderFile,
            children: [],
          });
        }
        foldersMap.get(primaryTag)!.children.push(convertedReq);
      } else {
        rootRequests.push(convertedReq);
      }
    }
  }

  const foldersList = Array.from(foldersMap.values());

  // 7. Collection structure
  const collection: CollectionFile = {
    version: 1,
    name: collectionName,
    defaults: collectionDefaultAuth ? { auth: collectionDefaultAuth } : undefined,
    docs: collectionDesc,
  };

  // 8. Default environment with baseUrl
  const environment: EnvironmentFile = {
    version: 1,
    name: 'default',
    variables: {
      baseUrl,
    },
  };

  // 9. Summary & Report
  const totalRequests = allRequests.length;
  const totalFolders = foldersList.length;

  const report = {
    collectionName,
    specFormat: format,
    totalRequests,
    totalFolders,
    createdRequests: totalRequests,
    mergedRequests: 0,
    skippedRequests: 0,
    warnings: [...warnings],
    convertedItems: allRequests.map(r => ({
      type: 'request' as const,
      name: r.name,
      path: r.relativePath,
      status: 'created' as const,
    })),
    skippedItems: [],
    summaryText: `Successfully parsed ${totalRequests} operations across ${totalFolders} tags into collection "${collectionName}".`,
  };

  return {
    specFormat: format,
    version,
    title: collectionName,
    description: collectionDesc,
    baseUrl,
    collection,
    folders: foldersList,
    rootRequests,
    allRequests,
    environments: [environment],
    warnings,
    report,
  };
}
