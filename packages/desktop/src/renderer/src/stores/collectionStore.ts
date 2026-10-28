import { create } from 'zustand';

export interface CollectionItem {
  id: string;
  name: string;
  path?: string;
}

export interface CollectionState {
  activeCollection: CollectionItem;
  recentCollections: string[];

  setActiveCollection: (collection: CollectionItem) => void;
  addRecentCollection: (path: string) => void;
}

const STORAGE_RECENT_COLLECTIONS = 'reqit-recent-collections';

function getStoredRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_COLLECTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export const useCollectionStore = create<CollectionState>(set => ({
  activeCollection: {
    id: 'col-default',
    name: 'Default collection',
  },
  recentCollections: getStoredRecent(),

  setActiveCollection: (collection: CollectionItem) => {
    set({ activeCollection: collection });
  },

  addRecentCollection: (path: string) => {
    set(state => {
      const filtered = state.recentCollections.filter(p => p !== path);
      const updated = [path, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(STORAGE_RECENT_COLLECTIONS, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return { recentCollections: updated };
    });
  },
}));
