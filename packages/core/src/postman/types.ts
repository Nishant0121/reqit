/**
 * Types for Postman Collection v2.1 and Postman Environment schemas,
 * and Reqit Postman Import results and reports.
 */

import type {
  RequestFile,
  FolderFile,
  CollectionFile,
  EnvironmentFile,
  SecretsFile,
} from '../format/types.js';

// ==========================================
// Postman Collection v2.1.0 JSON Schema Types
// ==========================================

export interface PostmanInfo {
  _postman_id?: string;
  name: string;
  schema: string;
  description?: string | { content: string; type?: string };
  version?: string;
  [key: string]: unknown;
}

export interface PostmanVariable {
  id?: string;
  key: string;
  value?: unknown;
  type?: string;
  name?: string;
  description?: string | { content: string; type?: string };
  disabled?: boolean;
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string | { content: string; type?: string };
}

export interface PostmanQueryParam {
  key: string;
  value?: string;
  disabled?: boolean;
  description?: string | { content: string; type?: string };
}

export interface PostmanUrlObject {
  raw?: string;
  protocol?: string;
  host?: string[] | string;
  path?: string[] | string;
  port?: string;
  query?: PostmanQueryParam[];
  hash?: string;
  variable?: Array<{ key: string; value?: string; description?: string }>;
}

export type PostmanUrl = string | PostmanUrlObject;

export interface PostmanAuthAttribute {
  key: string;
  value: unknown;
  type?: string;
}

export interface PostmanAuth {
  type: string;
  bearer?: PostmanAuthAttribute[];
  basic?: PostmanAuthAttribute[];
  apikey?: PostmanAuthAttribute[];
  oauth2?: PostmanAuthAttribute[];
  noauth?: unknown;
  [key: string]: unknown;
}

export interface PostmanFormUrlencodedParam {
  key: string;
  value?: string;
  disabled?: boolean;
  description?: string | { content: string; type?: string };
}

export interface PostmanFormDataParam {
  key: string;
  value?: string;
  src?: string | string[];
  type?: 'text' | 'file' | string;
  disabled?: boolean;
  description?: string | { content: string; type?: string };
  contentType?: string;
}

export interface PostmanRequestBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | string;
  raw?: string;
  urlencoded?: PostmanFormUrlencodedParam[];
  formdata?: PostmanFormDataParam[];
  file?: { src?: string; content?: string };
  graphql?: {
    query?: string;
    variables?: string | Record<string, unknown>;
  };
  options?: {
    raw?: {
      language?: 'json' | 'text' | 'javascript' | 'html' | 'xml' | string;
    };
  };
  disabled?: boolean;
}

export interface PostmanScript {
  type?: string;
  exec?: string[] | string;
  src?: PostmanUrl;
  id?: string;
  name?: string;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test' | string;
  script?: PostmanScript;
  disabled?: boolean;
}

export interface PostmanRequestObject {
  method?: string;
  url?: PostmanUrl;
  header?: PostmanHeader[] | string;
  body?: PostmanRequestBody;
  auth?: PostmanAuth;
  description?: string | { content: string; type?: string };
  [key: string]: unknown;
}

export interface PostmanItem {
  id?: string;
  name?: string;
  description?: string | { content: string; type?: string };
  item?: PostmanItem[];
  request?: PostmanRequestObject | string;
  response?: unknown[];
  event?: PostmanEvent[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
  [key: string]: unknown;
}

export interface PostmanCollectionV21 {
  info: PostmanInfo;
  item: PostmanItem[];
  auth?: PostmanAuth;
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  [key: string]: unknown;
}

// ==========================================
// Postman Environment JSON Schema Types
// ==========================================

export interface PostmanEnvironmentValue {
  key: string;
  value: unknown;
  type?: 'default' | 'secret' | string;
  enabled?: boolean;
}

export interface PostmanEnvironmentV21 {
  id?: string;
  name: string;
  values: PostmanEnvironmentValue[];
  _postman_variable_scope?: 'environment' | string;
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}

// ==========================================
// Reqit Postman Import Data & Report Types
// ==========================================

export interface ConvertedRequestItem {
  type: 'request';
  name: string;
  relativePath: string;
  request: RequestFile;
  warnings: string[];
}

export interface ConvertedFolderItem {
  type: 'folder';
  name: string;
  relativePath: string;
  folder: FolderFile;
  children: Array<ConvertedRequestItem | ConvertedFolderItem>;
}

export interface ConvertedEnvironmentItem {
  type: 'environment';
  name: string;
  environment: EnvironmentFile;
  secretCount: number;
}

export interface PostmanParsedCollectionResult {
  collection: CollectionFile;
  items: Array<ConvertedRequestItem | ConvertedFolderItem>;
  environments: ConvertedEnvironmentItem[];
  secrets?: SecretsFile;
  report: PostmanImportReport;
}

export interface PostmanImportReportItem {
  type: 'request' | 'folder' | 'environment' | 'secret';
  name: string;
  path?: string;
  details?: string;
}

export interface PostmanSkippedItem {
  name: string;
  reason: string;
}

export interface PostmanImportReport {
  collectionName: string;
  targetDirectory?: string;
  totalRequests: number;
  totalFolders: number;
  totalEnvironments: number;
  totalSecrets: number;
  warnings: string[];
  convertedItems: PostmanImportReportItem[];
  skippedItems: PostmanSkippedItem[];
  summaryText: string;
}

export interface ImportPostmanOptions {
  collectionJson: string | PostmanCollectionV21;
  environmentJson?: string | PostmanEnvironmentV21;
  targetDir: string;
  collectionNameOverride?: string;
}
