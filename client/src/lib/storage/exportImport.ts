import { db } from './database';
import { encryptBackup, decryptBackup, type EncryptedBackup } from '@/lib/crypto/backupCrypto';
import type {
  KbanDeckFile, FlashcardDeck, Flashcard,
  PomodoroSession, PomodoroSettings, Note, NoteFolder,
  FlashcardReview, FeynmanNote, FeynmanSummary, FeynmanWeakPoint,
  OperationLog, AppSettings, StudyCheckIn, Achievement,
  PomodoroGoal, SyncConflict, OfflineQueueItem, WindowCapture,
} from '@/types/models';

/**
 * 导出牌组为 .kban-deck 文件结构（v1.1 增强版）
 */
export async function exportDeck(deckId: string): Promise<KbanDeckFile> {
  const deck = await db.flashcardDecks.get(deckId);
  if (!deck) throw new Error('牌组不存在');

  const cards = await db.flashcards.where('deckId').equals(deckId).toArray();

  return {
    version: '1.1',
    type: 'deck',
    exportedAt: new Date().toISOString(),
    author: 'keban-user',
    deck: {
      id: deck.id,
      name: deck.name,
      description: deck.description || '',
      createdAt: deck.createdAt.toISOString(),
      cardCount: cards.length,
    },
    cards: cards.map((card) => ({
      front: card.front,
      back: card.back,
      // TODO: Flashcard 类型尚未定义 tags 字段，此处兼容旧数据
      tags: ('tags' in card ? (card as Flashcard & { tags?: string[] }).tags : undefined) || [],
      type: card.type,
      sourceNoteId: card.sourceNoteId,
    })),
  };
}

/**
 * 将导出数据保存为本地文件（触发浏览器下载）
 */
