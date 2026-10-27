import { app, ipcMain } from 'electron';
import { sendRequest } from '@reqit/core';
import type { SendRequestPayload } from '../shared/ipc-types.js';

const activeRequests = new Map<string, AbortController>();

export function registerIpcHandlers(): void {
  // 1. app:getVersion
  ipcMain.handle('app:getVersion', async (): Promise<string> => {
    return app.getVersion() || '0.1.0';
  });

  // 2. app:getTestUrl
  ipcMain.handle('app:getTestUrl', async (): Promise<string> => {
    const testPort = process.env.TEST_SERVER_PORT;
    if (testPort) {
      return `http://127.0.0.1:${testPort}/`;
    }
    return 'https://httpbin.org/get';
  });

  // 3. request:send
  ipcMain.handle('request:send', async (_event, payload: SendRequestPayload) => {
    const { requestId, request, options } = payload;
    const abortController = new AbortController();
    activeRequests.set(requestId, abortController);

    try {
      const result = await sendRequest(request, {
        ...options,
        signal: abortController.signal,
      });

      // Ensure only structured cloneable data is sent across IPC (no functions)
      return {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body,
        bodyPath: result.bodyPath,
        sizeBytes: result.sizeBytes,
        totalMs: result.totalMs,
        timing: result.timing,
        redirectHops: result.redirectHops,
        redirects: result.redirects,
      };
    } finally {
      activeRequests.delete(requestId);
    }
  });

  // 4. request:cancel
  ipcMain.handle('request:cancel', async (_event, requestId: string): Promise<boolean> => {
    const controller = activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      activeRequests.delete(requestId);
      return true;
    }
    return false;
  });
}
