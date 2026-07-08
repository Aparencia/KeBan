import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note } from '@/types/models';

// Mock storage to isolate pure business logic
vi.mock('@/lib/storage', () => ({
  noteStore: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(1),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    where: vi.fn().mockResolvedValue([]),
  },
  noteFolderStore: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(1),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useNoteStore } from './useNoteStore';

// Helper to create a Note with sensible defaults
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    title: 'Test Note',
    content: 'test content',
    template: 'blank',
    tags: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    wordCount: 12,
    pinned: false,
    ...overrides,
  };
}

const SAMPLE_NOTES: Note[] = [
  makeNote({ id: 1, title: 'Alpha', content: 'hello world', updatedAt: new Date('2025-01-03'), folderId: 1 }),
  makeNote({ id: 2, title: 'Beta', content: 'foo bar', updatedAt: new Date('2025-01-02'), folderId: 2, pinned: true }),
  makeNote({ id: 3, title: 'Gamma', content: 'hello foo', updatedAt: new Date('2025-01-01'), folderId: 1 }),
  makeNote({ id: 4, title: 'Delta', content: 'nothing here', updatedAt: new Date('2025-01-04') }),
];

beforeEach(() => {
  useNoteStore.setState({
    notes: SAMPLE_NOTES,
    folders: [],
    isLoading: false,
    selectedNoteId: null,
    selectedFolderId: null,
    searchQuery: '',
  });
});

describe('Note Store - Pure Business Logic', () => {
  // ── selectNote / selectFolder / setSearchQuery ────────────

  describe('simple setters', () => {
    it('should select a note by id', () => {
      useNoteStore.getState().selectNote(2);
      expect(useNoteStore.getState().selectedNoteId).toBe(2);
    });

    it('should clear selected note with null', () => {
      useNoteStore.setState({ selectedNoteId: 3 });
      useNoteStore.getState().selectNote(null);
      expect(useNoteStore.getState().selectedNoteId).toBeNull();
    });

    it('should select a folder by id', () => {
      useNoteStore.getState().selectFolder(1);
      expect(useNoteStore.getState().selectedFolderId).toBe(1);
    });

    it('should set search query', () => {
      useNoteStore.getState().setSearchQuery('hello');
      expect(useNoteStore.getState().searchQuery).toBe('hello');
    });
  });

  // ── getFilteredNotes - sort order ─────────────────────────

  describe('getFilteredNotes - sort order', () => {
    it('should return pinned notes first', () => {
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result[0].id).toBe(2); // Beta is pinned
    });

    it('should sort non-pinned notes by updatedAt descending', () => {
      const result = useNoteStore.getState().getFilteredNotes();
      // After pinned Beta (id=2): Delta(Jan4) > Alpha(Jan3) > Gamma(Jan1)
      expect(result[1].id).toBe(4);
      expect(result[2].id).toBe(1);
      expect(result[3].id).toBe(3);
    });
  });

  // ── getFilteredNotes - folder filter ──────────────────────

  describe('getFilteredNotes - folder filter', () => {
    it('should filter notes by selectedFolderId', () => {
      useNoteStore.setState({ selectedFolderId: 1 });
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toEqual([1, 3]); // Alpha, Gamma in folder 1
    });

    it('should return all notes when no folder selected', () => {
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(4);
    });
  });

  // ── getFilteredNotes - search ─────────────────────────────

  describe('getFilteredNotes - search', () => {
    it('should filter by title (case-insensitive)', () => {
      useNoteStore.setState({ searchQuery: 'alpha' });
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Alpha');
    });

    it('should filter by content (case-insensitive)', () => {
      useNoteStore.setState({ searchQuery: 'HELLO' });
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(2); // Alpha ("hello world") and Gamma ("hello foo")
    });

    it('should combine folder filter and search', () => {
      useNoteStore.setState({ selectedFolderId: 1, searchQuery: 'hello' });
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(2); // Alpha and Gamma both in folder 1 and contain "hello"
    });

    it('should return empty when no notes match search', () => {
      useNoteStore.setState({ searchQuery: 'zzzznotfound' });
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(0);
    });

    it('should ignore whitespace-only search query', () => {
      useNoteStore.setState({ searchQuery: '   ' });
      const result = useNoteStore.getState().getFilteredNotes();
      expect(result).toHaveLength(4);
    });
  });
});
