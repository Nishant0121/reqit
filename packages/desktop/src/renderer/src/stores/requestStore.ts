import { create } from 'zustand';
import type { HttpMethod, ResponseResult, RequestFile, WatcherChangedFile } from '@reqit/core';
import type { KeyValueRow } from '../components/ui/KeyValueTable';
import type { AuthType, BodyType } from '../components/RequestPanel';
import type { TabItemData } from '../components/RequestTabs';
import { requestFileToDraft } from '../lib/request-mapper';

export interface MultipartRow {
  id: string;
  enabled: boolean;
  key: string;
  type: 'text' | 'file';
  value: string; // text value or file path
  fileName?: string;
  description?: string;
}

export interface RequestConflict {
  diskContent: string;
  diskRequest: RequestFile;
}

export interface RequestDraft {
  id: string;
  filePath?: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  authType: AuthType;
  bearerToken: string;
  basicUser: string;
  basicPass: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
  bodyType: BodyType;
  bodyContent: string;
  bodyFormRows: KeyValueRow[];
  bodyMultipartRows: MultipartRow[];
  isDirty?: boolean;
  parseError?: string;
  rawRequest?: RequestFile;
  conflict?: RequestConflict | null;
  isDeletedOnDisk?: boolean;
}

export interface RequestState {
  drafts: Record<string, RequestDraft>;
  tabs: TabItemData[];
  activeRequestId: string;
  result: ResponseResult | null;
  error: { message: string; cause?: string; action?: string } | null;
  loading: boolean;
  activeExecutionId: string | null;
  historyCount: number;

  createRequest: (initialUrl?: string) => string;
  openRequest: (id: string) => void;
  openDraftFromFile: (filePath: string, file: RequestFile) => void;
  onItemRenamed: (oldPath: string, newPath: string, newName: string) => void;
  onItemDeleted: (deletedPath: string) => void;
  handleWatcherFileChange: (changedPath: string, fileDetails: WatcherChangedFile) => void;
  handleWatcherFileDelete: (deletedPath: string) => void;
  resolveConflictKeepMine: (id: string) => void;
  resolveConflictLoadDisk: (id: string) => void;
  clearDeletedFlag: (id: string) => void;
  closeTab: (id: string) => void;
  updateActiveDraft: (updates: Partial<RequestDraft>) => void;
  saveActiveDraft: () => void;
  setLoading: (loading: boolean) => void;
  setResult: (result: ResponseResult | null) => void;
  setError: (error: { message: string; cause?: string; action?: string } | null) => void;
  setActiveExecutionId: (id: string | null) => void;
  incrementHistoryCount: () => void;
}

const DEFAULT_INITIAL_ID = 'req-1';
const DEFAULT_INITIAL_DRAFT: RequestDraft = {
  id: DEFAULT_INITIAL_ID,
  name: 'Smoke test GET',
  method: 'GET',
  url: 'https://httpbin.org/get',
  params: [],
  headers: [],
  authType: 'none',
  bearerToken: '',
  basicUser: '',
  basicPass: '',
  apiKeyName: '',
  apiKeyValue: '',
  apiKeyIn: 'header',
  bodyType: 'none',
  bodyContent: '',
  bodyFormRows: [],
  bodyMultipartRows: [],
  isDirty: false,
};

