import type { Table } from 'dexie';
import type { IRepository } from './interfaces';
import { cryptoManager } from '../crypto';

/**
 * 敏感字段映射：entityType -> 需要解密的字段名列表
 * 与 writeWithLog.ts 中的加密映射保持一致
 */
const SENSITIVE_FIELDS: Record<string, string[]> = {
  notes: ['content'],
  flashcards: ['front', 'back'],
  feynmanNotes: ['content'],
  feynmanSummaries: ['content'],
  feynmanWeakPoints: ['content'],
};

/**
 * 非敏感表白名单：这些表不含加密字段，可直接跳过解密路径
 */
const NON_SENSITIVE_TABLES = new Set([
  'pomodoroSessions',
  'studyCheckIns',
  'studyGoals',
  'flashcardReviews',
  'searchIndex',
]);

/**
 * WeakMap 解密缓存：同一对象引用不重复解密
 * key = 原始记录对象引用，value = 解密后的副本
 */
const decryptCache = new WeakMap<object, unknown>();

/**
 * 对数据中的敏感字段进行解密
 * 若 CryptoManager 未就绪或数据不是加密格式，直接返回原数据（优雅降级）
 */
async function decryptSensitiveFields<T extends object>(
  entityType: string | undefined,
  data: T
): Promise<T> {
  if (!entityType || !cryptoManager.isReady()) return data;
  if (NON_SENSITIVE_TABLES.has(entityType)) return data;

  const fields = SENSITIVE_FIELDS[entityType];
  if (!fields || fields.length === 0) return data;

  // 命中缓存直接返回
  const cached = decryptCache.get(data) as T | undefined;
  if (cached) return cached;

  const result = { ...data } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.length > 0) {
      result[field] = await cryptoManager.decryptField(value);
    }
  }
  const decrypted = result as T;
  decryptCache.set(data, decrypted);
  return decrypted;
}

/**
 * Dexie 存储适配器 - 实现 IRepository<T> 接口
 * 泛型 T 为数据模型类型，主键固定为 string (UUID)
 * 可选传入 entityType 以启用敏感字段自动解密
 */
export class StorageAdapter<T extends { id: string }> implements IRepository<T> {
  private table: Table<T, string>;
  private entityType?: string;
  /** 是否属于非敏感表（构造时一次性判断） */
  private skipDecrypt: boolean;

  constructor(table: Table<T, string>, entityType?: string) {
    this.table = table;
    this.entityType = entityType;
    this.skipDecrypt = !entityType || NON_SENSITIVE_TABLES.has(entityType);
  }

  async getAll(): Promise<T[]> {
    const items = await this.table.toArray();
    if (this.skipDecrypt) return items;
    return Promise.all(items.map(item => decryptSensitiveFields(this.entityType, item)));
  }

  async getById(id: string): Promise<T | undefined> {
    const item = await this.table.get(id);
    if (!item) return undefined;
    if (this.skipDecrypt) return item;
    return decryptSensitiveFields(this.entityType, item);
  }

  async create(item: T): Promise<string> {
    return this.table.add(item) as unknown as string;
  }

  async update(id: string, changes: Partial<T>): Promise<void> {
    await this.table.update(id, changes as any);
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    const items = await this.table.filter(predicate).toArray();
    if (this.skipDecrypt) return items;
    return Promise.all(items.map(item => decryptSensitiveFields(this.entityType, item)));
  }

  async bulkCreate(items: T[]): Promise<string[]> {
    await this.table.bulkAdd(items);
    return items.map(item => item.id);
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.table.bulkDelete(ids);
  }

  async count(): Promise<number> {
    return this.table.count();
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }

  async where(index: string, value: any): Promise<T[]> {
    const items = await this.table.where(index).equals(value).toArray();
    if (this.skipDecrypt) return items;
    return Promise.all(items.map(item => decryptSensitiveFields(this.entityType, item)));
  }

  // 保留 Dexie 原生访问能力（向后兼容）
  getTable(): Table<T, string> {
    return this.table;
  }
}
