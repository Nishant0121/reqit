import { create } from 'zustand';
import { getStoredTheme, applyTheme, type ThemeMode } from '../lib/theme';
import type { ToastItem } from '../components/ui/Toast';

export interface AppState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  splitHeight: number;
  environment: string;
  version: string;
  toasts: ToastItem[];
  shortcutsModalOpen: boolean;

  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSplitHeight: (height: number) => void;
  setEnvironment: (env: string) => void;
  setVersion: (version: string) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  setShortcutsModalOpen: (open: boolean) => void;
}

const STORAGE_SIDEBAR_WIDTH = 'reqit-sidebar-width';
const STORAGE_SPLIT_HEIGHT = 'reqit-split-height';
const STORAGE_ENV = 'reqit-environment';

function getStoredNumber(key: string, fallback: number): number {
  try {
    const val = localStorage.getItem(key);
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function getStoredString(key: string, fallback: string): string {
  try {
    const val = localStorage.getItem(key);
    if (val) return val;
  } catch {
    // ignore
  }
  return fallback;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: getStoredTheme(),
  sidebarOpen: true,
  sidebarWidth: getStoredNumber(STORAGE_SIDEBAR_WIDTH, 260),
  splitHeight: getStoredNumber(STORAGE_SPLIT_HEIGHT, 320),
  environment: getStoredString(STORAGE_ENV, 'none'),
  version: '0.1.0',
  toasts: [],
  shortcutsModalOpen: false,

  setTheme: (theme: ThemeMode) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setSidebarWidth: (width: number) => {
    const clamped = Math.max(220, Math.min(480, width));
    try {
      localStorage.setItem(STORAGE_SIDEBAR_WIDTH, String(clamped));
    } catch {
      // ignore
    }
    set({ sidebarWidth: clamped });
  },

  setSplitHeight: (height: number) => {
    const clamped = Math.max(200, height);
    try {
      localStorage.setItem(STORAGE_SPLIT_HEIGHT, String(clamped));
    } catch {
      // ignore
    }
    set({ splitHeight: clamped });
  },

  setEnvironment: (env: string) => {
    try {
      localStorage.setItem(STORAGE_ENV, env);
    } catch {
      // ignore
    }
    set({ environment: env });
  },

  setVersion: (version: string) => {
    set({ version });
  },

  addToast: (toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastItem = { ...toast, id };

    set(state => ({
      toasts: [...state.toasts.slice(-2), newToast],
    }));

    // Auto-dismiss after 4 seconds unless it's an error
    if (toast.type !== 'error') {
      setTimeout(() => {
        get().removeToast(id);
      }, 4000);
    }

    return id;
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },

  setShortcutsModalOpen: (open: boolean) => {
    set({ shortcutsModalOpen: open });
  },
}));
