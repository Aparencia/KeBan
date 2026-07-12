/**
 * 屏幕截图 & 系统音频 IPC Handler
 *
 * 从 main.ts 拆分而来，管理截图采集和音频捕获的生命周期。
 */

import { BrowserWindow, ipcMain, desktopCapturer } from 'electron';
import { ScreenCapture } from './screenCapture.js';
import type { ScreenCaptureOptions, ScreenshotFrameData } from './screenCapture.js';
import { AudioCapture, listAudioSources } from './audioCapture.js';
import type { AudioCaptureOptions, AudioChunk } from './audioCapture.js';
import { safeHandle } from './ipcUtils.js';
import { logger } from './logger.js';

// ================================================================
// 模块级状态
// ================================================================

/** 当前活跃的截图采集实例 */
let activeCapture: ScreenCapture | null = null;

/** 当前活跃的音频捕获实例 */
let activeAudioCapture: AudioCapture | null = null;

// ================================================================
// 公共 API
// ================================================================

/**
 * 注册所有截图 & 音频相关的 IPC handler
 */
export function registerCaptureHandlers(): void {
  // ---- 屏幕截图 ----

  safeHandle(
    'screen_capture_start',
    async (event, options: ScreenCaptureOptions) => {
      if (activeCapture) {
        activeCapture.dispose();
        activeCapture = null;
      }

      const senderWin = BrowserWindow.fromWebContents(event.sender);

      activeCapture = new ScreenCapture(options, (frame: ScreenshotFrameData) => {
        if (senderWin && !senderWin.isDestroyed()) {
          senderWin.webContents.send('screen_capture_frame', frame);
        }
      });

      activeCapture.start();
      logger.info('[IPC] screen_capture_start 已启动');
      return { success: true };
    },
  );

  safeHandle('screen_capture_stop', async () => {
    if (activeCapture) {
      activeCapture.dispose();
      activeCapture = null;
      logger.info('[IPC] screen_capture_stop 已停止');
    }
    return { success: true };
  });

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

  // ---- 系统音频捕获 ----

  safeHandle('audio_list_sources', async () => {
    try {
      return await listAudioSources();
    } catch (err) {
      logger.error('[IPC] audio_list_sources failed:', err);
      return [];
    }
  });

  safeHandle(
    'audio_capture_start',
    async (event, options?: Partial<AudioCaptureOptions> & { sourceId?: string }) => {
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

  safeHandle('audio_capture_stop', async () => {
    if (activeAudioCapture) {
      activeAudioCapture.dispose();
      activeAudioCapture = null;
      logger.info('[IPC] audio_capture_stop 已停止');
    }
    return { success: true };
  });

  ipcMain.on(
    'audio_capture_chunk',
    (_event, data: { audioBuffer: ArrayBuffer; sampleRate: number; channels: number; durationMs: number }) => {
      if (activeAudioCapture && activeAudioCapture.isCapturing) {
        activeAudioCapture.handleRendererChunk(data);
      }
    },
  );
}

// ================================================================
// 清理
// ================================================================

/**
 * 释放所有活跃的采集实例
 */
export function disposeCaptureHandlers(): void {
  if (activeCapture) {
    activeCapture.dispose();
    activeCapture = null;
  }
  if (activeAudioCapture) {
    activeAudioCapture.dispose();
    activeAudioCapture = null;
  }
}
