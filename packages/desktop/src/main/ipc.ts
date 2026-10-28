import { app, ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import { sendRequest } from '@reqit/core';
import type {
  SendRequestPayload,
  ReadBodyChunkPayload,
  ReadBodyChunkResult,
  SaveFilePayload,
} from '../shared/ipc-types.js';

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

  // 3. dialog:openFile
  ipcMain.handle('dialog:openFile', async (): Promise<string | null> => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select File to Upload',
    });
    if (res.canceled || res.filePaths.length === 0) {
      return null;
    }
    return res.filePaths[0] ?? null;
  });

  // 4. dialog:saveFile
  ipcMain.handle(
    'dialog:saveFile',
    async (_event, payload: SaveFilePayload): Promise<string | null> => {
      const { defaultName = 'response.txt', content, sourceFilePath, isBase64 } = payload;
      const res = await dialog.showSaveDialog({
        title: 'Save Response',
        defaultPath: defaultName,
      });

      if (res.canceled || !res.filePath) {
        return null;
      }

      const targetPath = res.filePath;
      if (sourceFilePath && fs.existsSync(sourceFilePath)) {
        await fs.promises.copyFile(sourceFilePath, targetPath);
      } else if (content !== undefined) {
        if (isBase64) {
          await fs.promises.writeFile(targetPath, Buffer.from(content, 'base64'));
        } else {
          await fs.promises.writeFile(targetPath, content, 'utf-8');
        }
      }

      return targetPath;
    },
  );

  // 5. response:readBodyChunk
  ipcMain.handle(
    'response:readBodyChunk',
    async (_event, payload: ReadBodyChunkPayload): Promise<ReadBodyChunkResult> => {
      const { filePath, startByte = 0, lengthBytes = 512 * 1024 } = payload;
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      const stat = await fs.promises.stat(filePath);
      const totalSize = stat.size;
      const readLength = Math.min(lengthBytes, Math.max(0, totalSize - startByte));
      const buffer = Buffer.alloc(readLength);

      const fileHandle = await fs.promises.open(filePath, 'r');
      try {
        await fileHandle.read(buffer, 0, readLength, startByte);
        return {
          content: buffer.toString('utf-8'),
          totalBytes: totalSize,
          loadedBytes: startByte + readLength,
          hasMore: startByte + readLength < totalSize,
        };
      } finally {
        await fileHandle.close();
      }
    },
  );

  // 6. request:send
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
        bodyBase64: result.bodyBase64,
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

  // 7. request:cancel
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
