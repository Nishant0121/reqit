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
