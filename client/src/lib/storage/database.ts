import Dexie, { type Table } from 'dexie';
import type {
  PomodoroSession, PomodoroSettings, Note, NoteFolder,
  FlashcardDeck, Flashcard, FlashcardReview,
  FeynmanNote, FeynmanSummary, FeynmanWeakPoint,
  OperationLog, AppSettings
} from '@/types/models';

export class KeBanDatabase extends Dexie {
  pomodoroSessions!: Table<PomodoroSession, number>;
  pomodoroSettings!: Table<PomodoroSettings, number>;
  notes!: Table<Note, number>;
  noteFolders!: Table<NoteFolder, number>;
  flashcardDecks!: Table<FlashcardDeck, number>;
  flashcards!: Table<Flashcard, number>;
  flashcardReviews!: Table<FlashcardReview, number>;
  feynmanNotes!: Table<FeynmanNote, number>;
  feynmanSummaries!: Table<FeynmanSummary, number>;
  feynmanWeakPoints!: Table<FeynmanWeakPoint, number>;
  operationLog!: Table<OperationLog, number>;
  appSettings!: Table<AppSettings, number>;

  constructor() {
    super('keban');

    this.version(1).stores({
      pomodoroSessions: '++id, completedAt, mode, subject',
      pomodoroSettings: '++id',
      notes: '++id, title, folderId, createdAt, updatedAt, *tags, pinned',
      noteFolders: '++id, parentId, name, order',
      flashcardDecks: '++id, parentId, name, order',
      flashcards: '++id, deckId, dueDate, type, createdAt, order',
      flashcardReviews: '++id, cardId, deckId, reviewedAt',
      feynmanSessions: '++id, status, concept, createdAt, updatedAt',
      operationLog: '++id, entityType, entityId, synced, createdAt',
      appSettings: '++id, &key',
    });

    // 拆分 feynmanSessions 为三张独立表
    this.version(2).stores({
      feynmanSessions: null,
      feynmanNotes: '++id, status, concept, createdAt, updatedAt',
      feynmanSummaries: '++id, noteId',
      feynmanWeakPoints: '++id, noteId',
    });
  }
}

export const db = new KeBanDatabase();
