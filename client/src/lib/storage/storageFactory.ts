import { StorageAdapter } from './StorageAdapter';
import type { IRepository } from './interfaces';
import { db } from './database';
import type {
  PomodoroSession,
  PomodoroSettings,
  Note,
  NoteFolder,
  FlashcardDeck,
  Flashcard,
  FlashcardReview,
  FeynmanNote,
  FeynmanSummary,
  FeynmanWeakPoint,
  OperationLog,
  AppSettings,
  SyncConflict,
  OfflineQueueItem,
} from '@/types/models';

/**
 * 检测当前运行环境
 */
export function getRuntimeEnvironment(): 'pwa' | 'electron' {
  if (window.electronAPI) {
    return 'electron';
  }
  return 'pwa';
}

/**
 * 存储工厂
 * 根据运行环境返回对应的存储实现
 * PWA 环境：使用 Dexie.js (IndexedDB)
 * Electron 环境：预留 SQLite 实现（当前仍使用 Dexie）
 */
export function createStorage<T extends { id: string }>(tableName: string): IRepository<T> {
  const env = getRuntimeEnvironment();

  switch (env) {
    case 'electron':
      // Electron 环境下 IndexedDB 可用，初期复用 Dexie
      if (import.meta.env.DEV) {
        console.debug(`[StorageFactory] Electron SQLite not yet implemented, falling back to Dexie for ${tableName}`);
      }
      return new StorageAdapter<T>(db.table(tableName) as any, tableName);

    case 'pwa':
    default:
      return new StorageAdapter<T>(db.table(tableName) as any, tableName);
  }
}

/**
 * 获取所有存储实例
 * 替代 index.ts 中的硬编码实例
 */
export function createAllStores() {
  return {
    pomodoroSessions: createStorage<PomodoroSession>('pomodoroSessions'),
    pomodoroSettings: createStorage<PomodoroSettings>('pomodoroSettings'),
    notes: createStorage<Note>('notes'),
    noteFolders: createStorage<NoteFolder>('noteFolders'),
    flashcardDecks: createStorage<FlashcardDeck>('flashcardDecks'),
    flashcards: createStorage<Flashcard>('flashcards'),
    flashcardReviews: createStorage<FlashcardReview>('flashcardReviews'),
    feynmanNotes: createStorage<FeynmanNote>('feynmanNotes'),
    feynmanSummaries: createStorage<FeynmanSummary>('feynmanSummaries'),
    feynmanWeakPoints: createStorage<FeynmanWeakPoint>('feynmanWeakPoints'),
    operationLog: createStorage<OperationLog>('operationLog'),
    appSettings: createStorage<AppSettings>('appSettings'),
    syncConflicts: createStorage<SyncConflict>('syncConflicts'),
    offlineQueue: createStorage<OfflineQueueItem>('offlineQueue'),
  };
}
