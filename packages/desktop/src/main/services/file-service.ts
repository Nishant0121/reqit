import * as fs from 'node:fs';
import * as path from 'node:path';
import { app, dialog, shell } from 'electron';
import {
  createCollection,
  createFolder,
  createRequest,
  duplicateRequest,
  moveItem,
  removeSlugFromOrder,
  renameItem,
  reorderFolder,
  saveRequest,
  scanCollection,
  type CollectionTree,
  type CollectionTreeNode,
} from '@reqit/core';
import type {
  CreateCollectionPayload,
  CreateFolderPayload,
  CreateRequestPayload,
  MoveItemPayload,
  RenameItemPayload,
  ReorderFolderPayload,
  SaveRequestPayload,
} from '../../shared/ipc-types.js';

const RECENT_COLLECTIONS_FILE = 'recent-collections.json';

function getRecentFilePath(): string {
  try {
    return path.join(app.getPath('userData'), RECENT_COLLECTIONS_FILE);
  } catch {
    return path.join(process.cwd(), RECENT_COLLECTIONS_FILE);
  }
}

export function loadRecentCollections(): string[] {
  try {
    const filePath = getRecentFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(data)) {
        return data.filter(p => typeof p === 'string' && fs.existsSync(p));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function addRecentCollection(folderPath: string): string[] {
  try {
    const filePath = getRecentFilePath();
    const existing = loadRecentCollections();
    const resolved = path.resolve(folderPath);
    const updated = [resolved, ...existing.filter(p => path.resolve(p) !== resolved)].slice(0, 10);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch {
    return [folderPath];
  }
}

export class FileService {
  /**
   * Opens an existing collection folder or prompts the user with an Electron openDirectory dialog.
   */
  async openCollection(folderPath?: string): Promise<CollectionTree | null> {
    let target = folderPath;

    if (!target) {
      const res = await dialog.showOpenDialog({
        title: 'Open Collection',
        properties: ['openDirectory'],
      });

      if (res.canceled || res.filePaths.length === 0 || !res.filePaths[0]) {
        return null;
      }
      target = res.filePaths[0];
    }

    if (!fs.existsSync(target)) {
      throw new Error(`Directory does not exist: ${target}`);
    }

    const tree = await scanCollection(target);
    addRecentCollection(target);
    return tree;
  }

  /**
   * Creates a new collection directory on disk.
   */
  async createCollection(payload: CreateCollectionPayload): Promise<CollectionTree | null> {
    let { targetDir } = payload;
    const { name } = payload;

    if (!targetDir) {
      const res = await dialog.showOpenDialog({
        title: 'Select Folder for New Collection',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (res.canceled || res.filePaths.length === 0 || !res.filePaths[0]) {
        return null;
      }
      targetDir = res.filePaths[0];
    }

    const { rootPath } = await createCollection(targetDir, name);
    const tree = await scanCollection(rootPath);
    addRecentCollection(rootPath);
    return tree;
  }

  getRecentCollections(): string[] {
    return loadRecentCollections();
  }

  async createRequest(payload: CreateRequestPayload): Promise<CollectionTreeNode> {
    return createRequest(payload.parentDir, payload.name, payload.data);
  }

  async createFolder(payload: CreateFolderPayload): Promise<CollectionTreeNode> {
    return createFolder(payload.parentDir, payload.name);
  }

  async renameItem(payload: RenameItemPayload): Promise<{ newPath: string; newName: string }> {
    return renameItem(payload.itemPath, payload.newName);
  }

  async duplicateRequest(sourcePath: string): Promise<CollectionTreeNode> {
    return duplicateRequest(sourcePath);
  }

  async deleteItem(itemPath: string): Promise<boolean> {
    const resolved = path.resolve(itemPath);
    const parentDir = path.dirname(resolved);
    const slug = path.basename(resolved);

    // 1. Remove from parent order
    await removeSlugFromOrder(parentDir, slug);

    // 2. Trash or delete from filesystem
    try {
      await shell.trashItem(resolved);
    } catch {
      // Fallback if trash unavailable (e.g., CI or headless environment)
      const stat = await fs.promises.stat(resolved);
      if (stat.isDirectory()) {
        await fs.promises.rm(resolved, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(resolved);
      }
    }

    return true;
  }

  async moveItem(payload: MoveItemPayload): Promise<{ newPath: string; newSlug: string }> {
    return moveItem(payload.sourcePath, payload.targetDirPath);
  }

  async reorderFolder(payload: ReorderFolderPayload): Promise<boolean> {
    await reorderFolder(payload.folderPath, payload.order);
    return true;
  }

  async saveRequest(payload: SaveRequestPayload): Promise<boolean> {
    await saveRequest(payload.filePath, payload.request);
    return true;
  }
}

export const fileService = new FileService();
