import { apiClient } from '@/lib/http/apiClient';
import { getDeviceId, getUnsyncedLogsBatch, markLogsSynced } from '../storage/operationLog';
import { offlineQueue } from './OfflineQueue';
import { networkManager } from './NetworkManager';
import type { SyncConflict } from '../../types/models';

/**
 * 同步引擎
 * 负责客户端与服务端之间的数据同步
 * 支持 push（推送本地变更）、pull（拉取远端变更）、conflict 处理
 */
export class SyncEngine {
  private syncInProgress = false;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(event: SyncEvent) => void> = new Set();

  // Sync API base path (apiClient prepends VITE_API_BASE_URL automatically)
  private syncBasePath = '/api/v1/sync';

  /**
   * 启动自动同步
   */
  startAutoSync(intervalMs: number = 60000): void {
    this.stopAutoSync();
    this.autoSyncInterval = setInterval(() => { this.sync(); }, intervalMs);
    // 监听网络恢复，立即触发同步
    networkManager.subscribe((state) => {
      if (state.status === 'online') {
        this.sync();
      }
    });
  }

  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  /**
   * 暂停同步引擎
   * 停止自动同步并阻止新的同步请求（用于路径切换等关键操作前）
   */
  pause(): void {
    this.stopAutoSync();
    this.syncInProgress = true;
  }

  /**
   * 恢复同步引擎
   * 解除同步锁定并重新启动自动同步（用于路径切换完成后）
   */
  resume(): void {
    this.syncInProgress = false;
    this.startAutoSync();
  }