export const useRequestStore = create<RequestState>((set, get) => ({
  drafts: {
    [DEFAULT_INITIAL_ID]: DEFAULT_INITIAL_DRAFT,
  },
  tabs: [
    {
      id: DEFAULT_INITIAL_ID,
      name: DEFAULT_INITIAL_DRAFT.name,
      method: DEFAULT_INITIAL_DRAFT.method,
    },
  ],
  activeRequestId: DEFAULT_INITIAL_ID,
  result: null,
  error: null,
  loading: false,
  activeExecutionId: null,
  historyCount: 0,

  createRequest: (initialUrl = 'https://httpbin.org/get') => {
    const id = `req-${Date.now()}`;
    const newCount = Object.keys(get().drafts).length + 1;
    const name = `New request ${newCount}`;

    const newDraft: RequestDraft = {
      id,
      name,
      method: 'GET',
      url: initialUrl,
      params: [],
      headers: [],
      authType: 'none',
      bearerToken: '',
      basicUser: '',
      basicPass: '',
      apiKeyName: '',
      apiKeyValue: '',
      apiKeyIn: 'header',
      bodyType: 'none',
      bodyContent: '',
      bodyFormRows: [],
      bodyMultipartRows: [],
      isDirty: false,
    };

    set(state => ({
      drafts: { ...state.drafts, [id]: newDraft },
      tabs: [...state.tabs, { id, name, method: 'GET' }],
      activeRequestId: id,
      result: null,
      error: null,
    }));

    return id;
  },

  openRequest: (id: string) => {
    const draft = get().drafts[id];
    if (!draft) return;

    set(state => {
      const tabExists = state.tabs.some(t => t.id === id);
      return {
        activeRequestId: id,
        tabs: tabExists
          ? state.tabs
          : [...state.tabs, { id, name: draft.name, method: draft.method }],
      };
    });
  },

  openDraftFromFile: (filePath: string, file: RequestFile) => {
    const existingDraft = get().drafts[filePath];
    const draft =
      existingDraft && existingDraft.isDirty
        ? existingDraft
        : requestFileToDraft(file, filePath, filePath);

    set(state => {
      const tabExists = state.tabs.some(t => t.id === filePath);
      return {
        drafts: { ...state.drafts, [filePath]: draft },
        tabs: tabExists
          ? state.tabs
          : [...state.tabs, { id: filePath, name: draft.name, method: draft.method }],
        activeRequestId: filePath,
        result: null,
        error: null,
      };
    });
  },

  onItemRenamed: (oldPath: string, newPath: string, newName: string) => {
    const { drafts, tabs, activeRequestId } = get();
    const existing = drafts[oldPath];
    if (!existing) return;

    const newDrafts = { ...drafts };
    delete newDrafts[oldPath];
    newDrafts[newPath] = {
      ...existing,
      id: newPath,
      filePath: newPath,
      name: newName,
    };

    const newTabs = tabs.map(t => {
      if (t.id === oldPath) {
        return { ...t, id: newPath, name: newName };
      }
      return t;
    });

    set({
      drafts: newDrafts,
      tabs: newTabs,
      activeRequestId: activeRequestId === oldPath ? newPath : activeRequestId,
    });
  },

  onItemDeleted: (deletedPath: string) => {
    const { drafts, tabs, activeRequestId } = get();
    const nextTabs = tabs.filter(
      t =>
        t.id !== deletedPath &&
        !t.id.startsWith(deletedPath + '/') &&
        !t.id.startsWith(deletedPath + '\\'),
    );
    const newDrafts = { ...drafts };
    Object.keys(newDrafts).forEach(k => {
      if (
        k === deletedPath ||
        k.startsWith(deletedPath + '/') ||
        k.startsWith(deletedPath + '\\')
      ) {
        delete newDrafts[k];
      }
    });

    let nextActiveId = activeRequestId;
    if (
      activeRequestId === deletedPath ||
      activeRequestId.startsWith(deletedPath + '/') ||
      activeRequestId.startsWith(deletedPath + '\\')
    ) {
      nextActiveId = nextTabs.length > 0 ? (nextTabs[nextTabs.length - 1]?.id ?? '') : '';
    }

    set({
      drafts: newDrafts,
      tabs: nextTabs,
      activeRequestId: nextActiveId,
    });
  },

  handleWatcherFileChange: (changedPath: string, fileDetails: WatcherChangedFile) => {
    const { drafts, tabs } = get();
    const normChanged = changedPath.replace(/\\/g, '/').toLowerCase();
    const draftEntry = Object.entries(drafts).find(([, d]) => {
      if (!d.filePath) return false;
      return d.filePath.replace(/\\/g, '/').toLowerCase() === normChanged;
    });

    if (!draftEntry) return;
    const [draftId, draft] = draftEntry;

    if (!fileDetails.request) {
      if (fileDetails.parseError) {
        set(state => ({
          drafts: {
            ...state.drafts,
            [draftId]: { ...draft, parseError: fileDetails.parseError },
          },
        }));
      }
      return;
    }

    if (!draft.isDirty) {
      // Silent reload: disk version updates draft seamlessly
      const reloaded = requestFileToDraft(fileDetails.request, draft.filePath, draft.id);
      const updatedTabs = tabs.map(t =>
        t.id === draftId
          ? { ...t, name: reloaded.name, method: reloaded.method, isDirty: false }
          : t,
      );
      set(state => ({
        drafts: {
          ...state.drafts,
          [draftId]: {
            ...reloaded,
            conflict: null,
            isDeletedOnDisk: false,
          },
        },
        tabs: updatedTabs,
      }));
    } else {
      // Unsaved local edits present -> trigger conflict banner
      set(state => ({
        drafts: {
          ...state.drafts,
          [draftId]: {
            ...draft,
            conflict: {
              diskContent: fileDetails.content ?? '',
              diskRequest: fileDetails.request!,
            },
            isDeletedOnDisk: false,
          },
        },
      }));
    }
  },

  handleWatcherFileDelete: (deletedPath: string) => {
    const { drafts } = get();
    const normDeleted = deletedPath.replace(/\\/g, '/').toLowerCase();
    const matchingEntries = Object.entries(drafts).filter(([, d]) => {
      if (!d.filePath) return false;
      const dNorm = d.filePath.replace(/\\/g, '/').toLowerCase();
      return (
        dNorm === normDeleted ||
        dNorm.startsWith(normDeleted + '/') ||
        dNorm.startsWith(normDeleted + '\\')
      );
    });

    if (matchingEntries.length === 0) return;

    set(state => {
      const nextDrafts = { ...state.drafts };
      for (const [draftId, draft] of matchingEntries) {
        nextDrafts[draftId] = {
          ...draft,
          isDeletedOnDisk: true,
        };
      }
      return { drafts: nextDrafts };
    });
  },

  resolveConflictKeepMine: (id: string) => {
    const draft = get().drafts[id];
    if (!draft) return;
    set(state => ({
      drafts: {
        ...state.drafts,
        [id]: { ...draft, conflict: null },
      },
    }));
  },

  resolveConflictLoadDisk: (id: string) => {
    const { drafts, tabs } = get();
    const draft = drafts[id];
    if (!draft || !draft.conflict?.diskRequest) return;

    const reloaded = requestFileToDraft(draft.conflict.diskRequest, draft.filePath, draft.id);
    const updatedTabs = tabs.map(t =>
      t.id === id ? { ...t, name: reloaded.name, method: reloaded.method, isDirty: false } : t,
    );

    set({
      drafts: {
        ...drafts,
        [id]: {
          ...reloaded,
          conflict: null,
          isDeletedOnDisk: false,
        },
      },
      tabs: updatedTabs,
    });
  },

  clearDeletedFlag: (id: string) => {
    const draft = get().drafts[id];
    if (!draft) return;
    set(state => ({
      drafts: {
        ...state.drafts,
        [id]: { ...draft, isDeletedOnDisk: false },
      },
    }));
  },

  closeTab: (id: string) => {
    const { tabs, activeRequestId } = get();
    if (tabs.length === 1) return; // Keep at least one tab open

    const nextTabs = tabs.filter(t => t.id !== id);
    let nextActiveId = activeRequestId;

    if (activeRequestId === id && nextTabs.length > 0) {
      nextActiveId = nextTabs[nextTabs.length - 1]?.id ?? '';
    }

    set({
      tabs: nextTabs,
      activeRequestId: nextActiveId,
    });
  },

  updateActiveDraft: (updates: Partial<RequestDraft>) => {
    const { activeRequestId, drafts, tabs } = get();
    const current = drafts[activeRequestId];
    if (!current) return;

    const updated = { ...current, ...updates, isDirty: true };

    const updatedTabs = tabs.map(t => {
      if (t.id === activeRequestId) {
        return {
          ...t,
          name: updates.name !== undefined ? updates.name : t.name,
          method: updates.method !== undefined ? updates.method : t.method,
          isDirty: true,
        };
      }
      return t;
    });

    set({
      drafts: { ...drafts, [activeRequestId]: updated },
      tabs: updatedTabs,
    });
  },

  saveActiveDraft: () => {
    const { activeRequestId, drafts, tabs } = get();
    const current = drafts[activeRequestId];
    if (!current) return;

    const savedDraft = { ...current, isDirty: false, isDeletedOnDisk: false };
    const updatedTabs = tabs.map(t => (t.id === activeRequestId ? { ...t, isDirty: false } : t));

    set({
      drafts: { ...drafts, [activeRequestId]: savedDraft },
      tabs: updatedTabs,
    });
  },

  setLoading: (loading: boolean) => set({ loading }),
  setResult: (result: ResponseResult | null) => set({ result }),
  setError: (error: { message: string; cause?: string; action?: string } | null) => set({ error }),
  setActiveExecutionId: (id: string | null) => set({ activeExecutionId: id }),
  incrementHistoryCount: () => set(state => ({ historyCount: state.historyCount + 1 })),
}));
