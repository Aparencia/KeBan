/**
 * Electron 主进程入口
 *
 * 创建 BrowserWindow，注册 IPC handler 代理 AI 网关请求。
 */

// 开发时禁用 Electron 安全警告
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

import { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage, dialog } from 'electron';
import { ScreenCapture } from './screenCapture.js';
import type { ScreenCaptureOptions, ScreenshotFrameData } from './screenCapture.js';
import { AudioCapture, listAudioSources } from './audioCapture.js';
import type { AudioCaptureOptions, AudioChunk } from './audioCapture.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { safeHandle } from './ipcUtils.js';
import { logger } from './logger.js';
import { registerAIHandlers } from './aiHandlers.js';
import { initAutoUpdater, checkForUpdate, downloadUpdate, installUpdate, destroyAutoUpdater } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// 常量与辅助函数
// ================================================================

/** 标记应用是否正在退出（区分"最小化到托盘"与"真正退出"） */
let isQuitting = false;

/** 系统托盘实例 */
let tray: Tray | null = null;

/** 主窗口引用 */
let mainWindow: BrowserWindow | null = null;

// ================================================================
// 系统托盘
// ================================================================

/** 创建系统托盘图标及右键菜单 */
function createTray(win: BrowserWindow): void {
  const iconPath = path.join(__dirname, '..', 'app-icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  // 如果图标加载失败则创建 16x16 空白图标作为 fallback
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  } else {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('课伴 KeBan');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        win.show();
        win.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标恢复窗口
  tray.on('double-click', () => {
    win.show();
    win.focus();
  });
}

// ================================================================
// 创建主窗口
// ================================================================

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '课伴',
    icon: path.join(__dirname, '..', 'app-icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow = win;

  // 判断开发/生产模式
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    // 开发模式：连接 Vite 开发服务器
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的 index.html
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // 关闭窗口时最小化到托盘而非退出
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  // 创建系统托盘
  createTray(win);
}

// ================================================================
// IPC Handler — 屏幕截图采集
// ================================================================

/** 当前活跃的截图采集实例 */
let activeCapture: ScreenCapture | null = null;

/**
 * screen_capture_start — 开始截图采集
 * 创建 ScreenCapture 实例，定时截图并通过 IPC 推送到渲染进程
 */
safeHandle(
  'screen_capture_start',
  async (event, options: ScreenCaptureOptions) => {
    // 先停止已有实例
    if (activeCapture) {
      activeCapture.dispose();
      activeCapture = null;
    }

    const senderWin = BrowserWindow.fromWebContents(event.sender);

    activeCapture = new ScreenCapture(options, (frame: ScreenshotFrameData) => {
      // 通过 IPC event 将截图帧推送到渲染进程
      if (senderWin && !senderWin.isDestroyed()) {
        senderWin.webContents.send('screen_capture_frame', frame);
      }
    });

    activeCapture.start();
    logger.info('[IPC] screen_capture_start 已启动');
    return { success: true };
  },
);

/**
 * screen_capture_stop — 停止截图采集
 */
safeHandle('screen_capture_stop', async () => {
  if (activeCapture) {
    activeCapture.dispose();
    activeCapture = null;
    logger.info('[IPC] screen_capture_stop 已停止');
  }
  return { success: true };
});

/**
 * screen_list_windows — 获取可捕获窗口列表
 * 返回窗口 id、标题、缩略图（base64）
 */
safeHandle('screen_list_windows', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 240, height: 135 },
    });

    return sources.map((src) => ({
      id: src.id,
      title: src.name,
      thumbnail: src.thumbnail.toDataURL(),
    }));
  } catch (err) {
    logger.error('[IPC] screen_list_windows failed:', err);
    return [];
  }
});

// ================================================================
// IPC Handler — 系统音频捕获
// ================================================================

/** 当前活跃的音频捕获实例 */
let activeAudioCapture: AudioCapture | null = null;