  /**
   * 执行完整同步流程：push → pull → replay offline queue
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { pushed: 0, pulled: 0, conflicts: [], errors: ['Sync already in progress'] };
    }

    const networkState = networkManager.getState();
    if (networkState.status === 'offline') {
      return { pushed: 0, pulled: 0, conflicts: [], errors: ['Device is offline'] };
    }

    this.syncInProgress = true;
    this.emit({ type: 'sync-start' });

    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
    };

    try {
      // Step 1: Push local changes
      const pushResult = await this.push();
      result.pushed = pushResult.pushed;
      result.conflicts.push(...pushResult.conflicts);
      result.errors.push(...pushResult.errors);

      // Step 2: Pull remote changes
      const pullResult = await this.pull();
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);

      // Step 3: Replay offline queue
      await this.replayOfflineQueue();

      this.emit({ type: 'sync-complete', result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      result.errors.push(message);
      this.emit({ type: 'sync-error', error: message });
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Push: 将本地未同步的操作日志推送到服务端
   */
  async push(): Promise<{ pushed: number; conflicts: SyncConflict[]; errors: string[] }> {
    const logs = await getUnsyncedLogsBatch(50);
    if (logs.length === 0) return { pushed: 0, conflicts: [], errors: [] };

    const deviceId = getDeviceId();
    const conflicts: SyncConflict[] = [];
    const errors: string[] = [];
    let pushed = 0;

    try {
      const response = await apiClient.post<{
        accepted: string[];
        conflicts: Array<{
          entityType: string;
          entityId: string;
          serverVersion: number;
          serverData: unknown;
        }>;
        errors: string[];
      }>(`${this.syncBasePath}/push`, {
        deviceId,
        operations: logs.map(log => ({
          id: log.id,
          entityType: log.entityType,
          entityId: log.entityId,
          operation: log.operation,
          version: log.version,
          patch: log.patch,
          // payload is stored as JSON string in IndexedDB; parse back to object
          // to avoid double-encoding when the request body is JSON-serialized
          payload: log.payload ? safeJsonParse(log.payload) : undefined,
          createdAt: log.createdAt.toISOString(),
        })),
      });

      // Mark accepted logs as synced
      if (response.accepted.length > 0) {
        await markLogsSynced(response.accepted);
        pushed = response.accepted.length;
      }

      // Handle conflicts
      if (response.conflicts.length > 0) {
        for (const conflict of response.conflicts) {
          conflicts.push({
            id: crypto.randomUUID(),
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            localData: '{}',
            remoteData: JSON.stringify(conflict.serverData),
            localVersion: logs.find(l => l.entityId === conflict.entityId)?.version || 0,
            remoteVersion: conflict.serverVersion,
            status: 'pending',
            createdAt: new Date(),
          });
        }
      }

      errors.push(...(response.errors || []));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Push failed: ${message}`);
    }

    return { pushed, conflicts, errors };
  }

  /**
   * Pull: 从服务端拉取最新更新
   */
  async pull(): Promise<{ pulled: number; errors: string[] }> {
    const deviceId = getDeviceId();
    const errors: string[] = [];

    try {
      const lastVersion = this.getLastSyncVersion();

      const response = await apiClient.get<{
        operations: Array<{
          entityType: string;
          entityId: string;
          operation: string;
          data: unknown;
          version: number;
        }>;
        latestVersion: number;
      }>(`${this.syncBasePath}/pull?deviceId=${encodeURIComponent(deviceId)}&sinceVersion=${lastVersion}`);

      if (response.operations.length > 0) {
        await this.applyRemoteOperations(response.operations);
        this.setLastSyncVersion(response.latestVersion);
      }

      return { pulled: response.operations.length, errors };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Pull failed: ${message}`);
      return { pulled: 0, errors };
    }
  }

  /**
   * 重放离线队列
   * 仅处理已到达退避时间的就绪项，失败时计算指数退避
   */
  private async replayOfflineQueue(): Promise<void> {
    if (await offlineQueue.isEmpty()) return;
    if (offlineQueue.isProcessing()) return;

    offlineQueue.setProcessing(true);
    try {
      const items = await offlineQueue.getReadyItems();
      const successIds: string[] = [];
      const failedIds: string[] = [];
      const skippedCount = (await offlineQueue.getPendingItems()).length - items.length;

      for (const item of items) {
        try {
          await apiClient.post(`${this.syncBasePath}/push`, {
            deviceId: item.deviceId,
            operations: [{
              id: item.id,
              entityType: item.entityType,
              entityId: item.entityId,
              operation: item.operation,
              version: item.version,
              // payload is stored as JSON string; parse back to object
              payload: item.payload ? safeJsonParse(item.payload) : undefined,
              createdAt: item.createdAt.toISOString(),
            }],
          });
          successIds.push(item.id);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console -- 同步重放失败需记录以便排查
          console.error(`[SyncEngine] 队列项重放失败 [${item.entityType}:${item.entityId}] (retryCount=${item.retryCount}): ${errMsg}`);
          await offlineQueue.scheduleRetry(item.id);
          failedIds.push(item.id);
        }
      }

      if (successIds.length > 0) {
        await offlineQueue.removeItems(successIds);
      }
      await offlineQueue.cleanupExpired(5);

      // 汇总日志
      if (successIds.length > 0 || failedIds.length > 0) {
        console.error(`[SyncEngine] 离线队列重放完成：成功=${successIds.length}，失败=${failedIds.length}，跳过(未到退避时间)=${skippedCount}`);
      }
    } finally {
      offlineQueue.setProcessing(false);
    }
  }

  /**
   * Resolve: 提交冲突解决结果到服务端
   */
  async resolve(conflict: SyncConflict, strategy: 'local' | 'remote' | 'manual', mergedData?: unknown): Promise<{ resolved: boolean; errors: string[] }> {
    const deviceId = getDeviceId();
    const errors: string[] = [];

    try {
      // Determine the payload to send:
      // - 'local': use the local data as the resolved version
      // - 'remote': no data needed, server wins
      // - 'manual': use the caller-supplied mergedData
      let data: unknown;
      if (strategy === 'local') {
        data = safeJsonParse(conflict.localData);
      } else if (strategy === 'manual') {
        data = mergedData;
      }
      // 'remote' sends no data

      const response = await apiClient.post<{
        resolved: boolean;
        strategy: string;
      }>(`${this.syncBasePath}/resolve`, {
        deviceId,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        strategy,
        data,
        version: strategy === 'remote' ? conflict.remoteVersion : Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
      });

      return { resolved: response.resolved, errors };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Resolve failed: ${message}`);
      return { resolved: false, errors };
    }
  }

  /**
   * Status: 获取服务端同步状态摘要
   */
  async status(): Promise<{
    totalOperations: number;
    trackedEntities: number;
    latestSeqNo: number;
    redisConnected: boolean;
  } | null> {
    try {
      return await apiClient.get<{
        totalOperations: number;
        trackedEntities: number;
        latestSeqNo: number;
        redisConnected: boolean;
      }>(`${this.syncBasePath}/status`);
    } catch {
      return null;
    }
  }

  // === Helper methods ===

  private getLastSyncVersion(): number {
    const stored = localStorage.getItem('keban_last_sync_version');
    return stored ? parseInt(stored, 10) : 0;
  }

  private setLastSyncVersion(version: number): void {
    localStorage.setItem('keban_last_sync_version', version.toString());
  }

  private async applyRemoteOperations(
    operations: Array<{ entityType: string; entityId: string; operation: string; data: unknown }>
  ): Promise<void> {
    const { db } = await import('../storage/database');

    for (const op of operations) {
      const tableName = this.getEntityTableName(op.entityType);
      if (!tableName) continue;

      const table = db.table(tableName);
      switch (op.operation) {
        case 'create':
        case 'update':
          await table.put(op.data);
          break;
        case 'delete':
          await table.delete(op.entityId);
          break;
      }
    }
  }

  private getEntityTableName(entityType: string): string | null {
    const typeMap: Record<string, string> = {
      'note': 'notes',
      'folder': 'noteFolders',
      'deck': 'flashcardDecks',
      'card': 'flashcards',
      'flashcardReview': 'flashcardReviews',
      'studySession': 'pomodoroSessions',
      'pomodoroSession': 'pomodoroSessions',
      'pomodoroSettings': 'pomodoroSettings',
      'feynmanNote': 'feynmanNotes',
      'feynmanSummary': 'feynmanSummaries',
      'feynmanWeakPoint': 'feynmanWeakPoints',
      'settings': 'appSettings',
    };
    return typeMap[entityType] || null;
  }

  subscribe(listener: (event: SyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}

// Types
export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export type SyncEvent =
  | { type: 'sync-start' }
  | { type: 'sync-complete'; result: SyncResult }
  | { type: 'sync-error'; error: string };

// Utility: safely parse a JSON string; return the original string on failure
function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Singleton
export const syncEngine = new SyncEngine();