export function downloadDeckFile(data: KbanDeckFile): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.deck.name}.kban-deck`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 解析 .kban-deck 文件并检测冲突（不自动写入数据库）
 */
export async function importDeck(file: File): Promise<{
  deckData: KbanDeckFile;
  hasConflict: boolean;
  existingDeckId?: string;
}> {
  const text = await file.text();
  const data: KbanDeckFile = JSON.parse(text);

  // 校验格式（兼容 v1.0 和 v1.1）
  if ((data.version !== '1.0' && data.version !== '1.1') || data.type !== 'deck') {
    throw new Error('无效的 .kban-deck 文件格式');
  }

  // 检测同名牌组冲突
  const existing = await db.flashcardDecks.where('name').equals(data.deck.name).first();
  return {
    deckData: data,
    hasConflict: !!existing,
    existingDeckId: existing?.id,
  };
}

/** 无冲突时直接创建新牌组并导入，返回新牌组 ID 和卡片数 */
export async function importDeckNew(deckData: KbanDeckFile): Promise<{ deckId: string; cardCount: number }> {
  const newDeckId = crypto.randomUUID();
  const now = new Date();
  await db.flashcardDecks.add({
    id: newDeckId,
    name: deckData.deck.name,
    description: deckData.deck.description,
    createdAt: now,
    updatedAt: now,
    order: 0,
  } as FlashcardDeck);
  const cardPromises = deckData.cards.map((card) =>
    db.flashcards.add({
      id: crypto.randomUUID(),
      deckId: newDeckId,
      front: card.front,
      back: card.back,
      type: card.type || 'basic',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      lapses: 0,
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      sourceNoteId: card.sourceNoteId,
      order: 0,
    } as Flashcard),
  );
  await Promise.all(cardPromises);
  return { deckId: newDeckId, cardCount: deckData.cards.length };
}

/** 覆盖：删除旧牌组及其卡片，导入新数据 */
export async function importDeckOverwrite(deckData: KbanDeckFile, existingDeckId: string): Promise<void> {
  // 删除旧卡片和旧牌组
  await db.flashcards.where('deckId').equals(existingDeckId).delete();
  await db.flashcardDecks.delete(existingDeckId);
  // 以原 ID 重新写入
  const now = new Date();
  await db.flashcardDecks.add({
    id: existingDeckId,
    name: deckData.deck.name,
    description: deckData.deck.description,
    createdAt: now,
    updatedAt: now,
    order: 0,
  } as FlashcardDeck);
  const cardPromises = deckData.cards.map((card) =>
    db.flashcards.add({
      id: crypto.randomUUID(),
      deckId: existingDeckId,
      front: card.front,
      back: card.back,
      type: card.type || 'basic',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      lapses: 0,
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      sourceNoteId: card.sourceNoteId,
      order: 0,
    } as Flashcard),
  );
  await Promise.all(cardPromises);
}

/** 跳过：不做任何操作 */
export async function importDeckSkip(): Promise<void> {
  // 无操作
}

/** 合并：将新卡片追加到现有牌组，返回新增卡片数 */
export async function importDeckMerge(deckData: KbanDeckFile, existingDeckId: string): Promise<number> {
  const now = new Date();
  const cardPromises = deckData.cards.map((card) =>
    db.flashcards.add({
      id: crypto.randomUUID(),
      deckId: existingDeckId,
      front: card.front,
      back: card.back,
      type: card.type || 'basic',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      lapses: 0,
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      sourceNoteId: card.sourceNoteId,
      order: 0,
    } as Flashcard),
  );
  await Promise.all(cardPromises);
  // 更新牌组的 updatedAt
  await db.flashcardDecks.update(existingDeckId, { updatedAt: now });
  return deckData.cards.length;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  data: {
    pomodoroSessions: PomodoroSession[];
    pomodoroSettings: PomodoroSettings[];
    notes: Note[];
    noteFolders: NoteFolder[];
    flashcardDecks: FlashcardDeck[];
    flashcards: Flashcard[];
    flashcardReviews: FlashcardReview[];
    feynmanNotes: FeynmanNote[];
    feynmanSummaries: FeynmanSummary[];
    feynmanWeakPoints: FeynmanWeakPoint[];
    operationLog: OperationLog[];
    appSettings: AppSettings[];
    // v0.5.0 A1.3 补全：
    studyCheckIns: StudyCheckIn[];
    achievements: Achievement[];
    pomodoroGoals: PomodoroGoal[];
    syncConflicts: SyncConflict[];
    offlineQueue: OfflineQueueItem[];
    windowCaptures: WindowCapture[];
  };
}

/** 全量导出所有数据为 JSON 字符串 */
export async function exportAllData(): Promise<string> {
  const [
    pomodoroSessions,
    pomodoroSettings,
    notes,
    noteFolders,
    flashcardDecks,
    flashcards,
    flashcardReviews,
    feynmanNotes,
    feynmanSummaries,
    feynmanWeakPoints,
    operationLog,
    appSettings,
    studyCheckIns,
    achievements,
    pomodoroGoals,
    syncConflicts,
    offlineQueue,
    windowCaptures,
  ] = await Promise.all([
    db.pomodoroSessions.toArray(),
    db.pomodoroSettings.toArray(),
    db.notes.toArray(),
    db.noteFolders.toArray(),
    db.flashcardDecks.toArray(),
    db.flashcards.toArray(),
    db.flashcardReviews.toArray(),
    db.feynmanNotes.toArray(),
    db.feynmanSummaries.toArray(),
    db.feynmanWeakPoints.toArray(),
    db.operationLog.toArray(),
    db.appSettings.toArray(),
    db.studyCheckIns.toArray(),
    db.achievements.toArray(),
    db.pomodoroGoals.toArray(),
    db.syncConflicts.toArray(),
    db.offlineQueue.toArray(),
    db.windowCaptures.toArray(),
  ]);

  const exportData: ExportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    data: {
      pomodoroSessions,
      pomodoroSettings,
      notes,
      noteFolders,
      flashcardDecks,
      flashcards,
      flashcardReviews,
      feynmanNotes,
      feynmanSummaries,
      feynmanWeakPoints,
      operationLog,
      appSettings,
      studyCheckIns,
      achievements,
      pomodoroGoals,
      syncConflicts,
      offlineQueue,
      windowCaptures,
    },
  };

  return JSON.stringify(exportData);
}

/** 触发浏览器下载 JSON 文件 */
export function downloadExport(jsonString: string, filename?: string): void {
  const defaultName = `keban-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? defaultName;
  document.body.appendChild(a);
  a.click();

  // 清理
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导入数据（清空旧数据后批量写入） */
export async function importData(
  jsonString: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString) as ExportData;

    if (!parsed.version) {
      return { success: false, message: '无效的备份文件：缺少 version 字段' };
    }

    const { data } = parsed;
    if (!data || typeof data !== 'object') {
      return { success: false, message: '无效的备份文件：缺少 data 字段' };
    }

    // 在事务中清空旧数据并批量写入
    await db.transaction('rw', [
      db.pomodoroSessions,
      db.pomodoroSettings,
      db.notes,
      db.noteFolders,
      db.flashcardDecks,
      db.flashcards,
      db.flashcardReviews,
      db.feynmanNotes,
      db.feynmanSummaries,
      db.feynmanWeakPoints,
      db.operationLog,
      db.appSettings,
      db.studyCheckIns,
      db.achievements,
      db.pomodoroGoals,
      db.syncConflicts,
      db.offlineQueue,
      db.windowCaptures,
    ], async () => {
      await db.pomodoroSessions.clear();
      await db.pomodoroSettings.clear();
      await db.notes.clear();
      await db.noteFolders.clear();
      await db.flashcardDecks.clear();
      await db.flashcards.clear();
      await db.flashcardReviews.clear();
      await db.feynmanNotes.clear();
      await db.feynmanSummaries.clear();
      await db.feynmanWeakPoints.clear();
      await db.operationLog.clear();
      await db.appSettings.clear();
      await db.studyCheckIns.clear();
      await db.achievements.clear();
      await db.pomodoroGoals.clear();
      await db.syncConflicts.clear();
      await db.offlineQueue.clear();
      await db.windowCaptures.clear();

      if (data.pomodoroSessions?.length) await db.pomodoroSessions.bulkPut(data.pomodoroSessions);
      if (data.pomodoroSettings?.length) await db.pomodoroSettings.bulkPut(data.pomodoroSettings);
      if (data.notes?.length) await db.notes.bulkPut(data.notes);
      if (data.noteFolders?.length) await db.noteFolders.bulkPut(data.noteFolders);
      if (data.flashcardDecks?.length) await db.flashcardDecks.bulkPut(data.flashcardDecks);
      if (data.flashcards?.length) await db.flashcards.bulkPut(data.flashcards);
      if (data.flashcardReviews?.length) await db.flashcardReviews.bulkPut(data.flashcardReviews);
      if (data.feynmanNotes?.length) await db.feynmanNotes.bulkPut(data.feynmanNotes);
      if (data.feynmanSummaries?.length) await db.feynmanSummaries.bulkPut(data.feynmanSummaries);
      if (data.feynmanWeakPoints?.length) await db.feynmanWeakPoints.bulkPut(data.feynmanWeakPoints);
      if (data.operationLog?.length) await db.operationLog.bulkPut(data.operationLog);
      if (data.appSettings?.length) await db.appSettings.bulkPut(data.appSettings);
      if (data.studyCheckIns?.length) await db.studyCheckIns.bulkPut(data.studyCheckIns);
      if (data.achievements?.length) await db.achievements.bulkPut(data.achievements);
      if (data.pomodoroGoals?.length) await db.pomodoroGoals.bulkPut(data.pomodoroGoals);
      if (data.syncConflicts?.length) await db.syncConflicts.bulkPut(data.syncConflicts);
      if (data.offlineQueue?.length) await db.offlineQueue.bulkPut(data.offlineQueue);
      if (data.windowCaptures?.length) await db.windowCaptures.bulkPut(data.windowCaptures);
    });

    return { success: true, message: '数据导入成功' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return { success: false, message: `导入失败：${msg}` };
  }
}

