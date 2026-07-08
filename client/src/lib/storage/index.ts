export { db, KeBanDatabase } from './database';
export { StorageAdapter } from './StorageAdapter';
export { logOperation, getUnsyncedLogs, markLogsSynced } from './operationLog';

// 预创建的存储适配器实例
import { db } from './database';
import { StorageAdapter } from './StorageAdapter';

export const pomodoroSessionStore = new StorageAdapter(db.pomodoroSessions);
export const pomodoroSettingsStore = new StorageAdapter(db.pomodoroSettings);
export const noteStore = new StorageAdapter(db.notes);
export const noteFolderStore = new StorageAdapter(db.noteFolders);
export const flashcardDeckStore = new StorageAdapter(db.flashcardDecks);
export const flashcardStore = new StorageAdapter(db.flashcards);
export const flashcardReviewStore = new StorageAdapter(db.flashcardReviews);
export const feynmanNoteStore = new StorageAdapter(db.feynmanNotes);
export const feynmanSummaryStore = new StorageAdapter(db.feynmanSummaries);
export const feynmanWeakPointStore = new StorageAdapter(db.feynmanWeakPoints);
export const operationLogStore = new StorageAdapter(db.operationLog);
export const appSettingsStore = new StorageAdapter(db.appSettings);

// 导入导出与存储管理
export { exportAllData, downloadExport, importData, readFileAsText } from './exportImport';
export type { ExportData } from './exportImport';
export { getStorageInfo, formatBytes } from './StorageManager';
export type { StorageInfo } from './StorageManager';
