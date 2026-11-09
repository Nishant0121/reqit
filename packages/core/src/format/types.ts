/**
 * Reqit core format types.
 * Defines the TypeScript data structures for all persisted YAML files.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValue {
  name: string;
  value: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export type AuthType =
  'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'digest' | 'awsv4' | string;

export interface AuthNone {
  type: 'none';
  [key: string]: unknown;
}

export interface AuthBearer {
  type: 'bearer';
  token: string;
  [key: string]: unknown;
}

export interface AuthBasic {
  type: 'basic';
  username?: string;
  password?: string;
  [key: string]: unknown;
}

export interface AuthApiKey {
  type: 'apikey';
  key: string;
  value: string;
  in: 'header' | 'query';
  [key: string]: unknown;
}

export interface AuthOAuth2 {
  type: 'oauth2';
  grantType: 'authorization_code' | 'client_credentials';
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  redirectUri?: string;
  usePkce?: boolean;
  codeVerifier?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  [key: string]: unknown;
}

export interface AuthDigest {
  type: 'digest';
  username?: string;
  password?: string;
  realm?: string;
  nonce?: string;
  algorithm?: 'MD5' | 'SHA-256' | string;
  qop?: 'auth' | 'auth-int' | string;
  opaque?: string;
  [key: string]: unknown;
}

export interface AuthAwsV4 {
  type: 'awsv4';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  sessionToken?: string;
  [key: string]: unknown;
}

export type Auth =
  | AuthNone
  | AuthBearer
  | AuthBasic
  | AuthApiKey
  | AuthOAuth2
  | AuthDigest
  | AuthAwsV4
  | ({ type: string } & Record<string, unknown>);

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | string;
  hostOnly?: boolean;
  creationDate?: number;
}

export type BodyType = 'none' | 'json' | 'text' | 'form' | 'multipart' | 'graphql' | string;

export interface Body {
  type: BodyType;
  content?: string;
  form?: KeyValue[];
  [key: string]: unknown;
}

export interface Scripts {
  pre?: string;
  post?: string;
  [key: string]: unknown;
}

export interface TestAssertion {
  name: string;
  assert: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface TestAssertionResult {
  name: string;
  assert: string;
  passed: boolean;
  message?: string;
  durationMs?: number;
}

export interface RequestFile {
  version: number;
  name: string;
  method: HttpMethod;
  url: string;
  params?: KeyValue[];
  headers?: KeyValue[];
  auth?: Auth;
  body?: Body;
  scripts?: Scripts;
  tests?: TestAssertion[];
  disableCookieJar?: boolean;
  docs?: string;
  [key: string]: unknown;
}

export interface FolderFile {
  version: number;
  name: string;
  order?: string[];
  headers?: KeyValue[];
  auth?: Auth;
  docs?: string;
  [key: string]: unknown;
}

export interface CollectionDefaults {
  timeoutMs?: number;
  followRedirects?: boolean;
  validateSsl?: boolean;
  headers?: KeyValue[];
  auth?: Auth;
  [key: string]: unknown;
}

export interface CollectionFile {
  version: number;
  name: string;
  defaults?: CollectionDefaults;
  docs?: string;
  [key: string]: unknown;
}

export interface EnvironmentFile {
  version: number;
  name: string;
  variables: Record<string, string>;
  [key: string]: unknown;
}

export interface SecretsFile {
  version: number;
  environments: Record<string, Record<string, string>>;
  [key: string]: unknown;
}

export const CURRENT_FORMAT_VERSION = 1;
