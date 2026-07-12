import type { IRepository } from '@/lib/storage/interfaces';
import { logOperation } from '@/lib/storage/operationLog';
import { generateId } from '@/lib/utils/uuid';
import { offlineQueue } from '@/lib/sync/OfflineQueue';
import { cryptoManager } from '@/lib/crypto';

/**
 * 带操作日志的统一写操作
 * 每次写操作自动记录日志到 operationLog，支持后续同步
 * 写入前对敏感字段进行 AES-GCM 加密（CryptoManager 未初始化时优雅降级）
 */

/**
 * 敏感字段映射：entityType -> 需要加密的字段名列表
 * 非敏感表（pomodoroSessions, pomodoroSettings, operationLog 等）不在此映射中
 */
const SENSITIVE_FIELDS: Record<string, string[]> = {
  notes: ['content'],
  flashcards: ['front', 'back'],
  feynmanNotes: ['explanation'],
  feynmanSummaries: ['summary'],
  feynmanWeakPoints: ['text'],
};

/**
 * 对数据中的敏感字段进行加密
 * 若 CryptoManager 未就绪，直接返回原数据（优雅降级）
 */
async function encryptSensitiveFields<T>(
  entityType: string,
  data: T
): Promise<T> {
  if (!cryptoManager.isReady()) return data;

  const fields = SENSITIVE_FIELDS[entityType];
  if (!fields || fields.length === 0) return data;

  const result = { ...data } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.length > 0) {
      result[field] = await cryptoManager.encryptField(value);
    }
  }
  return result as T;
}

export async function createWithLog<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  data: Omit<T, 'id'>
): Promise<string> {
  const id = generateId();
  const item = { ...data, id } as T;

  // 写入前加密敏感字段
  const encryptedItem = await encryptSensitiveFields(entityType, item);

  await repo.create(encryptedItem);
  await logOperation(entityType, id, 'create', encryptedItem);

  return id;
}

export async function updateWithLog<T extends { id: string }>(
  repo: IRepository<T>,
  entityType: string,
  id: string,
  changes: Partial<T>
): Promise<void> {
  // 更新前加密变更中的敏感字段
  const encryptedChanges = await encryptSensitiveFields(entityType, changes);

  await repo.update(id, encryptedChanges);

  // 生成 JSON Patch（简化版）
  const patch = JSON.stringify(encryptedChanges);
  await logOperation(entityType, id, 'update', encryptedChanges, patch);
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
