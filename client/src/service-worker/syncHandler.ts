/**
 * 熵减 Service Worker 同步处理器
 *
 * 利用 Background Sync API（渐进增强）在网络恢复时
 * 通知客户端应用执行离线队列重放。
 *
 * 注意：Background Sync API 目前仅 Chromium 系浏览器完整支持，
 * 其他浏览器会静默降级，不影响正常功能。
 */

declare const self: ServiceWorkerGlobalScope;

interface SyncEvent extends ExtendableEvent {
  tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * 监听 sync 事件 —— 当网络恢复时由浏览器触发
 */
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'keban-sync') {
    event.waitUntil(replayOfflineQueue());
  }
});

/**
 * 通知所有已打开的客户端页面执行同步
 */
async function replayOfflineQueue(): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  });
}

/**
 * 注册一次 sync —— 由应用层在离线操作后调用
 * 例如：navigator.serviceWorker.ready.then(reg => reg.sync.register('keban-sync'))
 */
export async function registerSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  if ('sync' in registration) {
    await (registration as unknown as { sync: { register(tag: string): Promise<void> } }).sync
      .register('keban-sync');
  }
}

/**
 * 监听来自 Service Worker 的消息
 * 返回一个取消订阅函数
 */
export function onSyncMessage(
  callback: (data: { type: string }) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_REQUESTED') {
      callback(event.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}
