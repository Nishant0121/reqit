import { create } from 'zustand';
import type {
  HistoryEntrySummary,
  HistoryEntryDetail,
  HistoryListFilter,
  HistoryStatusFilter,
  HistorySettings,
} from '../../../shared/ipc-types.js';

interface HistoryState {
  entries: HistoryEntrySummary[];
  total: number;
  selectedId: string | null;
  selectedDetail: HistoryEntryDetail | null;
  isLoading: boolean;
  searchQuery: string;
  debouncedQuery: string;
  statusFilter: HistoryStatusFilter;
  settings: HistorySettings;
  isDetailOpen: boolean;
  isConfirmClearOpen: boolean;
  isSettingsOpen: boolean;

  loadEntries: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: HistoryStatusFilter) => void;
  selectEntry: (id: string) => Promise<void>;
  closeDetail: () => void;
  deleteEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<HistorySettings>) => Promise<void>;
  setIsConfirmClearOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  total: 0,
  selectedId: null,
  selectedDetail: null,
  isLoading: false,
  searchQuery: '',
  debouncedQuery: '',
  statusFilter: 'all',
  settings: {
    enabled: true,
    maxEntries: 1000,
    retentionDays: 30,
  },
  isDetailOpen: false,
  isConfirmClearOpen: false,
  isSettingsOpen: false,

  loadEntries: async () => {
    if (!window.reqitApi) return;
    set({ isLoading: true });
    try {
      const { debouncedQuery, statusFilter } = get();
      const filter: HistoryListFilter = {
        query: debouncedQuery.trim() || undefined,
        statusFilter,
        limit: 200,
        offset: 0,
      };
      const result = await window.reqitApi.getHistory(filter);
      set({
        entries: result?.entries || [],
        total: result?.total || 0,
      });
    } catch (err) {
      console.error('Failed to load history entries:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // 4. UX & UI Polish: Debounced Real-Time Search (200ms)
    searchDebounceTimer = setTimeout(() => {
      set({ debouncedQuery: query });
      get().loadEntries();
    }, 200);
  },

  setStatusFilter: (statusFilter: HistoryStatusFilter) => {
    set({ statusFilter });
    get().loadEntries();
  },

  selectEntry: async (id: string) => {
    if (!window.reqitApi) return;
    set({ selectedId: id, isDetailOpen: true });
    try {
      const detail = await window.reqitApi.getHistoryDetail(id);
      set({ selectedDetail: detail });
    } catch (err) {
      console.error('Failed to load history detail:', err);
    }
  },

  closeDetail: () => {
    set({ isDetailOpen: false, selectedDetail: null, selectedId: null });
  },

  deleteEntry: async (id: string) => {
    if (!window.reqitApi) return;
    try {
      await window.reqitApi.deleteHistoryEntry(id);
      if (get().selectedId === id) {
        get().closeDetail();
      }
      await get().loadEntries();
    } catch (err) {
      console.error('Failed to delete history entry:', err);
    }
  },

  clearHistory: async () => {
    if (!window.reqitApi) return;
    try {
      await window.reqitApi.clearHistory();
      set({
        entries: [],
        total: 0,
        isConfirmClearOpen: false,
        isDetailOpen: false,
        selectedDetail: null,
        selectedId: null,
      });
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  },

  loadSettings: async () => {
    if (!window.reqitApi) return;
    try {
      const settings = await window.reqitApi.getHistorySettings();
      if (settings) {
        set({ settings });
      }
    } catch (err) {
      console.error('Failed to load history settings:', err);
    }
  },

  updateSettings: async (partial: Partial<HistorySettings>) => {
    if (!window.reqitApi) return;
    try {
      const updated = await window.reqitApi.updateHistorySettings(partial);
      if (updated) {
        set({ settings: updated });
      }
    } catch (err) {
      console.error('Failed to update history settings:', err);
    }
  },

  setIsConfirmClearOpen: (open: boolean) => set({ isConfirmClearOpen: open }),
  setIsSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
}));
