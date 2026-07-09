import { StorageAdapter } from './StorageAdapter';
import type { IRepository } from './interfaces';
import { db } from './database';

/**
 * 检测当前运行环境
 */
export function getRuntimeEnvironment(): 'pwa' | 'tauri' {
  // @ts-ignore - Tauri 注入的全局变量
  if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
    return 'tauri';
  }
  return 'pwa';
}

/**
 * 存储工厂
 * 根据运行环境返回对应的存储实现
 * PWA 环境：使用 Dexie.js (IndexedDB)
 * Tauri 环境：预留 SQLite 实现（当前 Alpha 仍使用 Dexie）
 */
export function createStorage<T extends { id: string }>(tableName: string): IRepository<T> {
  const env = getRuntimeEnvironment();

  switch (env) {
    case 'tauri':
      // TODO: 实现 SqliteStorageProvider
      // Alpha 阶段暂时仍使用 Dexie
      console.warn(`[StorageFactory] Tauri SQLite not yet implemented, falling back to Dexie for ${tableName}`);
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
    pomodoroSessions: createStorage<any>('pomodoroSessions'),
    pomodoroSettings: createStorage<any>('pomodoroSettings'),
    notes: createStorage<any>('notes'),
    noteFolders: createStorage<any>('noteFolders'),
    flashcardDecks: createStorage<any>('flashcardDecks'),
    flashcards: createStorage<any>('flashcards'),
    flashcardReviews: createStorage<any>('flashcardReviews'),
    feynmanNotes: createStorage<any>('feynmanNotes'),
    feynmanSummaries: createStorage<any>('feynmanSummaries'),
    feynmanWeakPoints: createStorage<any>('feynmanWeakPoints'),
    operationLog: createStorage<any>('operationLog'),
    appSettings: createStorage<any>('appSettings'),
    syncConflicts: createStorage<any>('syncConflicts'),
    offlineQueue: createStorage<any>('offlineQueue'),
  };
}
