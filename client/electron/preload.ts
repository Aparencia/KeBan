/**
 * Electron 预加载脚本
 *
 * 在渲染进程与主进程之间建立安全的通信桥梁，
 * 通过 contextBridge 暴露白名单内的 IPC channel。
 */

import { contextBridge, ipcRenderer } from 'electron';

/** 允许渲染进程调用的 IPC channel 白名单 */
const ALLOWED_CHANNELS = [
  'ai_summarize',
  'ai_generate_cards',
  'ai_evaluate',
  'ai_recommend_duration',
  'ai_feynman_question',
  'ai_feynman_evaluate_answers',
  'screen_list_windows',
  'screen_capture_start',
  'screen_capture_stop',
  'audio_list_sources',
  'audio_capture_start',
  'audio_capture_stop',
  'get-app-version',
  'dialog:selectDirectory',
  'get-default-storage-path',
  'update:check',
  'update:download',
  'update:install',
  'update:set-auto-check',
  'window:close-action',
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:isMaximized',
  // v0.9.0: 备份相关 IPC channel
  'backup:save',
  'backup:open',
  // v1.0.0: 数据访问 IPC channel
  'db:query',
  'db:insert',
  'db:update',
  'db:delete',
  'db:search',
  'db:batch',
  // v1.0.0: 数据迁移 IPC channel
  'migration:check',
  'migration:import-table',
  'migration:complete',
  // v1.1.0: 存储路径切换 IPC channel
  'storage:change-path',
  'storage:get-active-path',
] as const;

/** 允许渲染进程监听的事件 channel 白名单（主进程 → 渲染进程推送） */
const ALLOWED_EVENT_CHANNELS = [
  'screen_capture_frame',
  'audio_capture_chunk',
  'audio_capture_do_start',
  'audio_capture_do_stop',
  'update-status',
  'window:closing',
  'window:maximized-changed',
] as const;

/** 允许渲染进程单向发送的 channel 白名单（渲染进程 → 主进程，fire-and-forget） */
const ALLOWED_SEND_CHANNELS = [
  'audio_capture_chunk',
] as const;

type AllowedChannel = (typeof ALLOWED_CHANNELS)[number];
type AllowedEventChannel = (typeof ALLOWED_EVENT_CHANNELS)[number];
type AllowedSendChannel = (typeof ALLOWED_SEND_CHANNELS)[number];

/**
 * 暴露 electronAPI 对象到渲染进程的 window 全局变量，
 * 仅允许白名单内的 channel 通过，防止任意 IPC 调用。
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: AllowedChannel, ...args: unknown[]) => {
    if ((ALLOWED_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`[preload] 不允许的 IPC channel: ${channel}`));
  },
  on: (channel: AllowedEventChannel, callback: (...args: unknown[]) => void) => {
    if ((ALLOWED_EVENT_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
      return () => {
        ipcRenderer.removeAllListeners(channel);
      };
    }
    console.warn(`[preload] 不允许的事件 channel: ${channel}`);
    return () => {};
  },
  send: (channel: AllowedSendChannel, ...args: unknown[]) => {
    if ((ALLOWED_SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] 不允许的发送 channel: ${channel}`);
    }
  },
  /** 监听主进程发出的窗口关闭事件 */
  onWindowClosing: (callback: () => void) => {
    ipcRenderer.on('window:closing', callback);
    return () => ipcRenderer.removeAllListeners('window:closing');
  },
  /** 向主进程发送关闭行为选择 */
  closeAction: (action: 'quit' | 'minimize' | 'cancel', remember: boolean) => {
    return ipcRenderer.invoke('window:close-action', action, remember);
  },
  // ---- 窗口控制 API ----
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: unknown, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximized-changed', handler);
    return () => ipcRenderer.removeListener('window:maximized-changed', handler);
  },
  // ---- 自动更新 API ----
  /** 设置是否自动检查更新 */
  setAutoUpdate: (enabled: boolean) => ipcRenderer.invoke('update:set-auto-check', enabled),
  // ---- v0.9.0: 备份 API ----
  /** 保存备份文件（显示系统保存对话框） */
  backupSave: (data: string, defaultName?: string) => ipcRenderer.invoke('backup:save', data, defaultName),
  /** 打开备份文件（显示系统打开对话框，返回文件内容） */
  backupOpen: () => ipcRenderer.invoke('backup:open'),
  // ---- v1.0.0: 数据访问 API ----
  db: {
    query: (table: string, method: string, args?: unknown[]) =>
      ipcRenderer.invoke('db:query', { table, method, args }),
    insert: (table: string, item: unknown) =>
      ipcRenderer.invoke('db:insert', { table, item }),
    update: (table: string, id: string, changes: unknown) =>
      ipcRenderer.invoke('db:update', { table, id, changes }),
    delete: (table: string, id: string) =>
      ipcRenderer.invoke('db:delete', { table, id }),
    search: (table: string, query: string) =>
      ipcRenderer.invoke('db:search', { table, query }),
    batch: (operations: unknown[]) =>
      ipcRenderer.invoke('db:batch', { operations }),
  },
  // ---- v1.0.0: 数据迁移 API ----
  migration: {
    check: () => ipcRenderer.invoke('migration:check'),
    importTable: (table: string, rows: unknown[]) =>
      ipcRenderer.invoke('migration:import-table', { table, rows }),
    complete: () => ipcRenderer.invoke('migration:complete'),
  },
  // ---- v1.1.0: 存储路径管理 API ----
  storage: {
    changePath: (newPath: string) =>
      ipcRenderer.invoke('storage:change-path', { newPath }),
    getActivePath: () =>
      ipcRenderer.invoke('storage:get-active-path'),
  },
});
