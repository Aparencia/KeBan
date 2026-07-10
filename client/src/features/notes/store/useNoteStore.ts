import { create } from 'zustand';
import { noteStore, noteFolderStore } from '@/lib/storage';
import { createWithLog, updateWithLog, deleteWithLog } from '@/lib/storage/writeWithLog';
import type { Note, NoteFolder } from '@/types/models';

interface NoteState {
  // 数据
  notes: Note[];
  folders: NoteFolder[];
  isLoading: boolean;
  selectedNoteId: string | null;
  selectedFolderId: string | null;
  searchQuery: string;
  selectedTags: string[];

  // 笔记操作
  loadNotes: () => Promise<void>;
  createNote: (data: {
    title: string;
    content?: string;
    template?: Note['template'];
    folderId?: string;
    tags?: string[];
  }) => Promise<string>;
  updateNote: (id: string, changes: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;

  // 文件夹操作
  loadFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string, color?: string) => Promise<string>;
  updateFolder: (id: string, changes: Partial<NoteFolder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  selectFolder: (id: string | null) => void;

  // 搜索
  setSearchQuery: (query: string) => void;

  // 标签筛选
  toggleTag: (tag: string) => void;
  clearTagFilter: () => void;
  getAllTags: () => string[];

  // 模板
  createFromTemplate: (template: Note['template'], folderId?: string) => Promise<string>;

  // 计算属性
  getFilteredNotes: () => Note[];
}

const sortNotes = (notes: Note[]): Note[] => {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};

const TEMPLATE_CONTENT: Record<Note['template'], string> = {
  outline: JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '大纲笔记' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '一、' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '二、' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '三、' }] },
    ],
  }),
  cornell: JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '康奈尔笔记' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '线索栏' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '关键词 / 问题' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '笔记栏' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '主要内容记录' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '总结栏' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '归纳总结' }] },
    ],
  }),
  qa: JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '问答笔记' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Q1' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'A1' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Q2' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'A2' }] },
    ],
  }),
  mindmap: JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '中心主题' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '分支一' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '分支二' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '分支三' }] }] },
      ]},
    ],
  }),
  free: '',
  blank: '',
};

const TEMPLATE_TITLES: Record<Note['template'], string> = {
  outline: '大纲笔记',
  cornell: '康奈尔笔记',
  qa: '问答笔记',
  mindmap: '思维导图笔记',
  free: '自由笔记',
  blank: '空白笔记',
};

export const useNoteStore = create<NoteState>((set, get) => {
  return {
    notes: [],
    folders: [],
    isLoading: false,
    selectedNoteId: null,
    selectedFolderId: null,
    searchQuery: '',
    selectedTags: [],

    loadNotes: async () => {
      set({ isLoading: true });
      try {
        const notes = await noteStore.getAll();
        set({ notes: sortNotes(notes), isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    createNote: async (data) => {
      const now = new Date();
      const content = data.content ?? '';
      const noteData = {
        title: data.title,
        content,
        template: data.template ?? 'blank',
        folderId: data.folderId,
        tags: data.tags ?? [],
        createdAt: now,
        updatedAt: now,
        wordCount: content.length,
        pinned: false,
      };
      const id = await createWithLog(noteStore, 'notes', noteData);
      await get().loadNotes();
      return id;
    },

    updateNote: async (id, changes) => {
      const updateData: Partial<Note> = { ...changes, updatedAt: new Date() };
      if (changes.content !== undefined) {
        updateData.wordCount = changes.content.length;
      }
      await updateWithLog(noteStore, 'notes', id, updateData);
      await get().loadNotes();
    },

    deleteNote: async (id) => {
      await deleteWithLog(noteStore, 'notes', id);
      const { selectedNoteId } = get();
      if (selectedNoteId === id) {
        set({ selectedNoteId: null });
      }
      await get().loadNotes();
    },

    togglePin: async (id) => {
      const note = await noteStore.getById(id);
      if (note) {
        await updateWithLog(noteStore, 'notes', id, { pinned: !note.pinned, updatedAt: new Date() });
        await get().loadNotes();
      }
    },

    selectNote: (id) => {
      set({ selectedNoteId: id });
    },

    loadFolders: async () => {
      const folders = await noteFolderStore.getAll();
      set({ folders });
    },

    createFolder: async (name, parentId?, color?) => {
      const folderData = {
        name,
        parentId,
        color,
        createdAt: new Date(),
        order: Date.now(),
      };
      const id = await createWithLog(noteFolderStore, 'noteFolders', folderData);
      await get().loadFolders();
      return id;
    },

    updateFolder: async (id, changes) => {
      await updateWithLog(noteFolderStore, 'noteFolders', id, changes);
      await get().loadFolders();
    },

    deleteFolder: async (id) => {
      // 将该文件夹下的笔记移到根目录（folderId 设为 undefined）
      const notes = await noteStore.where('folderId', id);
      for (const note of notes) {
        if (note.id !== undefined) {
          await noteStore.update(note.id, { folderId: undefined });
        }
      }
      await deleteWithLog(noteFolderStore, 'noteFolders', id);
      const { selectedFolderId } = get();
      if (selectedFolderId === id) {
        set({ selectedFolderId: null });
      }
      await get().loadFolders();
      await get().loadNotes();
    },

    selectFolder: (id) => {
      set({ selectedFolderId: id });
    },

    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    toggleTag: (tag) => {
      const { selectedTags } = get();
      if (selectedTags.includes(tag)) {
        set({ selectedTags: selectedTags.filter((t) => t !== tag) });
      } else {
        set({ selectedTags: [...selectedTags, tag] });
      }
    },

    clearTagFilter: () => {
      set({ selectedTags: [] });
    },

    getAllTags: () => {
      const { notes } = get();
      const tagSet = new Set<string>();
      for (const note of notes) {
        for (const tag of note.tags) {
          tagSet.add(tag);
        }
      }
      return Array.from(tagSet).sort();
    },

    createFromTemplate: async (template, folderId?) => {
      const content = TEMPLATE_CONTENT[template];
      const title = TEMPLATE_TITLES[template];
      return get().createNote({ title, content, template, folderId });
    },

    getFilteredNotes: () => {
      const { notes, selectedFolderId, searchQuery, selectedTags } = get();
      let filtered = notes;

      if (selectedFolderId !== null) {
        filtered = filtered.filter((n) => n.folderId === selectedFolderId);
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (n) =>
            n.title.toLowerCase().includes(query) ||
            n.content.toLowerCase().includes(query),
        );
      }

      if (selectedTags.length > 0) {
        filtered = filtered.filter((n) =>
          selectedTags.some((tag) => n.tags.includes(tag)),
        );
      }

      return sortNotes(filtered);
    },
  };
});
