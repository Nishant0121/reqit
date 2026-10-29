import { create } from 'zustand';
import type { AppSettings } from '../../../shared/settings-types.js';
import { DEFAULT_APP_SETTINGS } from '../../../shared/settings-types.js';
import { applyTheme } from '../lib/theme';
import { useAppStore } from './appStore';

export type SettingsTab = 'general' | 'request' | 'proxy' | 'history';

interface SettingsState {
  settings: AppSettings;
  isOpen: boolean;
  isLoading: boolean;
  activeTab: SettingsTab;

  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  settings: DEFAULT_APP_SETTINGS,
  isOpen: false,
  isLoading: false,
  activeTab: 'general',

  loadSettings: async () => {
    if (!window.reqitApi?.getSettings) return;
    set({ isLoading: true });
    try {
      const settings = await window.reqitApi.getSettings();
      set({ settings });
      if (settings.theme) {
        applyTheme(settings.theme);
        useAppStore.getState().setTheme(settings.theme);
      }
      if (settings.fontSize) {
        document.documentElement.setAttribute('data-font-size', settings.fontSize);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    if (!window.reqitApi?.updateSettings) {
      set(state => ({ settings: { ...state.settings, ...partial } }));
      return;
    }
    try {
      const updated = await window.reqitApi.updateSettings(partial);
      set({ settings: updated });
      if (partial.theme) {
        applyTheme(partial.theme);
        useAppStore.getState().setTheme(partial.theme);
      }
      if (partial.fontSize) {
        document.documentElement.setAttribute('data-font-size', partial.fontSize);
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  },

  openSettings: (tab?: SettingsTab) => {
    const validTabs: SettingsTab[] = ['general', 'request', 'proxy', 'history'];
    const effectiveTab = typeof tab === 'string' && validTabs.includes(tab) ? tab : 'general';
    set({ isOpen: true, activeTab: effectiveTab });
  },

  closeSettings: () => {
    set({ isOpen: false });
  },

  setActiveTab: (tab: SettingsTab) => {
    set({ activeTab: tab });
  },
}));
