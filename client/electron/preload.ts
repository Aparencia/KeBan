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
] as const;

/** 允许渲染进程监听的事件 channel 白名单（主进程 → 渲染进程推送） */
const ALLOWED_EVENT_CHANNELS = [
  'screen_capture_frame',
  'audio_capture_chunk',
  'audio_capture_do_start',
  'audio_capture_do_stop',
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
});
