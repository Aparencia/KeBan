/**
 * 课堂笔记持久化存储
 * 将 AI 分析生成的课堂笔记保存到 IndexedDB (Dexie)
 */

import { db } from './database';

export interface ClassroomNote {
  id: string;
  sessionId: string;
  title: string;
  content: string; // Markdown
  keyframesAnalyzed: number;
  modelUsed: string;
  sourceType: 'smart' | 'video';
  duration: number; // seconds
  createdAt: Date;
  updatedAt: Date;
}

export const classroomNoteStore = {
  async create(note: Omit<ClassroomNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    const record: ClassroomNote = {
      ...note,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await db.classroomNotes.add(record);
    return id;
  },

  async getAll(): Promise<ClassroomNote[]> {
    return db.classroomNotes.orderBy('createdAt').reverse().toArray();
  },

  async getBySessionId(sessionId: string): Promise<ClassroomNote | undefined> {
    return db.classroomNotes.where('sessionId').equals(sessionId).first();
  },

  async delete(id: string): Promise<void> {
    await db.classroomNotes.delete(id);
  },
};
