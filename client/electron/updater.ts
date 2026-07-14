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
import { BrowserWindow, app, net } from 'electron';
import { logger } from './logger.js';

/** 自动检查开关（由渲染进程通过 IPC 设置，默认开启） */
let autoCheckEnabled = true;

/** 检查更新超时时间（毫秒） */
const CHECK_UPDATE_TIMEOUT = 10_000;

/** 下载重试状态 */
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
}

/**
 * 带超时保护的 checkForUpdates 封装
 * 超过 CHECK_UPDATE_TIMEOUT 未响应则视为失败
 */
function checkForUpdatesWithTimeout(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('未成功取得资源，请检查网络连接后重试'));
    }, CHECK_UPDATE_TIMEOUT);

    autoUpdater.checkForUpdates()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
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

    // 断网时静默忽略，不弹窗打扰用户
    if (!net.isOnline()) {
      logger.info('[AutoUpdater] Offline, skipping error notification');
      return;
    }

    sendToRenderer(mainWindow, 'update-status', {
      status: 'error',
      message: error.message,
    });
  });

  // 启动时检查更新（延迟 10 秒，等窗口加载完）
  setTimeout(() => {
    if (!autoCheckEnabled) return;
    // 断网时跳过检查，静默等待下次启动
    if (!net.isOnline()) {
      logger.info('[AutoUpdater] Offline, skipping auto check');
      return;
    }
    checkForUpdatesWithTimeout().catch((err: unknown) => {
      logger.error('[AutoUpdater] Initial check failed', err);
      // 断网导致的失败不通知前端
      if (!net.isOnline()) return;
      sendToRenderer(mainWindow, 'update-status', {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, 10_000);
}

export function checkForUpdate(): void {
  checkForUpdatesWithTimeout().catch((err: unknown) => {
    logger.error('[AutoUpdater] Manual check failed', err);
    // 手动检查时也将超时错误通知到渲染进程
    sendToRenderer(
      BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null,
      'update-status',
      { status: 'error', message: err instanceof Error ? err.message : String(err) },
    );
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
  // 清理由（当前无定时任务，保留以便未来扩展）
}

function sendToRenderer(win: BrowserWindow | null, channel: string, data: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
