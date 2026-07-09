import type { Table } from 'dexie';
import type { IRepository } from './interfaces';

/**
 * Dexie 存储适配器 - 实现 IRepository<T> 接口
 * 泛型 T 为数据模型类型，主键固定为 string (UUID)
 */
export class StorageAdapter<T extends { id: string }> implements IRepository<T> {
  private table: Table<T, string>;

  constructor(table: Table<T, string>) {
    this.table = table;
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async getById(id: string): Promise<T | undefined> {
    return this.table.get(id);
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
    return this.table.filter(predicate).toArray();
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
    return this.table.where(index).equals(value).toArray();
  }

  // 保留 Dexie 原生访问能力（向后兼容）
  getTable(): Table<T, string> {
    return this.table;
  }
}
