import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface InspirationTags {
  content_nature: 'concept' | 'question' | 'inspiration' | 'todo';
  cognitive_depth: 'shallow' | 'understanding' | 'application';
  subject: string;
}

export interface InspirationItem {
  id: string;
  content: string;
  tags: InspirationTags;
  tagsManuallyEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InspirationState {
  items: InspirationItem[];
  loading: boolean;
  loadAll: () => void;
  addItem: (content: string, tags: InspirationTags) => void;
  updateTags: (id: string, tags: Partial<InspirationTags>) => void;
  deleteItem: (id: string) => void;
}

const STORAGE_KEY = 'keban-inspirations';

export const useInspirationStore = create<InspirationState>((set) => ({
  items: [],
  loading: false,
  loadAll: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) set({ items: JSON.parse(raw) });
  },
  addItem: (content, tags) => {
    const item: InspirationItem = {
      id: uuidv4(),
      content,
      tags,
      tagsManuallyEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => {
      const items = [item, ...s.items];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return { items };
    });
  },
  updateTags: (id, tags) => {
    set((s) => {
      const items = s.items.map((i) =>
        i.id === id
          ? { ...i, tags: { ...i.tags, ...tags }, tagsManuallyEdited: true, updatedAt: new Date().toISOString() }
          : i
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return { items };
    });
  },
  deleteItem: (id) => {
    set((s) => {
      const items = s.items.filter((i) => i.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return { items };
    });
  },
}));
