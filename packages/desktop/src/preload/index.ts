import { contextBridge, ipcRenderer } from 'electron';
import type { RequestFile, ResponseResult, SendOptions, WatcherChangeEvent } from '@reqit/core';
import type {
  ReqitApi,
  SendRequestPayload,
  CreateCollectionPayload,
  CreateRequestPayload,
  CreateFolderPayload,
  RenameItemPayload,
  MoveItemPayload,
  ReorderFolderPayload,
  SaveRequestPayload,
  SaveEnvironmentPayload,
  DeleteEnvironmentPayload,
  SaveSecretsPayload,
  EnsureSecretsGitignoredResult,
} from '../shared/ipc-types.js';

const api: ReqitApi = {
  getVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:getVersion');
  },
  getTestUrl: (): Promise<string> => {
    return ipcRenderer.invoke('app:getTestUrl');
  },
  sendRequest: (
    request: RequestFile,
    options?: SendOptions,
    context?: {
      activeEnvironment?: string;
      collectionPath?: string;
      runtimeVariables?: Record<string, unknown>;
    },
  ): { requestId: string; promise: Promise<ResponseResult> } => {
    const requestId = crypto.randomUUID();
    const payload: SendRequestPayload = {
      requestId,
      request,
      options,
      activeEnvironment: context?.activeEnvironment,
      collectionPath: context?.collectionPath,
      runtimeVariables: context?.runtimeVariables,
    };
    const promise = (async (): Promise<ResponseResult> => {
      const raw = await ipcRenderer.invoke('request:send', payload);
      return {
        ...raw,
        getHeader: (name: string): string | undefined => {
          const lower = name.toLowerCase();
          const found = raw.headers?.find(
            (h: { name: string; value: string }) => h.name.toLowerCase() === lower,
          );
          return found?.value;
        },
        json: <T = unknown>(): T => {
          if (raw.body === undefined) {
            throw new Error(
              'Response body was streamed to disk or is empty; cannot parse as JSON directly',
            );
          }
          return JSON.parse(raw.body) as T;
        },
      };
    })();
    return { requestId, promise };
  },
  cancelRequest: (requestId: string): Promise<boolean> => {
    return ipcRenderer.invoke('request:cancel', requestId);
  },
  openFileDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:openFile');
  },
  saveFileDialog: (payload: {
    defaultName?: string;
    content?: string;
    sourceFilePath?: string;
  }): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:saveFile', payload);
  },
  readBodyChunk: (payload: { filePath: string; startByte?: number; lengthBytes?: number }) => {
    return ipcRenderer.invoke('response:readBodyChunk', payload);
  },
  openCollection: (folderPath?: string) => {
    return ipcRenderer.invoke('collection:open', folderPath);
  },
  createCollection: (payload: CreateCollectionPayload) => {
    return ipcRenderer.invoke('collection:create', payload);
  },
  getRecentCollections: () => {
    return ipcRenderer.invoke('collection:getRecent');
  },
  createRequest: (payload: CreateRequestPayload) => {
    return ipcRenderer.invoke('collection:createRequest', payload);
  },
  createFolder: (payload: CreateFolderPayload) => {
    return ipcRenderer.invoke('collection:createFolder', payload);
  },
  renameItem: (payload: RenameItemPayload) => {
    return ipcRenderer.invoke('collection:renameItem', payload);
  },
  duplicateRequest: (sourcePath: string) => {
    return ipcRenderer.invoke('collection:duplicateRequest', sourcePath);
  },
  deleteItem: (itemPath: string) => {
    return ipcRenderer.invoke('collection:deleteItem', itemPath);
  },
  moveItem: (payload: MoveItemPayload) => {
    return ipcRenderer.invoke('collection:moveItem', payload);
  },
  reorderFolder: (payload: ReorderFolderPayload) => {
    return ipcRenderer.invoke('collection:reorder', payload);
  },
  saveRequest: (payload: SaveRequestPayload) => {
    return ipcRenderer.invoke('collection:saveRequest', payload);
  },
  saveEnvironment: (payload: SaveEnvironmentPayload): Promise<string> => {
    return ipcRenderer.invoke('environment:save', payload);
  },
  deleteEnvironment: (payload: DeleteEnvironmentPayload): Promise<boolean> => {
    return ipcRenderer.invoke('environment:delete', payload);
  },
  saveSecrets: (payload: SaveSecretsPayload): Promise<string> => {
    return ipcRenderer.invoke('secrets:save', payload);
  },
  ensureSecretsGitignored: (rootPath: string): Promise<EnsureSecretsGitignoredResult> => {
    return ipcRenderer.invoke('secrets:ensureGitignored', rootPath);
  },
  onCollectionChange: (callback: (event: WatcherChangeEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: WatcherChangeEvent) => {
      callback(data);
    };
    ipcRenderer.on('collection:watchChange', handler);
    return () => {
      ipcRenderer.removeListener('collection:watchChange', handler);
    };
  },
};

// Expose safe, typed API in renderer window
contextBridge.exposeInMainWorld('reqitApi', api);
