import { db } from './database';
import type { OperationLog } from '@/types/models';

export async function logOperation(
  entityType: string,
  entityId: number | string,
  operation: 'create' | 'update' | 'delete',
  payload?: any
): Promise<void> {
  await db.operationLog.add({
    entityType,
    entityId,
    operation,
    payload: payload ? JSON.stringify(payload) : undefined,
    createdAt: new Date(),
    synced: false,
  });
}

export async function getUnsyncedLogs(): Promise<OperationLog[]> {
  return db.operationLog.where('synced').equals(0).toArray();
}

export async function markLogsSynced(ids: number[]): Promise<void> {
  await db.operationLog.bulkUpdate(ids.map(id => ({
    key: id,
    changes: { synced: true }
  })));
}
