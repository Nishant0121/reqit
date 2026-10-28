import { contextBridge, ipcRenderer } from 'electron';
import type { RequestFile, ResponseResult, SendOptions } from '@reqit/core';
import type { ReqitApi, SendRequestPayload } from '../shared/ipc-types.js';

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
  ): { requestId: string; promise: Promise<ResponseResult> } => {
    const requestId = crypto.randomUUID();
    const payload: SendRequestPayload = { requestId, request, options };
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
};

// Expose safe, typed API in renderer window
contextBridge.exposeInMainWorld('reqitApi', api);