/** 使用 FileReader 读取文件为文本 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

// ===========================================================================
// v0.9.0: 加密备份与恢复
// ===========================================================================

/** 加密备份文件结构 */
export interface EncryptedBackupFile {
  format: 'keban-encrypted-backup';
  version: string;
  createdAt: string;
  encrypted: boolean;
  payload: EncryptedBackup | ExportData;
}

/**
 * 创建加密备份
 *
 * 复用现有 exportAllData 全量导出，再通过 backupCrypto 加密。
 * 若不传 password，则创建未加密的明文备份（向后兼容）。
 *
 * @param password 可选密码（提供时启用 AES-256-GCM 加密）
 * @returns 序列化后的备份 JSON 字符串
 */
export async function createEncryptedBackup(password?: string): Promise<string> {
  const jsonStr = await exportAllData();
  const parsed = JSON.parse(jsonStr) as ExportData;

  const file: EncryptedBackupFile = {
    format: 'keban-encrypted-backup',
    version: '2.0',
    createdAt: new Date().toISOString(),
    encrypted: !!password,
    payload: password
      ? await encryptBackup(jsonStr, password)
      : parsed,
  };

  return JSON.stringify(file);
}

/**
 * 从备份文件恢复数据
 *
 * 自动检测备份文件是否加密：
 * - 加密备份：需提供密码解密后导入
 * - 明文备份：直接导入
 *
 * @param file 备份文件（File 对象或 JSON 字符串）
 * @param password 解密密码（加密备份时必填）
 */
