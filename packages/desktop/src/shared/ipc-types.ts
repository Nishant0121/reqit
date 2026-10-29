import type {
  RequestFile,
  ResponseResult,
  SendOptions,
  CollectionTree,
  CollectionTreeNode,
  WatcherChangeEvent,
  EnvironmentFile,
  SecretsFile,
  HttpMethod,
} from '@reqit/core';
import type { AppSettings } from './settings-types.js';

export type HistoryStatusFilter = 'all' | '2xx' | '4xx' | '5xx' | 'error';

export interface HistoryListFilter {
  query?: string;
  statusFilter?: HistoryStatusFilter;
  limit?: number;
  offset?: number;
}

export interface HistoryEntrySummary {
  id: string;
  timestamp: number;
  collectionPath?: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  sizeBytes?: number;
  isError: boolean;
}

export interface HistoryEntryDetail extends HistoryEntrySummary {
  requestSummary: {
    name: string;
    method: HttpMethod;
    url: string;
    headers?: Array<{ name: string; value: string; enabled?: boolean }>;
    params?: Array<{ name: string; value: string; enabled?: boolean }>;
    auth?: Record<string, unknown>;
    bodyType?: string;
    bodyContent?: string;
    bodyForm?: Array<{ name: string; value: string; enabled?: boolean }>;
  };
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  errorMessage?: string;
}

export interface HistorySettings {
  enabled: boolean;
  maxEntries: number;
  retentionDays: number;
}

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
  'history:list': (
    filter?: HistoryListFilter,
  ) => Promise<{ entries: HistoryEntrySummary[]; total: number }>;
  'history:getById': (id: string) => Promise<HistoryEntryDetail | null>;
  'history:delete': (id: string) => Promise<boolean>;
  'history:clear': () => Promise<boolean>;
  'history:getSettings': () => Promise<HistorySettings>;
  'history:updateSettings': (settings: Partial<HistorySettings>) => Promise<HistorySettings>;
  'collection:openExample': () => Promise<CollectionTree | null>;
  'settings:get': () => Promise<AppSettings>;
  'settings:update': (settings: Partial<AppSettings>) => Promise<AppSettings>;
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
  /** Gets paginated/filtered list of request history entries */
  getHistory: (
    filter?: HistoryListFilter,
  ) => Promise<{ entries: HistoryEntrySummary[]; total: number }>;
  /** Gets full request history detail including body and headers */
  getHistoryDetail: (id: string) => Promise<HistoryEntryDetail | null>;
  /** Deletes a single request history entry by ID */
  deleteHistoryEntry: (id: string) => Promise<boolean>;
  /** Clears all request history entries */
  clearHistory: () => Promise<boolean>;
  /** Gets current history settings */
  getHistorySettings: () => Promise<HistorySettings>;
  /** Updates history settings (enabled, retentionDays, maxEntries) */
  updateHistorySettings: (settings: Partial<HistorySettings>) => Promise<HistorySettings>;
  /** Opens or unpacks the bundled example collection (Httpbin) */
  openExampleCollection: () => Promise<CollectionTree | null>;
  /** Gets application settings (theme, defaults, proxy, history) */
  getSettings: () => Promise<AppSettings>;
  /** Updates application settings */
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  /** Subscribes to native menu actions */
  onMenuAction: (callback: (action: string) => void) => () => void;
}
