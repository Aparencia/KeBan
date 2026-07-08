import { db } from './database';

export interface ExportData {
  version: string;
  exportedAt: string;
  data: {
    pomodoroSessions: any[];
    pomodoroSettings: any[];
    notes: any[];
    noteFolders: any[];
    flashcardDecks: any[];
    flashcards: any[];
    flashcardReviews: any[];
    feynmanNotes: any[];
    feynmanSummaries: any[];
    feynmanWeakPoints: any[];
    operationLog: any[];
    appSettings: any[];
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
