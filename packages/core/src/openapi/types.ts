/**
 * Types for OpenAPI 3.x and Swagger 2.0 schemas,
 * and Reqit OpenAPI import results and reports.
 */

import type {
  RequestFile,
  FolderFile,
  CollectionFile,
  EnvironmentFile,
  HttpMethod,
} from '../format/types.js';

// ==========================================
// OpenAPI 3.x Schema Types
// ==========================================

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenApiServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface OpenApiServer {
  url: string;
  description?: string;
  variables?: Record<string, OpenApiServerVariable>;
}

export interface OpenApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenApiSchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
  [key: string]: unknown;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenApiMediaType>;
}

export interface OpenApiResponse {
  description: string;
  content?: Record<string, OpenApiMediaType>;
  headers?: Record<string, unknown>;
}

export interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<OpenApiParameter | { $ref: string }>;
  requestBody?: OpenApiRequestBody | { $ref: string };
  responses?: Record<string, OpenApiResponse | { $ref: string }>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  servers?: OpenApiServer[];
  [key: string]: unknown;
}

export interface OpenApiPathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  servers?: OpenApiServer[];
  parameters?: Array<OpenApiParameter | { $ref: string }>;
  get?: OpenApiOperation;
  put?: OpenApiOperation;
  post?: OpenApiOperation;
  delete?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
  patch?: OpenApiOperation;
  trace?: OpenApiOperation;
  [key: string]: unknown;
}

export interface OpenApiSchema {
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  format?: string;
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  enum?: unknown[];
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  additionalProperties?: boolean | OpenApiSchema;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  not?: OpenApiSchema;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

export interface OpenApiSecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string; // For apiKey
  in?: 'query' | 'header' | 'cookie'; // For apiKey
  scheme?: string; // For http: 'bearer' | 'basic'
  bearerFormat?: string;
  flows?: Record<string, unknown>; // For oauth2
  openIdConnectUrl?: string;
  [key: string]: unknown;
}

export interface OpenApiTag {
  name: string;
  description?: string;
  externalDocs?: { description?: string; url: string };
}

export interface OpenApiDoc {
  openapi: string;
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  paths: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    responses?: Record<string, OpenApiResponse>;
    parameters?: Record<string, OpenApiParameter>;
    requestBodies?: Record<string, OpenApiRequestBody>;
    securitySchemes?: Record<string, OpenApiSecurityScheme>;
    [key: string]: unknown;
  };
  security?: Array<Record<string, string[]>>;
  tags?: OpenApiTag[];
  [key: string]: unknown;
}

// ==========================================
// Swagger 2.0 Schema Types
// ==========================================

export interface SwaggerSecurityDefinition {
  type: 'basic' | 'apiKey' | 'oauth2';
  description?: string;
  name?: string; // For apiKey
  in?: 'query' | 'header'; // For apiKey
  flow?: 'implicit' | 'password' | 'application' | 'accessCode';
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: Record<string, string>;
  [key: string]: unknown;
}

export interface SwaggerParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'formData' | 'body';
  description?: string;
  required?: boolean;
  type?: string;
  format?: string;
  schema?: OpenApiSchema; // For in: 'body'
  items?: OpenApiSchema;
  default?: unknown;
  example?: unknown;
  enum?: unknown[];
  [key: string]: unknown;
}

export interface SwaggerOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  consumes?: string[];
  produces?: string[];
  parameters?: Array<SwaggerParameter | { $ref: string }>;
  responses?: Record<string, unknown>;
  schemes?: string[];
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  [key: string]: unknown;
}

export interface SwaggerDoc {
  swagger: string;
  info: OpenApiInfo;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: Record<string, Record<string, SwaggerOperation | unknown>>;
  definitions?: Record<string, OpenApiSchema>;
  parameters?: Record<string, SwaggerParameter>;
  responses?: Record<string, unknown>;
  securityDefinitions?: Record<string, SwaggerSecurityDefinition>;
  security?: Array<Record<string, string[]>>;
  tags?: OpenApiTag[];
  [key: string]: unknown;
}

// ==========================================
// Reqit OpenAPI Import & Report Types
// ==========================================

export type SpecFormat = 'openapi3' | 'swagger2' | 'unknown';

export interface OpenApiConvertedRequestItem {
  type: 'request';
  name: string;
  folderPath?: string; // Relative folder e.g. "pet" or undefined for root
  relativePath: string; // e.g. "pet/findPetsByStatus" or "findPetsByStatus"
  method: HttpMethod;
  url: string;
  request: RequestFile;
  warnings: string[];
}

export interface OpenApiConvertedFolderItem {
  type: 'folder';
  name: string;
  relativePath: string; // e.g. "pet"
  folder: FolderFile;
  children: OpenApiConvertedRequestItem[];
}

export interface OpenApiParsedResult {
  specFormat: SpecFormat;
  version: string;
  title: string;
  description?: string;
  baseUrl?: string;
  collection: CollectionFile;
  folders: OpenApiConvertedFolderItem[];
  rootRequests: OpenApiConvertedRequestItem[];
  allRequests: OpenApiConvertedRequestItem[];
  environments?: EnvironmentFile[];
  warnings: string[];
  report: OpenApiImportReport;
}

export interface OpenApiImportReportItem {
  type: 'request' | 'folder' | 'environment';
  name: string;
  path?: string;
  status: 'created' | 'merged' | 'skipped';
  details?: string;
}

export interface OpenApiSkippedItem {
  name: string;
  reason: string;
}

export interface OpenApiImportReport {
  collectionName: string;
  targetDirectory?: string;
  specFormat: SpecFormat;
  totalRequests: number;
  totalFolders: number;
  createdRequests: number;
  mergedRequests: number;
  skippedRequests: number;
  warnings: string[];
  convertedItems: OpenApiImportReportItem[];
  skippedItems: OpenApiSkippedItem[];
  summaryText: string;
}

export type ImportMode = 'add-new' | 'merge' | 'clean';

export interface ImportOpenApiOptions {
  spec: string | Record<string, unknown>;
  targetDir: string;
  collectionNameOverride?: string;
  mode?: ImportMode;
  defaultBaseUrl?: string;
}

export interface OpenApiParseSummary {
  title: string;
  version: string;
  specFormat: SpecFormat;
  totalOperations: number;
  totalTags: number;
  servers: string[];
  warnings: string[];
  operationsPreview: Array<{
    method: string;
    path: string;
    summary?: string;
    tag?: string;
  }>;
}