/**
 * audio_list_sources — 列出可用的系统音频源
 * 使用 desktopCapturer.getSources({ audio: true })
 */
safeHandle('audio_list_sources', async () => {
  try {
    return await listAudioSources();
  } catch (err) {
    logger.error('[IPC] audio_list_sources failed:', err);
    return [];
  }
});

/**
 * audio_capture_start — 开始系统音频捕获
 * 创建 AudioCapture 实例，通过 desktopCapturer 发现音频源，
 * 委托渲染进程执行 getUserMedia 采集
 */
safeHandle(
  'audio_capture_start',
  async (event, options?: Partial<AudioCaptureOptions> & { sourceId?: string }) => {
    // 先停止已有实例
    if (activeAudioCapture) {
      activeAudioCapture.dispose();
      activeAudioCapture = null;
    }

    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || senderWin.isDestroyed()) {
      return { success: false, error: 'No valid window' };
    }

    const captureOptions: Partial<AudioCaptureOptions> = {
      chunkDurationMs: options?.chunkDurationMs,
      sampleRate: options?.sampleRate,
      channels: options?.channels,
    };

    activeAudioCapture = new AudioCapture(captureOptions, (chunk: AudioChunk) => {
      // 通过 IPC event 将音频块推送到渲染进程
      if (senderWin && !senderWin.isDestroyed()) {
        senderWin.webContents.send('audio_capture_chunk', chunk);
      }
    });

    try {
      await activeAudioCapture.start(senderWin, options?.sourceId);
      logger.info('[IPC] audio_capture_start 已启动');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[IPC] audio_capture_start failed:', message);
      activeAudioCapture.dispose();
      activeAudioCapture = null;
      return { success: false, error: message };
    }
  },
);

/**
 * audio_capture_stop — 停止系统音频捕获
 */
safeHandle('audio_capture_stop', async () => {
  if (activeAudioCapture) {
    activeAudioCapture.dispose();
    activeAudioCapture = null;
    logger.info('[IPC] audio_capture_stop 已停止');
  }
  return { success: true };
});

/**
 * audio_capture_chunk — 接收渲染进程上报的音频块
 * 渲染进程完成 getUserMedia + Web Audio 切片后，通过此 channel 回传数据
 */
ipcMain.on(
  'audio_capture_chunk',
  (_event, data: { audioBuffer: ArrayBuffer; sampleRate: number; channels: number; durationMs: number }) => {
    if (activeAudioCapture && activeAudioCapture.isCapturing) {
      activeAudioCapture.handleRendererChunk(data);
    }
  },
);

// ================================================================
// 单实例锁 — 防止重复启动导致多个后台进程
// ================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 已有实例运行，立即退出
  app.quit();
} else {
  // 监听第二个实例启动事件，聚焦已有窗口
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
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
    registerAIHandlers();

    // 隐藏默认 Electron 菜单栏
    Menu.setApplicationMenu(null);

    // 新增：get-app-version handler
    safeHandle('get-app-version', async () => {
      return app.getVersion();
    });

    // 新增：dialog:selectDirectory handler — 允许用户选择数据存储目录
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

    createWindow();
    initAutoUpdater(mainWindow);

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

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // 标记应用即将退出，让 close 事件不再拦截
  app.on('before-quit', () => {
    isQuitting = true;
  });

  // 所有窗口关闭时退出应用
  app.on('window-all-closed', () => {
    logger.info('All windows closed');

    // 清理截图采集实例
    if (activeCapture) {
      activeCapture.dispose();
      activeCapture = null;
    }
    // 清理音频捕获实例
    if (activeAudioCapture) {
      activeAudioCapture.dispose();
      activeAudioCapture = null;
    }
    // 清理自动更新定时器
    destroyAutoUpdater();
    // 清理托盘
    if (tray) {
      tray.destroy();
      tray = null;
    }
    mainWindow = null;
    app.quit();
  });
}
