import type {
  Auth,
  Body,
  FolderFile,
  HttpMethod,
  KeyValue,
  Scripts,
  TestAssertion,
} from '../format/types.js';

export type ScopeName = 'collection' | 'folder' | 'environment' | 'secrets' | 'runtime';

export const SCOPE_PRIORITY: readonly ScopeName[] = [
  'collection',
  'folder',
  'environment',
  'secrets',
  'runtime',
] as const;

export type VariableMap = Record<string, unknown>;

export interface VariableScopes {
  collection?: VariableMap;
  folder?: VariableMap;
  environment?: VariableMap;
  secrets?: VariableMap;
  runtime?: VariableMap;
  [scopeName: string]: VariableMap | unknown;
}

export type ScopeInput = VariableScopes | VariableMap[] | VariableMap;

export interface ScopeVariableEntry {
  name: string;
  value: unknown;
  scope: ScopeName | string;
}

export interface ResolveOptions {
  activeEnvironment?: string;
  callStack?: string[];
  allowUndefined?: boolean;
}

export interface ResolveRequestOptions extends ResolveOptions {
  folder?: FolderFile | FolderFile[];
}

export interface ResolvedRequestFile {
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
  docs?: string;
  [key: string]: unknown;
}
