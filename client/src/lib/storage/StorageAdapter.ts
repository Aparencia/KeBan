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
 * 对数据中的敏感字段进行解密
 * 若 CryptoManager 未就绪或数据不是加密格式，直接返回原数据（优雅降级）
 */
async function decryptSensitiveFields<T>(
  entityType: string | undefined,
  data: T
): Promise<T> {
  if (!entityType || !cryptoManager.isReady()) return data;

  const fields = SENSITIVE_FIELDS[entityType];
  if (!fields || fields.length === 0) return data;

  const result = { ...data } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.length > 0) {
      result[field] = await cryptoManager.decryptField(value);
    }
  }
  return result as T;
}

/**
 * Dexie 存储适配器 - 实现 IRepository<T> 接口
 * 泛型 T 为数据模型类型，主键固定为 string (UUID)
 * 可选传入 entityType 以启用敏感字段自动解密
 */
export class StorageAdapter<T extends { id: string }> implements IRepository<T> {
  private table: Table<T, string>;
  private entityType?: string;

  constructor(table: Table<T, string>, entityType?: string) {
    this.table = table;
    this.entityType = entityType;
  }

  async getAll(): Promise<T[]> {
    const items = await this.table.toArray();
    return Promise.all(items.map(item => decryptSensitiveFields(this.entityType, item)));
  }

  async getById(id: string): Promise<T | undefined> {
    const item = await this.table.get(id);
    if (!item) return undefined;
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
    return Promise.all(items.map(item => decryptSensitiveFields(this.entityType, item)));
  }

  // 保留 Dexie 原生访问能力（向后兼容）
  getTable(): Table<T, string> {
    return this.table;
  }
}
