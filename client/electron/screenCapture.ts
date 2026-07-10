/**
 * Electron 主进程屏幕截图采集模块
 *
 * 使用 desktopCapturer API 定时截取指定窗口画面，
 * 通过 IPC 将 PNG 数据推送到渲染进程。
 */

import { desktopCapturer, DesktopCapturerSource, BrowserWindow } from 'electron';

// ================================================================
// 类型定义
// ================================================================

/** 可捕获窗口信息 */
export interface WindowInfo {
  id: string;
  name: string;
  displayId: string;
}

/** 截图采集配置 */
export interface ScreenCaptureOptions {
  interval: number;       // 截图间隔 ms，默认 5000
  windowId?: string;      // 目标窗口 source ID
}

/** 截图帧数据（通过 IPC 传输到渲染进程） */
export interface ScreenshotFrameData {
  imageBuffer: ArrayBuffer;  // PNG 图片数据
  width: number;
  height: number;
  timestamp: number;         // 单调递增时间戳 (ms)
  sourceId: string;          // 来源 source ID
  hasChanged: boolean;       // 帧变化检测结果（false 表示与上一帧相同，可跳过）
}

// ================================================================
// 截图采集器
// ================================================================

const DEFAULT_INTERVAL = 5000;
const THUMBNAIL_SIZE = { width: 1920, height: 1080 };

/** 单调递增时间戳生成器 */
let lastTimestamp = 0;
function monotonicTimestamp(): number {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}

export class ScreenCapture {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly options: Required<Pick<ScreenCaptureOptions, 'interval'>> &
    Pick<ScreenCaptureOptions, 'windowId'>;
  private readonly onScreenshot: (data: ScreenshotFrameData) => void;
  private disposed = false;

  /** 上一帧的简化 hash，用于快速判断画面是否变化 */
  private lastFrameHash = '';

  constructor(
    options: ScreenCaptureOptions,
    onScreenshot: (data: ScreenshotFrameData) => void,
  ) {
    this.options = {
      interval: options.interval || DEFAULT_INTERVAL,
      windowId: options.windowId,
    };
    this.onScreenshot = onScreenshot;
  }

  /**
   * 列出所有可捕获的窗口和屏幕源
   */
  static async listWindows(): Promise<WindowInfo[]> {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1, height: 1 }, // 列表不需要缩略图
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      displayId: source.display_id ?? '',
    }));
  }

  /**
   * 开始定时截图采集
   */
  start(): void {
    if (this.timer !== null || this.disposed) return;

    console.log(
      `[ScreenCapture] 开始采集, interval=${this.options.interval}ms, windowId=${this.options.windowId ?? 'auto'}`,
    );

    // 立即执行一次，然后定时执行
    this.captureAndEmit();
    this.timer = setInterval(() => {
      this.captureAndEmit();
    }, this.options.interval);
  }

  /**
   * 停止截图采集
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[ScreenCapture] 停止采集');
    }
  }

  /**
   * 单次截图（不启动定时器）
   */
  async captureOnce(): Promise<ScreenshotFrameData | null> {
    const source = await this.resolveSource();
    if (!source) {
      console.warn('[ScreenCapture] captureOnce: 未找到可用的截图源');
      return null;
    }

    return this.extractFrame(source);
  }

  /**
   * 销毁实例，释放所有资源
   */
  dispose(): void {
    this.stop();
    this.disposed = true;
    this.lastFrameHash = '';
    console.log('[ScreenCapture] 已销毁');
  }

  // ================================================================
  // 内部方法
  // ================================================================

  /** 执行一次截图并通过回调发送 */
  private async captureAndEmit(): Promise<void> {
    try {
      const source = await this.resolveSource();
      if (!source) {
        console.warn('[ScreenCapture] 未找到匹配的截图源，跳过本帧');
        return;
      }

      const frame = this.extractFrame(source);
      if (frame) {
        this.onScreenshot(frame);
      }
    } catch (error) {
      console.error('[ScreenCapture] 截图失败:', error);
    }
  }

  /** 解析目标截图源 */
  private async resolveSource(): Promise<DesktopCapturerSource | null> {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: THUMBNAIL_SIZE,
    });

    if (sources.length === 0) return null;

    // 如果指定了 windowId，按 ID 匹配
    if (this.options.windowId) {
      const matched = sources.find((s) => s.id === this.options.windowId);
      if (matched) return matched;
      console.warn(
        `[ScreenCapture] 未找到 windowId=${this.options.windowId} 的源，回退到首个屏幕源`,
      );
    }

    // 回退策略：优先选屏幕源，否则选第一个
    const screenSource = sources.find((s) => s.id.startsWith('screen:'));
    return screenSource ?? sources[0];
  }

  /** 从 DesktopCapturerSource 提取帧数据 */
  private extractFrame(source: DesktopCapturerSource): ScreenshotFrameData | null {
    const nativeImage = source.thumbnail;
    if (!nativeImage || nativeImage.isEmpty()) {
      console.warn(`[ScreenCapture] source "${source.name}" 的缩略图为空`);
      return null;
    }

    const pngBuffer = nativeImage.toPNG();
    const size = nativeImage.getSize();

    // 复制一份纯 ArrayBuffer（toPNG 底层可能是 SharedArrayBuffer）
    const arrayBuffer = new ArrayBuffer(pngBuffer.byteLength);
    new Uint8Array(arrayBuffer).set(pngBuffer);

    const hasChanged = this.hasFrameChanged(arrayBuffer);

    return {
      imageBuffer: arrayBuffer,
      width: size.width,
      height: size.height,
      timestamp: monotonicTimestamp(),
      sourceId: source.id,
      hasChanged,
    };
  }

  /**
   * 基于采样字节的快速帧比较
   *
   * 对图片数据按固定步长采样，拼接为简化 hash 字符串，
   * 与上一帧 hash 对比以判断画面是否发生变化。
   */
  private hasFrameChanged(imageBuffer: ArrayBuffer): boolean {
    const view = new Uint8Array(imageBuffer);
    const size = view.length;
    if (size === 0) return false;

    // 采样 ~100 个字节 + 数据长度，构造简短 hash
    let hash = size.toString(36);
    const step = Math.max(1, Math.floor(size / 100));
    for (let i = 0; i < size; i += step) {
      hash += view[i].toString(16);
    }

    if (hash === this.lastFrameHash) {
      return false; // 帧未变化
    }

    this.lastFrameHash = hash;
    return true;
  }
}
