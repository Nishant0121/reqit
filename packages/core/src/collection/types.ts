import type { HttpMethod, RequestFile, FolderFile, CollectionFile } from '../format/types.js';

export interface CollectionTreeNode {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  type: 'request' | 'folder';
  method?: HttpMethod;
  request?: RequestFile;
  folder?: FolderFile;
  parseError?: string;
  children?: CollectionTreeNode[];
}

export interface CollectionTree {
  rootPath: string;
  collection: CollectionFile;
  tree: CollectionTreeNode[];
}

export interface WatcherChangedFile {
  path: string;
  type: 'request' | 'folder' | 'collection' | 'unknown';
  exists: boolean;
  content?: string;
  request?: RequestFile;
  parseError?: string;
  isAppWrite?: boolean;
}

export interface WatcherChangeEvent {
  rootPath: string;
  tree: CollectionTree;
  changedPaths: string[];
  deletedPaths: string[];
  details: Record<string, WatcherChangedFile>;
  isAppWrite?: boolean;
}

export interface WatcherOptions {
  debounceMs?: number;
  ignored?: (string | RegExp)[];
}
