import { db } from './database';
import { generateId } from '../utils/uuid';
import type { OperationLog } from '@/types/models';

// 获取或生成设备 ID（持久化到 localStorage）
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('keban_device_id');
  if (!deviceId) {
    deviceId = generateId();
    localStorage.setItem('keban_device_id', deviceId);
  }
  return deviceId;
}

// 获取下一个版本号（基于本地最大版本号 +1）
export async function getNextVersion(): Promise<number> {
  const logs = await db.operationLog.orderBy('version').reverse().limit(1).toArray();
  return logs.length > 0 ? (logs[0].version || 0) + 1 : 1;
}

// 增强版 logOperation：自动填充 version、deviceId
export async function logOperation(
  entityType: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  payload?: any,
  patch?: string
): Promise<void> {
  const version = await getNextVersion();
  const deviceId = getDeviceId();

  await db.operationLog.add({
    id: generateId(),
    entityType,
    entityId,
    operation,
    payload: payload ? JSON.stringify(payload) : undefined,
    patch,
    createdAt: new Date(),
    synced: false,
    version,
    deviceId,
  });
}

// 获取未同步的日志（按版本号排序）
export async function getUnsyncedLogs(): Promise<OperationLog[]> {
  return db.operationLog.where('synced').equals(0).sortBy('version');
}

// 批量获取未同步日志（分页）
export async function getUnsyncedLogsBatch(batchSize: number = 50): Promise<OperationLog[]> {
  const logs = await db.operationLog
    .where('synced')
    .equals(0)
    .sortBy('version');
  return logs.slice(0, batchSize);
}

// 标记日志为已同步
export async function markLogsSynced(ids: string[]): Promise<void> {
  await db.operationLog.bulkUpdate(ids.map(id => ({
    key: id,
    changes: { synced: true }
  })));
}

// 清理已同步的旧日志（保留最近 N 条）
export async function cleanupSyncedLogs(keepCount: number = 100): Promise<number> {
  const syncedLogs = await db.operationLog
    .where('synced')
    .equals(1)
    .sortBy('version');

  if (syncedLogs.length <= keepCount) return 0;

  const toDelete = syncedLogs.slice(0, syncedLogs.length - keepCount);
  const idsToDelete = toDelete.map(log => log.id);
  await db.operationLog.bulkDelete(idsToDelete);
  return idsToDelete.length;
}
