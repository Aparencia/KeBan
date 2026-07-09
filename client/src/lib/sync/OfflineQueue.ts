import { db } from '../storage/database';
import { generateId } from '../utils/uuid';
import type { OfflineQueueItem } from '@/types/models';
import { getDeviceId } from '../storage/operationLog';

/**
 * 离线操作队列管理器
 * 在网络不可用时缓存写操作，网络恢复后按序重放
 */
export class OfflineQueue {
  private processing = false;

  /**
   * 将操作加入离线队列
   */
  async enqueue(
    entityType: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    payload?: any
  ): Promise<string> {
    const id = generateId();
    const deviceId = getDeviceId();

    // 获取当前队列最大版本号
    const items = await db.offlineQueue.orderBy('createdAt').reverse().limit(1).toArray();
    const version = items.length > 0 ? (items[0].version || 0) + 1 : 1;

    await db.offlineQueue.add({
      id,
      entityType,
      entityId,
      operation,
      payload: payload ? JSON.stringify(payload) : undefined,
      version,
      deviceId,
      createdAt: new Date(),
      retryCount: 0,
    });

    return id;
  }

  /**
   * 获取所有待处理队列项
   */
  async getPendingItems(): Promise<OfflineQueueItem[]> {
    return db.offlineQueue.orderBy('version').toArray();
  }

  /**
   * 获取队列大小
   */
  async size(): Promise<number> {
    return db.offlineQueue.count();
  }

  /**
   * 移除已处理的队列项
   */
  async removeItem(id: string): Promise<void> {
    await db.offlineQueue.delete(id);
  }

  /**
   * 批量移除已处理的队列项
   */
  async removeItems(ids: string[]): Promise<void> {
    await db.offlineQueue.bulkDelete(ids);
  }

  /**
   * 增加重试计数
   */
  async incrementRetry(id: string): Promise<void> {
    const item = await db.offlineQueue.get(id);
    if (item) {
      await db.offlineQueue.update(id, { retryCount: item.retryCount + 1 });
    }
  }

  /**
   * 清理超过最大重试次数的项
   */
  async cleanupExpired(maxRetries: number = 5): Promise<number> {
    const items = await db.offlineQueue.toArray();
    const expired = items.filter(item => item.retryCount >= maxRetries);
    if (expired.length > 0) {
      await db.offlineQueue.bulkDelete(expired.map(item => item.id));
    }
    return expired.length;
  }

  /**
   * 清空整个队列
   */
  async clear(): Promise<void> {
    await db.offlineQueue.clear();
  }

  /**
   * 检查队列是否为空
   */
  async isEmpty(): Promise<boolean> {
    return (await db.offlineQueue.count()) === 0;
  }

  /**
   * 是否正在处理中
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * 设置处理状态
   */
  setProcessing(value: boolean): void {
    this.processing = value;
  }
}

// 单例导出
export const offlineQueue = new OfflineQueue();
