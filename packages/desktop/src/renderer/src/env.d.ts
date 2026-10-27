/// <reference types="vite/client" />
import type { ReqitApi } from '../../shared/ipc-types.js';

declare global {
  interface Window {
    reqitApi: ReqitApi;
  }
}

export {};
