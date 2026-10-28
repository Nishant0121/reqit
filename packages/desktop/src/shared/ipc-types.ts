import type { RequestFile, ResponseResult, SendOptions } from '@reqit/core';

export interface SendRequestPayload {
  requestId: string;
  request: RequestFile;
  options?: SendOptions;
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

export interface IpcChannels {
  'app:getVersion': () => Promise<string>;
  'app:getTestUrl': () => Promise<string>;
  'request:send': (payload: SendRequestPayload) => Promise<ResponseResult>;
  'request:cancel': (requestId: string) => Promise<boolean>;
  'dialog:openFile': () => Promise<string | null>;
  'dialog:saveFile': (payload: SaveFilePayload) => Promise<string | null>;
  'response:readBodyChunk': (payload: ReadBodyChunkPayload) => Promise<ReadBodyChunkResult>;
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
  ) => { requestId: string; promise: Promise<ResponseResult> };
  /** Cancels an in-flight request by requestId */
  cancelRequest: (requestId: string) => Promise<boolean>;
  /** Opens native open file dialog and returns chosen file path or null */
  openFileDialog: () => Promise<string | null>;
  /** Saves content or copies a file to destination chosen by the user */
  saveFileDialog: (payload: SaveFilePayload) => Promise<string | null>;
  /** Reads a slice of a large response file on disk */
  readBodyChunk: (payload: ReadBodyChunkPayload) => Promise<ReadBodyChunkResult>;
}
