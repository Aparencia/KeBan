/**
 * 自动更新模块
 *
 * 封装 electron-updater 的 autoUpdater，
 * 处理更新检查、下载、安装等事件，
 * 通过 IPC 将状态推送到渲染进程。
 */
import * as electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import type { UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, app } from 'electron';
import { logger } from './logger.js';

let updateCheckInterval: ReturnType<typeof setTimeout> | null = null;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 小时

/** 自动检查开关（由渲染进程通过 IPC 设置，默认开启） */
let autoCheckEnabled = true;

// ---- 下载重试状态 ----
let downloadRetryCount = 0;
const MAX_DOWNLOAD_RETRIES = 3;
const DOWNLOAD_RETRY_DELAYS = [30_000, 60_000, 120_000]; // 30s, 60s, 120s
/** 标记当前是否正在下载（用于区分 error 事件来源） */
let isDownloading = false;

/**
 * 设置自动检查开关
 * 由 main.ts 的 IPC handler 调用
 */
export function setAutoCheckEnabled(enabled: boolean): void {
  autoCheckEnabled = enabled;
  logger.info(`[AutoUpdater] Auto check ${enabled ? 'enabled' : 'disabled'}`);

  if (!enabled && updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  } else if (enabled && !updateCheckInterval && app.isPackaged) {
    startPeriodicCheck();
  }
}

/** 启动定期检查（4h 轮询） */
function startPeriodicCheck(): void {
  if (updateCheckInterval) return;
  updateCheckInterval = setInterval(() => {
    if (!autoCheckEnabled) return;
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('[AutoUpdater] Periodic check failed', err);
    });
  }, CHECK_INTERVAL_MS);
}

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
      releaseNotes: info.releaseNotes ?? null,
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
    // 下载成功，重置重试计数
    downloadRetryCount = 0;
    isDownloading = false;
    sendToRenderer(mainWindow, 'update-status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (error: Error) => {
    logger.error('[AutoUpdater] Error', error);

    // 下载失败时执行带退避的重试
    if (isDownloading && downloadRetryCount < MAX_DOWNLOAD_RETRIES) {
      const delay = DOWNLOAD_RETRY_DELAYS[downloadRetryCount] ?? DOWNLOAD_RETRY_DELAYS[DOWNLOAD_RETRY_DELAYS.length - 1];
      downloadRetryCount++;
      logger.warn(
        `[AutoUpdater] Download failed, retrying in ${delay / 1000}s (attempt ${downloadRetryCount}/${MAX_DOWNLOAD_RETRIES})`,
      );
      sendToRenderer(mainWindow, 'update-status', {
        status: 'downloading',
        percent: 0,
        retryIn: delay,
        retryCount: downloadRetryCount,
        maxRetries: MAX_DOWNLOAD_RETRIES,
      });
      setTimeout(() => {
        autoUpdater.downloadUpdate().catch((err) => {
          logger.error('[AutoUpdater] Retry download failed', err);
        });
      }, delay);
      return;
    }

    // 重试耗尽或非下载阶段的错误
    downloadRetryCount = 0;
    isDownloading = false;
    sendToRenderer(mainWindow, 'update-status', {
      status: 'error',
      message: error.message,
    });
  });

  // 启动时检查更新（延迟 10 秒，等窗口加载完）
  setTimeout(() => {
    if (!autoCheckEnabled) return;
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('[AutoUpdater] Initial check failed', err);
    });
  }, 10_000);

  // 启动定期检查（受 autoCheckEnabled 控制）
  startPeriodicCheck();
}

export function checkForUpdate(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    logger.error('[AutoUpdater] Manual check failed', err);
  });
}

export function downloadUpdate(): void {
  isDownloading = true;
  downloadRetryCount = 0;
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

function sendToRenderer(win: BrowserWindow | null, channel: string, data: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
