// 存储仓库泛型接口
export interface IRepository<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(item: Omit<T, 'id'> & { id: string }): Promise<string>;
  update(id: string, changes: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  find(predicate: (item: T) => boolean): Promise<T[]>;
  bulkCreate(items: (Omit<T, 'id'> & { id: string })[]): Promise<string[]>;
  bulkDelete(ids: string[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

// 同步冲突
export interface SyncConflict {
  localEntity: any;
  remoteEntity: any;
  entityType: string;
  entityId: string;
  localVersion: number;
  remoteVersion: number;
  resolvedAt?: Date;
  resolution?: 'local' | 'remote' | 'manual';
}

// 同步结果
export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
  errors: string[];
  lastSyncAt: Date;
}
