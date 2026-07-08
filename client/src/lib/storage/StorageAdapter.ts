import { type Table } from 'dexie';

export class StorageAdapter<T, TKey = number> {
  private table: Table<T, TKey>;

  constructor(table: Table<T, TKey>) {
    this.table = table;
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async getById(id: TKey): Promise<T | undefined> {
    return this.table.get(id);
  }

  async create(item: T): Promise<TKey> {
    return this.table.add(item as any) as Promise<TKey>;
  }

  async update(id: TKey, changes: Partial<T>): Promise<number> {
    return this.table.update(id as any, changes as any);
  }

  async delete(id: TKey): Promise<void> {
    return this.table.delete(id as any);
  }

  async count(): Promise<number> {
    return this.table.count();
  }

  async where(index: string, value: any): Promise<T[]> {
    return this.table.where(index).equals(value).toArray();
  }

  async bulkCreate(items: T[]): Promise<TKey[]> {
    return this.table.bulkAdd(items as any, { allKeys: true }) as Promise<TKey[]>;
  }

  async clear(): Promise<void> {
    return this.table.clear();
  }
}
