import { create } from 'zustand';
import type {
  CollectionTree,
  CollectionTreeNode,
  RequestFile,
  WatcherChangeEvent,
} from '@reqit/core';
import { useRequestStore } from './requestStore';

export interface CollectionItem {
  id: string;
  name: string;
  path?: string;
}

export interface CollectionState {
  currentTree: CollectionTree | null;
  activeCollection: CollectionItem;
  recentCollections: string[];
  isLoading: boolean;
  error: string | null;

  setActiveCollection: (collection: CollectionItem) => void;
  setRecentCollections: (recents: string[]) => void;
  loadCollection: (folderPath?: string) => Promise<CollectionTree | null>;
  createCollection: (name: string, targetDir?: string) => Promise<CollectionTree | null>;
  refreshTree: () => Promise<void>;
  applyWatcherChange: (event: WatcherChangeEvent) => void;
  createRequest: (parentDir: string, name: string) => Promise<CollectionTreeNode | null>;
  createFolder: (parentDir: string, name: string) => Promise<CollectionTreeNode | null>;
  renameItem: (itemPath: string, newName: string) => Promise<boolean>;
  duplicateRequest: (sourcePath: string) => Promise<CollectionTreeNode | null>;
  deleteItem: (itemPath: string) => Promise<boolean>;
  moveItem: (sourcePath: string, targetDirPath: string) => Promise<boolean>;
  reorderFolder: (folderPath: string, order: string[]) => Promise<boolean>;
  saveRequest: (filePath: string, request: RequestFile) => Promise<boolean>;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  currentTree: null,
  activeCollection: {
    id: 'col-default',
    name: 'Reqit Workspace',
  },
  recentCollections: [],
  isLoading: false,
  error: null,

  setActiveCollection: (collection: CollectionItem) => {
    set({ activeCollection: collection });
  },

  setRecentCollections: (recents: string[]) => {
    set({ recentCollections: recents });
  },

  loadCollection: async (folderPath?: string): Promise<CollectionTree | null> => {
    if (!window.reqitApi?.openCollection) return null;
    set({ isLoading: true, error: null });
    try {
      const tree = await window.reqitApi.openCollection(folderPath);
      if (tree) {
        set({
          currentTree: tree,
          activeCollection: {
            id: tree.rootPath,
            name: tree.collection.name,
            path: tree.rootPath,
          },
        });
        const recents = await window.reqitApi.getRecentCollections();
        set({ recentCollections: recents });
      }
      return tree;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  createCollection: async (name: string, targetDir?: string): Promise<CollectionTree | null> => {
    if (!window.reqitApi?.createCollection) return null;
    set({ isLoading: true, error: null });
    try {
      const tree = await window.reqitApi.createCollection({ name, targetDir });
      if (tree) {
        set({
          currentTree: tree,
          activeCollection: {
            id: tree.rootPath,
            name: tree.collection.name,
            path: tree.rootPath,
          },
        });
        const recents = await window.reqitApi.getRecentCollections();
        set({ recentCollections: recents });
      }
      return tree;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshTree: async (): Promise<void> => {
    const { currentTree } = get();
    if (!currentTree?.rootPath || !window.reqitApi?.openCollection) return;
    try {
      const refreshed = await window.reqitApi.openCollection(currentTree.rootPath);
      if (refreshed) {
        set({
          currentTree: refreshed,
          activeCollection: {
            id: refreshed.rootPath,
            name: refreshed.collection.name,
            path: refreshed.rootPath,
          },
        });
      }
    } catch {
      // ignore transient refresh failure
    }
  },

  applyWatcherChange: (event: WatcherChangeEvent): void => {
    // 1. Update collection tree incrementally
    set({
      currentTree: event.tree,
      activeCollection: {
        id: event.tree.rootPath,
        name: event.tree.collection.name,
        path: event.tree.rootPath,
      },
    });

    // 2. Dispatch file events to requestStore
    const requestStore = useRequestStore.getState();

    // Handle deleted files and folders
    for (const deletedPath of event.deletedPaths) {
      requestStore.handleWatcherFileDelete(deletedPath);
    }

    // Handle changed files (ignore app's internal saves for that specific file)
    for (const changedPath of event.changedPaths) {
      const detail = event.details[changedPath];
      if (detail && !detail.isAppWrite && !event.isAppWrite) {
        requestStore.handleWatcherFileChange(changedPath, detail);
      }
    }
  },

  createRequest: async (parentDir: string, name: string): Promise<CollectionTreeNode | null> => {
    if (!window.reqitApi?.createRequest) return null;
    try {
      const node = await window.reqitApi.createRequest({ parentDir, name });
      await get().refreshTree();
      return node;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    }
  },

  createFolder: async (parentDir: string, name: string): Promise<CollectionTreeNode | null> => {
    if (!window.reqitApi?.createFolder) return null;
    try {
      const node = await window.reqitApi.createFolder({ parentDir, name });
      await get().refreshTree();
      return node;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    }
  },

  renameItem: async (itemPath: string, newName: string): Promise<boolean> => {
    if (!window.reqitApi?.renameItem) return false;
    try {
      const res = await window.reqitApi.renameItem({ itemPath, newName });
      useRequestStore.getState().onItemRenamed(itemPath, res.newPath, res.newName);
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  duplicateRequest: async (sourcePath: string): Promise<CollectionTreeNode | null> => {
    if (!window.reqitApi?.duplicateRequest) return null;
    try {
      const node = await window.reqitApi.duplicateRequest(sourcePath);
      await get().refreshTree();
      return node;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    }
  },

  deleteItem: async (itemPath: string): Promise<boolean> => {
    if (!window.reqitApi?.deleteItem) return false;
    try {
      const success = await window.reqitApi.deleteItem(itemPath);
      useRequestStore.getState().onItemDeleted(itemPath);
      await get().refreshTree();
      return success;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  moveItem: async (sourcePath: string, targetDirPath: string): Promise<boolean> => {
    if (!window.reqitApi?.moveItem) return false;
    try {
      const res = await window.reqitApi.moveItem({ sourcePath, targetDirPath });
      const oldDraft = useRequestStore.getState().drafts[sourcePath];
      if (oldDraft) {
        useRequestStore.getState().onItemRenamed(sourcePath, res.newPath, oldDraft.name);
      }
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  reorderFolder: async (folderPath: string, order: string[]): Promise<boolean> => {
    if (!window.reqitApi?.reorderFolder) return false;
    try {
      await window.reqitApi.reorderFolder({ folderPath, order });
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  saveRequest: async (filePath: string, request: RequestFile): Promise<boolean> => {
    if (!window.reqitApi?.saveRequest) return false;
    try {
      await window.reqitApi.saveRequest({ filePath, request });
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },
}));
