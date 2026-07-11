/**
 * IPC 安全注册工具
 *
 * 在注册新 handler 前先 removeHandler，确保幂等注册，
 * 防止 macOS activate 事件导致 createWindow() 被多次调用时
 * 触发 "Attempted to register a second handler" 崩溃。
 */
import { ipcMain } from 'electron';

export function safeHandle(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>,
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}
