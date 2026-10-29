import { create } from 'zustand';
import type {
  CollectionTree,
  CollectionTreeNode,
  RequestFile,
  WatcherChangeEvent,
} from '@reqit/core';
import type { EnvironmentFile, SecretsFile } from '@reqit/core/format';
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
  environments: Record<string, EnvironmentFile>;
  secrets: SecretsFile | null;
  activeEnvironment: string;

  setActiveCollection: (collection: CollectionItem) => void;
  setRecentCollections: (recents: string[]) => void;
  setActiveEnvironment: (env: string) => void;
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
  saveEnvironment: (name: string, env: EnvironmentFile) => Promise<boolean>;
  deleteEnvironment: (name: string) => Promise<boolean>;
  saveSecrets: (secrets: SecretsFile) => Promise<boolean>;
  getResolvedVariables: (filePath?: string) => Record<string, { value: unknown; scope: string }>;
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
  environments: {},
  secrets: null,
  activeEnvironment: 'none',

  setActiveCollection: (collection: CollectionItem) => {
    set({ activeCollection: collection });
  },

  setRecentCollections: (recents: string[]) => {
    set({ recentCollections: recents });
  },

  setActiveEnvironment: (env: string) => {
    const { currentTree } = get();
    if (currentTree?.rootPath) {
      try {
        localStorage.setItem(`reqit:active-env:${currentTree.rootPath}`, env);
      } catch {
        // ignore
      }
    }
    set({ activeEnvironment: env });
  },

  loadCollection: async (folderPath?: string): Promise<CollectionTree | null> => {
    if (!window.reqitApi?.openCollection) return null;
    set({ isLoading: true, error: null });
    try {
      const tree = await window.reqitApi.openCollection(folderPath);
      if (tree) {
        const storedEnv = localStorage.getItem(`reqit:active-env:${tree.rootPath}`);
        const savedEnv =
          storedEnv !== null
            ? storedEnv
            : (tree.environments && Object.keys(tree.environments)[0]) || 'none';
        set({
          currentTree: tree,
          environments: tree.environments || {},
          secrets: tree.secrets || null,
          activeEnvironment: savedEnv,
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
          environments: tree.environments || {},
          secrets: tree.secrets || null,
          activeEnvironment: 'none',
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
          environments: refreshed.environments || {},
          secrets: refreshed.secrets || null,
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
      environments: event.tree.environments || {},
      secrets: event.tree.secrets || null,
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

  saveEnvironment: async (name: string, env: EnvironmentFile): Promise<boolean> => {
    const { currentTree } = get();
    if (!currentTree?.rootPath || !window.reqitApi?.saveEnvironment) return false;
    try {
      await window.reqitApi.saveEnvironment({
        rootPath: currentTree.rootPath,
        name,
        environment: env,
      });
      const updated = { ...get().environments, [name]: env };
      set({ environments: updated });
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  deleteEnvironment: async (name: string): Promise<boolean> => {
    const { currentTree, activeEnvironment } = get();
    if (!currentTree?.rootPath || !window.reqitApi?.deleteEnvironment) return false;
    try {
      await window.reqitApi.deleteEnvironment({
        rootPath: currentTree.rootPath,
        name,
      });
      const updated = { ...get().environments };
      delete updated[name];
      const newActive = activeEnvironment === name ? 'none' : activeEnvironment;
      set({ environments: updated, activeEnvironment: newActive });
      if (activeEnvironment === name) {
        try {
          localStorage.setItem(`reqit:active-env:${currentTree.rootPath}`, 'none');
        } catch {
          // ignore
        }
      }
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  saveSecrets: async (secrets: SecretsFile): Promise<boolean> => {
    const { currentTree } = get();
    if (!currentTree?.rootPath || !window.reqitApi?.saveSecrets) return false;
    try {
      await window.reqitApi.saveSecrets({
        rootPath: currentTree.rootPath,
        secrets,
      });
      set({ secrets });
      await get().refreshTree();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  getResolvedVariables: (filePath?: string): Record<string, { value: unknown; scope: string }> => {
    const { currentTree, activeEnvironment, environments, secrets } = get();
    const result: Record<string, { value: unknown; scope: string }> = {};

    // 1. Collection variables
    if (currentTree?.collection?.defaults?.variables) {
      for (const [k, v] of Object.entries(currentTree.collection.defaults.variables)) {
        result[k] = { value: v, scope: 'collection' };
      }
    }

    // 2. Folder variables
    if (filePath && currentTree?.tree) {
      const findFolderVars = (
        nodes: CollectionTreeNode[],
        targetPath: string,
      ): Record<string, unknown> => {
        let acc: Record<string, unknown> = {};
        for (const node of nodes) {
          if (node.type === 'folder' && targetPath.startsWith(node.path)) {
            if (node.folder?.variables) {
              acc = { ...acc, ...node.folder.variables };
            }
            if (node.children) {
              acc = { ...acc, ...findFolderVars(node.children, targetPath) };
            }
          }
        }
        return acc;
      };

      const folderVars = findFolderVars(currentTree.tree, filePath);
      for (const [k, v] of Object.entries(folderVars)) {
        result[k] = { value: v, scope: 'folder' };
      }
    }

    // 3. Environment variables
    if (activeEnvironment && activeEnvironment !== 'none') {
      const env = environments[activeEnvironment];
      if (env?.variables) {
        for (const [k, v] of Object.entries(env.variables)) {
          result[k] = { value: v, scope: `environment (${activeEnvironment})` };
        }
      }

      // 4. Secrets
      if (secrets?.environments?.[activeEnvironment]) {
        for (const [k, v] of Object.entries(secrets.environments[activeEnvironment])) {
          result[k] = { value: v, scope: `secrets (${activeEnvironment})` };
        }
      }
    }

    return result;
  },
}));
