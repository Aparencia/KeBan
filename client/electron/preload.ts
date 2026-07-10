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
] as const;

type AllowedChannel = (typeof ALLOWED_CHANNELS)[number];

/**
 * 暴露 electronAPI 对象到渲染进程的 window 全局变量，
 * 仅允许白名单内的 channel 通过，防止任意 IPC 调用。
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: AllowedChannel, ...args: any[]) => {
    if ((ALLOWED_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`[preload] 不允许的 IPC channel: ${channel}`));
  },
});
