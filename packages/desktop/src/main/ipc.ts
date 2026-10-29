import { app, ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  sendRequest,
  resolveRequest,
  UndefinedVariableError,
  loadEnvironments,
  loadSecrets,
  parseCollection,
  parseFolder,
  type VariableScopes,
  type RequestFile,
} from '@reqit/core';
import { fileService } from './services/file-service.js';
import type {
  SendRequestPayload,
  ReadBodyChunkPayload,
  ReadBodyChunkResult,
  SaveFilePayload,
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

  // 6. request:send (Phase 11: resolves variables across all scopes)
  ipcMain.handle('request:send', async (_event, payload: SendRequestPayload) => {
    const { requestId, request, options } = payload;
    const abortController = new AbortController();
    activeRequests.set(requestId, abortController);

    try {
      // 1. Gather all variable scopes according to priority:
      // collection < folder < environment < secrets < runtime
      const scopes: VariableScopes = {};

      if (payload.collectionPath && fs.existsSync(payload.collectionPath)) {
        // Scope 1: Collection defaults
        const reqitPath = path.join(payload.collectionPath, 'reqit.yaml');
        if (fs.existsSync(reqitPath)) {
          try {
            const colData = parseCollection(fs.readFileSync(reqitPath, 'utf-8'), reqitPath);
            if (colData.defaults?.variables) {
              scopes.collection = colData.defaults.variables as Record<string, unknown>;
            }
          } catch {
            // ignore
          }
        }

        // Scope 2: Folder level variables
        if ((request as { filePath?: string }).filePath) {
          const folderDir = path.dirname((request as { filePath?: string }).filePath!);
          const folderPath = path.join(folderDir, 'folder.yaml');
          if (fs.existsSync(folderPath)) {
            try {
              const fData = parseFolder(fs.readFileSync(folderPath, 'utf-8'), folderPath);
              if (fData.variables) {
                scopes.folder = fData.variables as Record<string, unknown>;
              }
            } catch {
              // ignore
            }
          }
        }

        // Scope 3: Environment variables & Scope 4: Secrets
        const activeEnv = payload.activeEnvironment;
        if (activeEnv && activeEnv !== 'none') {
          const envs = await loadEnvironments(payload.collectionPath);
          const env = envs[activeEnv];
          if (env?.variables) {
            scopes.environment = env.variables;
          }

          const secrets = await loadSecrets(payload.collectionPath);
          if (secrets?.environments?.[activeEnv]) {
            scopes.secrets = secrets.environments[activeEnv];
          }
        }
      }

      // Scope 5: Runtime variables
      if (payload.runtimeVariables) {
        scopes.runtime = payload.runtimeVariables;
      }

      // 2. Resolve request variables
      let resolvedRequest: RequestFile = request;
      try {
        resolvedRequest = resolveRequest(request, scopes, {
          activeEnvironment:
            payload.activeEnvironment !== 'none' ? payload.activeEnvironment : undefined,
        });
      } catch (err: unknown) {
        if (err instanceof UndefinedVariableError) {
          throw new Error(
            `Undefined variable "{{${err.variableName}}}" in request "${request.name}" (field: ${err.field || 'unknown'}).`,
          );
        }
        throw err;
      }

      const result = await sendRequest(resolvedRequest, {
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

  // 8. collection:open
  ipcMain.handle('collection:open', async (_event, folderPath?: string) => {
    return fileService.openCollection(folderPath);
  });

  // 9. collection:create
  ipcMain.handle('collection:create', async (_event, payload: CreateCollectionPayload) => {
    return fileService.createCollection(payload);
  });

  // 10. collection:getRecent
  ipcMain.handle('collection:getRecent', async () => {
    return fileService.getRecentCollections();
  });

  // 11. collection:createRequest
  ipcMain.handle('collection:createRequest', async (_event, payload: CreateRequestPayload) => {
    return fileService.createRequest(payload);
  });

  // 12. collection:createFolder
  ipcMain.handle('collection:createFolder', async (_event, payload: CreateFolderPayload) => {
    return fileService.createFolder(payload);
  });

  // 13. collection:renameItem
  ipcMain.handle('collection:renameItem', async (_event, payload: RenameItemPayload) => {
    return fileService.renameItem(payload);
  });

  // 14. collection:duplicateRequest
  ipcMain.handle('collection:duplicateRequest', async (_event, sourcePath: string) => {
    return fileService.duplicateRequest(sourcePath);
  });

  // 15. collection:deleteItem
  ipcMain.handle('collection:deleteItem', async (_event, itemPath: string) => {
    return fileService.deleteItem(itemPath);
  });

  // 16. collection:moveItem
  ipcMain.handle('collection:moveItem', async (_event, payload: MoveItemPayload) => {
    return fileService.moveItem(payload);
  });

  // 17. collection:reorder
  ipcMain.handle('collection:reorder', async (_event, payload: ReorderFolderPayload) => {
    return fileService.reorderFolder(payload);
  });

  // 18. collection:saveRequest
  ipcMain.handle('collection:saveRequest', async (_event, payload: SaveRequestPayload) => {
    return fileService.saveRequest(payload);
  });

  // 19. environment:save
  ipcMain.handle('environment:save', async (_event, payload: SaveEnvironmentPayload) => {
    return fileService.saveEnvironment(payload);
  });

  // 20. environment:delete
  ipcMain.handle('environment:delete', async (_event, payload: DeleteEnvironmentPayload) => {
    return fileService.deleteEnvironment(payload);
  });

  // 21. secrets:save
  ipcMain.handle('secrets:save', async (_event, payload: SaveSecretsPayload) => {
    return fileService.saveSecrets(payload);
  });

  // 22. secrets:ensureGitignored
  ipcMain.handle('secrets:ensureGitignored', async (_event, rootPath: string) => {
    return fileService.ensureSecretsGitignored(rootPath);
  });
}
