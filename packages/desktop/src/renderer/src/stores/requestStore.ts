import { create } from 'zustand';
import type { HttpMethod, ResponseResult } from '@reqit/core';
import type { KeyValueRow } from '../components/ui/KeyValueTable';
import type { AuthType, BodyType } from '../components/RequestPanel';
import type { TabItemData } from '../components/RequestTabs';

export interface MultipartRow {
  id: string;
  enabled: boolean;
  key: string;
  type: 'text' | 'file';
  value: string; // text value or file path
  fileName?: string;
  description?: string;
}

export interface RequestDraft {
  id: string;
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

    const savedDraft = { ...current, isDirty: false };
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