export async function restoreFromBackup(
  file: File | string,
  password?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const text = typeof file === 'string' ? file : await readFileAsText(file);
    const parsed = JSON.parse(text);

    // 检测是否为 v0.9.0 加密备份格式
    if (parsed?.format === 'keban-encrypted-backup') {
      if (parsed.encrypted) {
        if (!password) {
          return { success: false, message: '该备份已加密，请输入密码' };
        }
        const encryptedPayload = parsed.payload as EncryptedBackup;
        const decrypted = await decryptBackup(encryptedPayload, password);
        return importData(decrypted);
      } else {
        // 未加密的 keban-encrypted-backup 格式
        const payload = parsed.payload as ExportData;
        return importData(JSON.stringify(payload));
      }
    }

    // 兼容旧版明文备份格式（直接 ExportData 结构）
    return importData(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return { success: false, message: `恢复失败：${msg}` };
  }
}

// ---------------------------------------------------------------------------
// 自动备份
// ---------------------------------------------------------------------------

/** 自动备份最大保留份数 */
const MAX_AUTO_BACKUPS = 3;
/** 自动备份 appSettings key 前缀 */
const AUTO_BACKUP_KEY_PREFIX = 'auto_backup_';
/** 自动备份索引 key */
const AUTO_BACKUP_INDEX_KEY = 'auto_backup_index';

/**
 * 创建一次自动备份
 *
 * 备份内容存储在 IndexedDB appSettings 表中，最多保留 MAX_AUTO_BACKUPS 份。
 * 当超出数量时，自动删除最旧的备份。
 */
export async function createAutoBackup(): Promise<void> {
  const jsonStr = await exportAllData();

  // 读取当前索引（循环计数器 0..MAX_AUTO_BACKUPS-1）
  const indexSetting = await db.appSettings.where('key').equals(AUTO_BACKUP_INDEX_KEY).first();
  let currentIndex = indexSetting ? Number(indexSetting.value) || 0 : 0;

  const backupKey = `${AUTO_BACKUP_KEY_PREFIX}${currentIndex}`;
  const now = new Date();

  // 写入备份数据
  await db.appSettings.put({
    id: crypto.randomUUID(),
    key: backupKey,
    value: jsonStr,
    updatedAt: now,
  } as AppSettings);

  // 更新索引（循环递增）
  const nextIndex = (currentIndex + 1) % MAX_AUTO_BACKUPS;
  await db.appSettings.put({
    id: crypto.randomUUID(),
    key: AUTO_BACKUP_INDEX_KEY,
    value: String(nextIndex),
    updatedAt: now,
  } as AppSettings);
}

/**
 * 获取所有自动备份的元信息（不含完整数据，仅时间和大小）
 */
export async function listAutoBackups(): Promise<Array<{ index: number; updatedAt: Date; sizeBytes: number }>> {
  const results: Array<{ index: number; updatedAt: Date; sizeBytes: number }> = [];

  for (let i = 0; i < MAX_AUTO_BACKUPS; i++) {
    const key = `${AUTO_BACKUP_KEY_PREFIX}${i}`;
    const entry = await db.appSettings.where('key').equals(key).first();
    if (entry) {
      results.push({
        index: i,
        updatedAt: entry.updatedAt ?? new Date(),
        sizeBytes: (entry.value ?? '').length,
      });
    }
  }

  // 按更新时间降序
  return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * 从自动备份中恢复指定索引的数据
 */
export async function restoreFromAutoBackup(index: number): Promise<{ success: boolean; message: string }> {
  const key = `${AUTO_BACKUP_KEY_PREFIX}${index}`;
  const entry = await db.appSettings.where('key').equals(key).first();

  if (!entry?.value) {
    return { success: false, message: `未找到索引为 ${index} 的自动备份` };
  }

  return importData(entry.value);
}
