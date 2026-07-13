/**
 * Electron 主进程入口
 *
 * 应用生命周期管理、单实例锁、IPC handler 注册。
 * 窗口创建 → windowManager.ts
 * 托盘管理 → trayManager.ts
 * AI 网关代理 → ai/index.ts + ai/handlers/*.ts
 * 截图/音频采集 → captureHandlers.ts
 */

import { app, BrowserWindow, Menu, dialog, session } from 'electron';
import { writeFile, readFile } from 'fs/promises';
import { safeHandle, setMainWindowId } from './ipcUtils.js';
import { logger } from './logger.js';
import { registerAIHandlers } from './ai/index.js';
import { initAutoUpdater, checkForUpdate, downloadUpdate, installUpdate, destroyAutoUpdater, setAutoCheckEnabled } from './updater.js';
import { createMainWindow, saveCloseChoice } from './windowManager.js';
import { destroyTray } from './trayManager.js';
import { registerCaptureHandlers, disposeCaptureHandlers } from './captureHandlers.js';

// 仅开发模式禁用 Electron 安全警告，生产环境保留
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// ================================================================
// 模块级状态
// ================================================================

/** 标记应用是否正在退出（区分"最小化到托盘"与"真正退出"） */
const isQuittingRef = { value: false };

/** 主窗口引用 */
let mainWindow: BrowserWindow | null = null;

// ================================================================
// 退出辅助
// ================================================================

/** 确认退出应用 */
function performQuit(): void {
  isQuittingRef.value = true;
  app.quit();
}

// ================================================================
// 单实例锁 — 防止重复启动导致多个后台进程
// ================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  // ================================================================
  // 应用生命周期
  // ================================================================

  process.on('uncaughtException', (error) => {
    logger.crash('Uncaught Exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.crash('Unhandled Rejection', error);
  });

  app.whenReady().then(() => {
    logger.info('App ready');

    // ================================================================
    // SEC-005: CSP 安全策略注入
    // ================================================================
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    try {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // 开发环境：允许 unsafe-inline/unsafe-eval（Vite HMR 需要）
        // 生产环境：禁止 unsafe-eval，保留 unsafe-inline（Tailwind 运行时需要）
        const csp = isDev
          ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:;"
          : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';";

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp],
          },
        });
      });
      logger.info(`[SEC] CSP policy injected (${isDev ? 'development' : 'production'} mode)`);
    } catch (err) {
      // CSP 注入失败时记录错误但不阻塞启动
      logger.error('[SEC] Failed to inject CSP policy', err);
    }

    registerAIHandlers();
    registerCaptureHandlers();

    // 隐藏默认 Electron 菜单栏
    Menu.setApplicationMenu(null);

    // 通用 IPC handlers
    safeHandle('get-app-version', async () => {
      return app.getVersion();
    });

    safeHandle('dialog:selectDirectory', async (_event, options?: { title?: string; defaultPath?: string }) => {
      const result = await dialog.showOpenDialog({
        title: options?.title || '选择数据存储目录',
        defaultPath: options?.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, path: null };
      }

      return { canceled: false, path: result.filePaths[0] };
    });

    // 创建主窗口（内部会创建托盘）
    mainWindow = createMainWindow(isQuittingRef, performQuit);

    // SEC-005: 设置主窗口 ID 以启用 IPC sender 验证
    setMainWindowId(mainWindow.webContents.id);

    initAutoUpdater(mainWindow);

    // ---- 窗口控制 IPC handlers ----
    safeHandle('window:minimize', async () => {
      if (mainWindow) mainWindow.minimize();
      return { success: true };
    });

    safeHandle('window:maximize', async () => {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
      return { success: true };
    });

    safeHandle('window:close', async () => {
      if (mainWindow) mainWindow.close();
      return { success: true };
    });

    safeHandle('window:isMaximized', async () => {
      return mainWindow ? mainWindow.isMaximized() : false;
    });

    safeHandle('window:close-action', async (_event, action: 'quit' | 'minimize' | 'cancel', remember: boolean) => {
      if (!mainWindow) return;

      if (remember) {
        saveCloseChoice(action);
      }

      if (action === 'quit') {
        performQuit();
      } else if (action === 'minimize') {
        mainWindow.hide();
      }
    });

    // 更新相关 IPC handler
    safeHandle('update:check', async () => {
      checkForUpdate();
      return { success: true };
    });

    safeHandle('update:download', async () => {
      downloadUpdate();
      return { success: true };
    });

    safeHandle('update:install', async () => {
      installUpdate();
      return { success: true };
    });

    safeHandle('update:set-auto-check', async (_event, enabled: boolean) => {
      setAutoCheckEnabled(enabled);
      return { success: true };
    });

    // ================================================================
    // v0.9.0: 备份相关 IPC handlers
    // ================================================================

    /**
     * 显示保存对话框并将备份数据写入文件
     */
    safeHandle('backup:save', async (_event, data: string, defaultName?: string) => {
      const filename = defaultName || `keban-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const result = await dialog.showSaveDialog({
        title: '保存备份文件',
        defaultPath: filename,
        filters: [
          { name: 'KeBan 备份文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true, path: null };
      }

      try {
        await writeFile(result.filePath, data, 'utf-8');
        return { success: true, canceled: false, path: result.filePath };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '写入失败';
        return { success: false, canceled: false, path: null, error: msg };
      }
    });

    /**
     * 显示打开对话框，选择备份文件并读取内容
     */
    safeHandle('backup:open', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择备份文件',
        filters: [
          { name: 'KeBan 备份文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, content: null };
      }

      try {
        const content = await readFile(result.filePaths[0], 'utf-8');
        return { success: true, canceled: false, content, path: result.filePaths[0] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '读取失败';
        return { success: false, canceled: false, content: null, error: msg };
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow(isQuittingRef, performQuit);
        // SEC-005: macOS activate 重新创建窗口时同步更新 sender ID
        setMainWindowId(mainWindow.webContents.id);
      }
    });
  });

  // 标记应用即将退出
  app.on('before-quit', () => {
    isQuittingRef.value = true;
  });

  // 所有窗口关闭时退出应用
  app.on('window-all-closed', () => {
    logger.info('All windows closed');

    disposeCaptureHandlers();
    destroyAutoUpdater();
    destroyTray();
    mainWindow = null;
    app.quit();
  });
}
