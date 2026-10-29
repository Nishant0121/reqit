import type {
  RequestFile,
  ResponseResult,
  SendOptions,
  CollectionTree,
  CollectionTreeNode,
  WatcherChangeEvent,
  EnvironmentFile,
  SecretsFile,
} from '@reqit/core';

export interface SendRequestPayload {
  requestId: string;
  request: RequestFile;
  options?: SendOptions;
  activeEnvironment?: string;
  collectionPath?: string;
  runtimeVariables?: Record<string, unknown>;
}

export interface ReadBodyChunkPayload {
  filePath: string;
  startByte?: number;
  lengthBytes?: number;
}

export interface ReadBodyChunkResult {
  content: string;
  totalBytes: number;
  loadedBytes: number;
  hasMore: boolean;
}

export interface SaveFilePayload {
  defaultName?: string;
  content?: string;
  sourceFilePath?: string;
  isBase64?: boolean;
}

export interface CreateCollectionPayload {
  targetDir?: string;
  name: string;
}

export interface CreateRequestPayload {
  parentDir: string;
  name: string;
  data?: Partial<RequestFile>;
}

export interface CreateFolderPayload {
  parentDir: string;
  name: string;
}

export interface RenameItemPayload {
  itemPath: string;
  newName: string;
}

export interface MoveItemPayload {
  sourcePath: string;
  targetDirPath: string;
}

export interface ReorderFolderPayload {
  folderPath: string;
  order: string[];
}

export interface SaveRequestPayload {
  filePath: string;
  request: RequestFile;
}

export interface SaveEnvironmentPayload {
  rootPath: string;
  name: string;
  environment: EnvironmentFile;
}

export interface DeleteEnvironmentPayload {
  rootPath: string;
  name: string;
}

export interface SaveSecretsPayload {
  rootPath: string;
  secrets: SecretsFile;
}

export interface EnsureSecretsGitignoredResult {
  gitignoreCreated: boolean;
  added: boolean;
  secretsCreated: boolean;
}

export interface IpcChannels {
  'app:getVersion': () => Promise<string>;
  'app:getTestUrl': () => Promise<string>;
  'request:send': (payload: SendRequestPayload) => Promise<ResponseResult>;
  'request:cancel': (requestId: string) => Promise<boolean>;
  'dialog:openFile': () => Promise<string | null>;
  'dialog:saveFile': (payload: SaveFilePayload) => Promise<string | null>;
  'response:readBodyChunk': (payload: ReadBodyChunkPayload) => Promise<ReadBodyChunkResult>;
  'collection:open': (folderPath?: string) => Promise<CollectionTree | null>;
  'collection:create': (payload: CreateCollectionPayload) => Promise<CollectionTree | null>;
  'collection:getRecent': () => Promise<string[]>;
  'collection:createRequest': (payload: CreateRequestPayload) => Promise<CollectionTreeNode>;
  'collection:createFolder': (payload: CreateFolderPayload) => Promise<CollectionTreeNode>;
  'collection:renameItem': (
    payload: RenameItemPayload,
  ) => Promise<{ newPath: string; newName: string }>;
  'collection:duplicateRequest': (sourcePath: string) => Promise<CollectionTreeNode>;
  'collection:deleteItem': (itemPath: string) => Promise<boolean>;
  'collection:moveItem': (
    payload: MoveItemPayload,
  ) => Promise<{ newPath: string; newSlug: string }>;
  'collection:reorder': (payload: ReorderFolderPayload) => Promise<boolean>;
  'collection:saveRequest': (payload: SaveRequestPayload) => Promise<boolean>;
  'environment:save': (payload: SaveEnvironmentPayload) => Promise<string>;
  'environment:delete': (payload: DeleteEnvironmentPayload) => Promise<boolean>;
  'secrets:save': (payload: SaveSecretsPayload) => Promise<string>;
  'secrets:ensureGitignored': (rootPath: string) => Promise<EnsureSecretsGitignoredResult>;
}

export type IpcChannelName = keyof IpcChannels;

export interface ReqitApi {
  /** Returns the current application version */
  getVersion: () => Promise<string>;
  /** Returns default target test URL (configured by environment in tests) */
  getTestUrl: () => Promise<string>;
  /** Sends an HTTP request through the Node main process request engine */
  sendRequest: (
    request: RequestFile,
    options?: SendOptions,
    context?: {
      activeEnvironment?: string;
      collectionPath?: string;
      runtimeVariables?: Record<string, unknown>;
    },
  ) => { requestId: string; promise: Promise<ResponseResult> };
  /** Cancels an in-flight request by requestId */
  cancelRequest: (requestId: string) => Promise<boolean>;
  /** Opens native open file dialog and returns chosen file path or null */
  openFileDialog: () => Promise<string | null>;
  /** Saves content or copies a file to destination chosen by the user */
  saveFileDialog: (payload: SaveFilePayload) => Promise<string | null>;
  /** Reads a slice of a large response file on disk */
  readBodyChunk: (payload: ReadBodyChunkPayload) => Promise<ReadBodyChunkResult>;
  /** Opens a collection folder or launches openDirectory dialog */
  openCollection: (folderPath?: string) => Promise<CollectionTree | null>;
  /** Creates a new collection directory on disk */
  createCollection: (payload: CreateCollectionPayload) => Promise<CollectionTree | null>;
  /** Returns list of recently opened collection directory paths */
  getRecentCollections: () => Promise<string[]>;
  /** Creates a new request file in parentDir */
  createRequest: (payload: CreateRequestPayload) => Promise<CollectionTreeNode>;
  /** Creates a new folder in parentDir with folder.yaml */
  createFolder: (payload: CreateFolderPayload) => Promise<CollectionTreeNode>;
  /** Renames a request or folder */
  renameItem: (payload: RenameItemPayload) => Promise<{ newPath: string; newName: string }>;
  /** Duplicates an existing request file */
  duplicateRequest: (sourcePath: string) => Promise<CollectionTreeNode>;
  /** Moves an item to trash (or unlinks if trash unavailable) */
  deleteItem: (itemPath: string) => Promise<boolean>;
  /** Moves an item to a target directory */
  moveItem: (payload: MoveItemPayload) => Promise<{ newPath: string; newSlug: string }>;
  /** Reorders children of a folder by updating folder.yaml */
  reorderFolder: (payload: ReorderFolderPayload) => Promise<boolean>;
  /** Saves a request directly to its YAML file */
  saveRequest: (payload: SaveRequestPayload) => Promise<boolean>;
  /** Saves an environment YAML definition */
  saveEnvironment: (payload: SaveEnvironmentPayload) => Promise<string>;
  /** Deletes an environment YAML file */
  deleteEnvironment: (payload: DeleteEnvironmentPayload) => Promise<boolean>;
  /** Saves secrets to .reqit/secrets.yaml */
  saveSecrets: (payload: SaveSecretsPayload) => Promise<string>;
  /** Ensures .reqit/secrets.yaml is in .gitignore and creates starter secrets */
  ensureSecretsGitignored: (rootPath: string) => Promise<EnsureSecretsGitignoredResult>;
  /** Subscribes to live collection file watcher changes */
  onCollectionChange: (callback: (event: WatcherChangeEvent) => void) => () => void;
}
