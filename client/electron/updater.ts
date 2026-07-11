/**
 * 自动更新模块
 *
 * 封装 electron-updater 的 autoUpdater，
 * 处理更新检查、下载、安装等事件，
 * 通过 IPC 将状态推送到渲染进程。
 */
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import type { UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, app } from 'electron';
import { logger } from './logger.js';

let updateCheckInterval: ReturnType<typeof setTimeout> | null = null;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 小时

export function initAutoUpdater(mainWindow: BrowserWindow | null): void {
  // 开发模式下禁用自动更新
  if (!app.isPackaged) {
    logger.info('[AutoUpdater] Skipped in development mode');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.info('[AutoUpdater] Checking for update...');
    sendToRenderer(mainWindow, 'update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info(`[AutoUpdater] Update available: v${info.version}`);
    sendToRenderer(mainWindow, 'update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('[AutoUpdater] No update available');
    sendToRenderer(mainWindow, 'update-status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendToRenderer(mainWindow, 'update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info(`[AutoUpdater] Update downloaded: v${info.version}`);
    sendToRenderer(mainWindow, 'update-status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (error: Error) => {
    logger.error('[AutoUpdater] Error', error);
    sendToRenderer(mainWindow, 'update-status', {
      status: 'error',
      message: error.message,
    });
  });

  // 启动时检查更新（延迟 10 秒，等窗口加载完）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('[AutoUpdater] Initial check failed', err);
    });
  }, 10_000);

  // 定期检查更新
  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('[AutoUpdater] Periodic check failed', err);
    });
  }, CHECK_INTERVAL_MS);
}

export function checkForUpdate(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    logger.error('[AutoUpdater] Manual check failed', err);
  });
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    logger.error('[AutoUpdater] Download failed', err);
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}

export function destroyAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

function sendToRenderer(win: BrowserWindow | null, channel: string, data: any): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
