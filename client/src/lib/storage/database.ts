import Dexie, { type Table } from 'dexie';
import type {
  PomodoroSession, PomodoroSettings, Note, NoteFolder,
  FlashcardDeck, Flashcard, FlashcardReview,
  FeynmanNote, FeynmanSummary, FeynmanWeakPoint,
  OperationLog, AppSettings, SyncConflict, OfflineQueueItem,
  StudyCheckIn, Achievement, PomodoroGoal, WindowCapture,
  Consent, UserProfile, Inspiration
} from '@/types/models';

export class KeBanDatabase extends Dexie {
  pomodoroSessions!: Table<PomodoroSession, string>;
  pomodoroSettings!: Table<PomodoroSettings, string>;
  notes!: Table<Note, string>;
  noteFolders!: Table<NoteFolder, string>;
  flashcardDecks!: Table<FlashcardDeck, string>;
  flashcards!: Table<Flashcard, string>;
  flashcardReviews!: Table<FlashcardReview, string>;
  feynmanNotes!: Table<FeynmanNote, string>;
  feynmanSummaries!: Table<FeynmanSummary, string>;
  feynmanWeakPoints!: Table<FeynmanWeakPoint, string>;
  operationLog!: Table<OperationLog, string>;
  appSettings!: Table<AppSettings, string>;
  syncConflicts!: Table<SyncConflict, string>;
  offlineQueue!: Table<OfflineQueueItem, string>;
  studyCheckIns!: Table<StudyCheckIn, string>;
  achievements!: Table<Achievement, string>;
  pomodoroGoals!: Table<PomodoroGoal, string>;
  windowCaptures!: Table<WindowCapture, string>;
  consent!: Table<Consent, string>;
  userProfile!: Table<UserProfile, string>;
  inspirations!: Table<Inspiration, string>;

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

    // MVP-2: 自增 number ID -> UUID string 主键 + 新增同步表
    this.version(3).stores({
      pomodoroSessions: 'id, completedAt, mode, subject',
      pomodoroSettings: 'id',
      notes: 'id, title, folderId, createdAt, updatedAt, *tags, pinned',
      noteFolders: 'id, name, parentId, createdAt, order',
      flashcardDecks: 'id, name, createdAt, updatedAt, description',
      flashcards: 'id, deckId, front, back, createdAt, dueDate, interval, easeFactor, repetitions, lapses',
      flashcardReviews: 'id, cardId, deckId, reviewedAt',
      feynmanNotes: 'id, status, concept, createdAt, updatedAt',
      feynmanSummaries: 'id, noteId',
      feynmanWeakPoints: 'id, noteId',
      operationLog: 'id, entityType, entityId, synced, createdAt, version, deviceId',
      appSettings: 'id',
      syncConflicts: 'id, entityType, entityId, status, createdAt',
      offlineQueue: 'id, entityType, entityId, createdAt, retryCount',
    }).upgrade(async (tx) => {
      // Schema v2 -> v3 迁移：自增 number ID -> UUID string

      // 由于 Dexie upgrade 函数中无法 import uuid，
      // 我们使用 crypto.randomUUID() 作为 UUID 生成器（浏览器原生支持）
      const genId = () => crypto.randomUUID();

      // 持久化迁移记录到 appSettings，便于后续排障审计
      await tx.table('appSettings').put({
        id: genId(),
        key: 'migration_v3_log',
        value: JSON.stringify({ from: 2, to: 3, detail: 'number IDs -> UUID strings', timestamp: new Date().toISOString() }),
        updatedAt: new Date(),
      });

      // 迁移单张表：将 number ID 转为 string UUID
      const migrateTable = async (tableName: string) => {
        const table = tx.table(tableName);
        const allItems = await table.toArray();
        if (allItems.length === 0) return;

        // 建立 oldId -> newId 映射
        const idMap = new Map<number, string>();
        allItems.forEach((item: Record<string, unknown>) => {
          if (typeof item.id === 'number') {
            idMap.set(item.id, genId());
          }
        });

        if (idMap.size === 0) return;

        // 清空表并用新 ID 重新插入
        await table.clear();
        for (const item of allItems) {
          const newItem = { ...item };
          if (typeof newItem.id === 'number') {
            newItem.id = idMap.get(newItem.id) || genId();
          }
          await table.add(newItem);
        }
      };

      // 按表迁移（Alpha 阶段用户基本没有旧数据，主要确保结构正确）
      const tables = [
        'pomodoroSessions', 'pomodoroSettings', 'notes', 'noteFolders',
        'flashcardDecks', 'flashcards', 'flashcardReviews',
        'feynmanNotes', 'feynmanSummaries', 'feynmanWeakPoints',
        'appSettings',
      ];

      for (const tableName of tables) {
        try {
          await migrateTable(tableName);
        } catch (e) {
          console.warn(`[DB] Failed to migrate table ${tableName}:`, e);
        }
      }

      // 为 OperationLog 新增字段设置默认值
      try {
        const opLogs = await tx.table('operationLog').toArray();
        if (opLogs.length > 0) {
          await tx.table('operationLog').clear();
          for (const log of opLogs) {
            await tx.table('operationLog').add({
              ...log,
              id: typeof log.id === 'number' ? genId() : log.id,
              version: log.version || 0,
              deviceId: log.deviceId || 'migration',
            });
          }
        }
      } catch (e) {
        console.warn('[DB] Failed to migrate operationLog:', e);
      }
    });

    // alpha.2: 新增打卡、成就、番茄目标表
    this.version(4).stores({
      studyCheckIns: 'id, &date, checkInTime, streakDays',
      achievements: 'id, &key, unlockedAt',
      pomodoroGoals: 'id, text, useCount, lastUsedAt',
    });

    // v0.4.0-alpha.1: 混合方案 — 新增窗口捕获表
    this.version(5).stores({
      windowCaptures: 'id, noteId, status, startedAt',
    });

    // v0.5.0-alpha.2: 双向关联 — flashcards 新增 sourceNoteId 索引，notes 新增 videoNoteType 索引
    this.version(6).stores({
      flashcards: 'id, deckId, front, back, createdAt, dueDate, interval, easeFactor, repetitions, lapses, sourceNoteId',
      notes: 'id, title, folderId, createdAt, updatedAt, *tags, pinned, videoNoteType',
    });

    // v0.6.0: 新增隐私合规 consent 表
    this.version(7).stores({
      consent: 'id, &type, version, acceptedAt',
    });

    // v0.7.0: 新增 userProfile 和 inspirations 表
    this.version(8).stores({
      userProfile: 'id, userId, email, updatedAt',
      inspirations: 'id, createdAt, updatedAt, [tags.content_nature+tags.cognitive_depth+tags.subject]',
    }).upgrade(async (tx) => {
      // 从 localStorage 迁移灵感数据至 IndexedDB
      try {
        const raw = localStorage.getItem('keban-inspirations');
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items) && items.length > 0) {
            await tx.table('inspirations').bulkPut(items);
            localStorage.removeItem('keban-inspirations');
          }
        }
      } catch {
        // 迁移失败不阻塞，保留 localStorage
      }
    });
  }
}

export const db = new KeBanDatabase();
export { captureStore } from './captureStore';
