import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/storage/database';

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
  loadAll: () => Promise<void>;
  addItem: (content: string, tags: InspirationTags) => void;
  updateTags: (id: string, tags: Partial<InspirationTags>) => void;
  deleteItem: (id: string) => void;
}

export const useInspirationStore = create<InspirationState>((set, get) => ({
  items: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const all = await db.inspirations.orderBy('createdAt').reverse().toArray();
      set({ items: all as InspirationItem[], loading: false });
    } catch {
      set({ loading: false });
    }
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
    // Optimistic update: add to state immediately
    set((s) => ({ items: [item, ...s.items] }));
    // Persist to Dexie async
    db.inspirations.add(item).catch(() => {
      // Rollback on failure
      set((s) => ({ items: s.items.filter(i => i.id !== item.id) }));
    });
  },

  updateTags: (id, tags) => {
    const now = new Date().toISOString();
    // Optimistic update
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? { ...i, tags: { ...i.tags, ...tags }, tagsManuallyEdited: true, updatedAt: now }
          : i
      ),
    }));
    // Persist to Dexie async
    db.inspirations.update(id, {
      tags: { ...get().items.find(i => i.id === id)!.tags, ...tags },
      tagsManuallyEdited: true,
      updatedAt: now,
    }).catch(() => {
      // Silent failure — UI state still consistent until next reload
    });
  },

  deleteItem: (id) => {
    // Optimistic update
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    // Persist to Dexie async
    db.inspirations.delete(id).catch(() => {
      // Silent failure
    });
  },
}));
