import type { IRepository } from './interfaces';
import { logOperation } from './operationLog';
import { generateId } from '../utils/uuid';
import { offlineQueue } from '../sync/OfflineQueue';

/**
 * 带操作日志的统一写操作
 * 每次写操作自动记录日志到 operationLog，支持后续同步
 */

export async function createWithLog<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  data: Omit<T, 'id'>
): Promise<string> {
  const id = generateId();
  const item = { ...data, id } as T;

  await repo.create(item);
  await logOperation(entityType, id, 'create', item);

  return id;
}

export async function updateWithLog<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  id: string,
  changes: Partial<T>
): Promise<void> {
  await repo.update(id, changes);

  // 生成 JSON Patch（简化版）
  const patch = JSON.stringify(changes);
  await logOperation(entityType, id, 'update', changes, patch);
}

export async function deleteWithLog<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  id: string
): Promise<void> {
  // 先获取数据用于日志
  const existing = await repo.getById(id);

  await repo.delete(id);
  await logOperation(entityType, id, 'delete', existing);
}

/**
 * 带离线队列的统一写操作
 * 在网络不可用时自动将操作加入离线队列
 */
export async function createWithQueue<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  data: Omit<T, 'id'>,
  isOnline: boolean
): Promise<string> {
  const id = await createWithLog(repo, entityType, data);

  if (!isOnline) {
    const item = { ...data, id } as T;
    await offlineQueue.enqueue(entityType, id, 'create', item);
  }

  return id;
}

export async function updateWithQueue<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  id: string,
  changes: Partial<T>,
  isOnline: boolean
): Promise<void> {
  await updateWithLog(repo, entityType, id, changes);

  if (!isOnline) {
    await offlineQueue.enqueue(entityType, id, 'update', changes);
  }
}

export async function deleteWithQueue<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  id: string,
  isOnline: boolean
): Promise<void> {
  await deleteWithLog(repo, entityType, id);

  if (!isOnline) {
    await offlineQueue.enqueue(entityType, id, 'delete');
  }
}
