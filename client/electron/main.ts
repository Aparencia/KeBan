/**
 * Electron 主进程入口
 *
 * 创建 BrowserWindow，注册 IPC handler 代理 AI 网关请求。
 */

// 开发时禁用 Electron 安全警告
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

import { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage } from 'electron';
import { ScreenCapture } from './screenCapture.js';
import type { ScreenCaptureOptions, ScreenshotFrameData } from './screenCapture.js';
import { AudioCapture, listAudioSources } from './audioCapture.js';
import type { AudioCaptureOptions, AudioChunk } from './audioCapture.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

const DEFAULT_GATEWAY_URL = 'http://121.40.24.242:8000';

/** 获取 AI 网关地址，优先读取环境变量 VITE_AI_GATEWAY_URL */
function gatewayUrl(): string {
  return process.env.VITE_AI_GATEWAY_URL || DEFAULT_GATEWAY_URL;
}

/**
 * 通用 POST 请求辅助函数：
 * 1. 将请求体序列化为 JSON
 * 2. 如有 authToken，添加 Authorization header
 * 3. HTTP 失败时抛出包含状态码和详情的错误字符串
 * 4. 返回解析后的 JSON 响应
 */
async function postJson<TReq, TRes>(
  apiPath: string,
  body: TReq,
  authToken?: string,
): Promise<{ data: TRes; requestId: string | undefined }> {
  const url = `${gatewayUrl()}${apiPath}`;
  const startTime = Date.now();
  console.log(`[AI-Gateway] [${new Date().toISOString()}] POST ${url}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (networkError: any) {
    const elapsed = Date.now() - startTime;
    if (networkError.name === 'AbortError') {
      console.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} TIMEOUT after ${elapsed}ms`);
      throw new Error('Request timeout after 60s');
    }
    console.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} FAILED after ${elapsed}ms: ${networkError.message}`);
    throw new Error(`Network error: ${networkError.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const elapsed = Date.now() - startTime;
  const requestId = resp.headers.get('ai-gateway-request-id') ?? undefined;

  if (!resp.ok) {
    const detail = await resp.text().catch(() => 'unknown error');
    console.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} -> ${resp.status} (${elapsed}ms): ${detail}`);
    throw new Error(`HTTP ${resp.status}: ${detail}`);
  }

  console.log(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} -> ${resp.status} (${elapsed}ms)`);

  try {
    const data = (await resp.json()) as TRes;
    return { data, requestId };
  } catch (e) {
    console.error(`[AI-Gateway] Response parse error for ${url}: ${e}`);
    throw new Error(`Response parse error: ${e}`);
  }
}

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
// IPC Handler — 四个 AI 网关代理命令
// ================================================================

/**
 * ai_summarize — POST /api/v1/ai/summarize
 * 接收前端 camelCase 参数，转为后端 snake_case 请求体，
 * 再将后端 snake_case 响应转回 camelCase。
 */
ipcMain.handle(
  'ai_summarize',
  async (
    _event,
    args: {
      text: string;
      maxLength?: number;
      style?: string;
      language?: string;
      authToken?: string;
    },
  ) => {
    // 构建 snake_case 请求体
    const startMs = Date.now();
    console.log(`[IPC] ai_summarize start, text_length=${args.text.length}`);
    const reqBody = {
      text: args.text,
      options: {
        ...(args.maxLength !== undefined && { max_length: args.maxLength }),
        ...(args.style !== undefined && { style: args.style }),
        ...(args.language !== undefined && { language: args.language }),
      },
    };

    interface SummarizeResp {
      summary: string;
      model: string;
      tokens_used: number;
      latency_ms: number;
    }

    const { data: resp, requestId } = await postJson<typeof reqBody, SummarizeResp>(
      '/api/v1/ai/summarize',
      reqBody,
      args.authToken,
    );

    // 转为 camelCase 返回
    console.log(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
    console.log(`[IPC] ai_summarize end, model=${resp.model}`);
    return {
      summary: resp.summary,
      model: resp.model,
      tokensUsed: resp.tokens_used,
      latencyMs: resp.latency_ms,
      requestId,
    };
  },
);

/**
 * ai_generate_cards — POST /api/v1/ai/generate-cards
 */
ipcMain.handle(
  'ai_generate_cards',
  async (
    _event,
    args: {
      note: string;
      maxCards?: number;
      difficulty?: string;
      cardType?: string;
      authToken?: string;
    },
  ) => {
    const startMs = Date.now();
    console.log(`[IPC] ai_generate_cards start, note_length=${args.note.length}`);
    const reqBody = {
      note: args.note,
      options: {
        ...(args.maxCards !== undefined && { max_cards: args.maxCards }),
        ...(args.difficulty !== undefined && { difficulty: args.difficulty }),
        ...(args.cardType !== undefined && { card_type: args.cardType }),
      },
    };

    interface CardResp {
      front: string;
      back: string;
      type: string;
      confidence: number;
    }
    interface CardGenResp {
      cards: CardResp[];
      total_extracted: number;
      model: string;
      tokens_used: number;
    }

    const { data: resp, requestId } = await postJson<typeof reqBody, CardGenResp>(
      '/api/v1/ai/generate-cards',
      reqBody,
      args.authToken,
    );

    console.log(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
    console.log(`[IPC] ai_generate_cards end, cards_count=${resp.cards.length}`);
    return {
      cards: resp.cards.map((c) => ({
        front: c.front,
        back: c.back,
        type: c.type,
        confidence: c.confidence,
      })),
      totalExtracted: resp.total_extracted,
      model: resp.model,
      tokensUsed: resp.tokens_used,
      requestId,
    };
  },
);

/**
 * ai_evaluate — POST /api/v1/ai/evaluate-explanation
 */
ipcMain.handle(
  'ai_evaluate',
  async (
    _event,
    args: {
      concept: string;
      explanation: string;
      authToken?: string;
    },
  ) => {
    const startMs = Date.now();
    console.log(`[IPC] ai_evaluate start, concept_length=${args.concept.length}`);
    const reqBody = {
      concept: args.concept,
      explanation: args.explanation,
    };

    interface DimensionResp {
      dimension: string;
      score: number;
      feedback: string;
    }
    interface EvaluateResp {
      overall_score: number;
      dimensions: DimensionResp[];
      strengths: string[];
      improvements: string[];
      encouragement: string;
      model: string;
      tokens_used: number;
      latency_ms: number;
    }

    const { data: resp, requestId } = await postJson<typeof reqBody, EvaluateResp>(
      '/api/v1/ai/evaluate-explanation',
      reqBody,
      args.authToken,
    );

    console.log(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
    console.log(`[IPC] ai_evaluate end, overall_score=${resp.overall_score}`);
    return {
      overallScore: resp.overall_score,
      dimensions: resp.dimensions.map((d) => ({
        name: d.dimension, // 后端字段 dimension → 前端 name
        score: d.score,
        feedback: d.feedback,
      })),
      strengths: resp.strengths,
      improvements: resp.improvements,
      encouragement: resp.encouragement,
      model: resp.model,
      tokensUsed: resp.tokens_used,
      latencyMs: resp.latency_ms,
      requestId,
    };
  },
);

/**
 * ai_recommend_duration — POST /api/v1/ai/recommend-duration
 */
ipcMain.handle(
  'ai_recommend_duration',
  async (
    _event,
    args: {
      history: Array<{
        durationMinutes: number;
        completed: boolean;
        subject: string;
        timestamp: string;
      }>;
      authToken?: string;
    },
  ) => {
    // 前端 camelCase → 后端 snake_case
    const startMs = Date.now();
    console.log(`[IPC] ai_recommend_duration start, sessions_count=${args.history.length}`);
    const reqBody = {
      history: args.history.map((h) => ({
        duration_minutes: h.durationMinutes,
        completed: h.completed,
        subject: h.subject,
        timestamp: h.timestamp,
      })),
    };

    interface RecommendResp {
      recommended_minutes: number;
      break_minutes: number;
      reason: string;
      source: string;
      model: string;
      tokens_used: number;
      latency_ms: number;
    }

    const { data: resp, requestId } = await postJson<typeof reqBody, RecommendResp>(
      '/api/v1/ai/recommend-duration',
      reqBody,
      args.authToken,
    );

    console.log(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
    console.log(`[IPC] ai_recommend_duration end, recommended_minutes=${resp.recommended_minutes}`);
    return {
      recommendedMinutes: resp.recommended_minutes,
      breakMinutes: resp.break_minutes,
      reason: resp.reason,
      source: resp.source,
      isLocalFallback: resp.source === 'local_rule',
      model: resp.model,
      tokensUsed: resp.tokens_used,
      latencyMs: resp.latency_ms,
      requestId,
    };
  },
);

/**
 * ai_feynman_question — POST /api/v1/ai/feynman-question
 */
ipcMain.handle(
  'ai_feynman_question',
  async (
    _event,
    args: {
      concept: string;
      explanation: string;
      authToken?: string;
    },
  ) => {
    const startMs = Date.now();
    console.log(`[IPC] ai_feynman_question start, concept_length=${args.concept.length}`);
    const reqBody = {
      concept: args.concept,
      explanation: args.explanation,
    };

    interface FeynmanQuestionResp {
      questions: Array<{ question: string; focus: string }>;
      model: string;
      tokens_used: number;
      latency_ms: number;
    }

    const { data: resp, requestId } = await postJson<typeof reqBody, FeynmanQuestionResp>(
      '/api/v1/ai/feynman-question',
      reqBody,
      args.authToken,
    );

    console.log(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
    console.log(`[IPC] ai_feynman_question end, question_count=${resp.questions.length}`);
    return {
      questions: resp.questions.map((q) => ({
        question: q.question,
        focus: q.focus,
      })),
      model: resp.model,
      tokensUsed: resp.tokens_used,
      latencyMs: resp.latency_ms,
      requestId,
    };
  },
);

/**
 * ai_feynman_evaluate_answers — POST /api/v1/ai/feynman-evaluate-answers
 */
ipcMain.handle(
  'ai_feynman_evaluate_answers',
  async (
    _event,
    args: {
      concept: string;
      questions: string[];
      answers: string[];
      authToken?: string;
    },
  ) => {
    const startMs = Date.now();
    console.log(`[IPC] ai_feynman_evaluate_answers start, concept_length=${args.concept.length}`);
    const reqBody = {
      concept: args.concept,
      questions: args.questions,
      answers: args.answers,
    };

    interface FeynmanAnswerEvalResp {
      understanding_score: number;
      feedback: string;
      strong_points: string[];
      weak_points: string[];
      model: string;
      tokens_used: number;
      latency_ms: number;
    }

    const { data: resp, requestId } = await postJson<typeof reqBody, FeynmanAnswerEvalResp>(
      '/api/v1/ai/feynman-evaluate-answers',
      reqBody,
      args.authToken,
    );

    console.log(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
    console.log(`[IPC] ai_feynman_evaluate_answers end, score=${resp.understanding_score}`);
    return {
      understandingScore: resp.understanding_score,
      feedback: resp.feedback,
      strongPoints: resp.strong_points,
      weakPoints: resp.weak_points,
      model: resp.model,
      tokensUsed: resp.tokens_used,
      latencyMs: resp.latency_ms,
      requestId,
    };
  },
);

// ================================================================
// IPC Handler — 屏幕截图采集
// ================================================================

/** 当前活跃的截图采集实例 */
let activeCapture: ScreenCapture | null = null;

/**
 * screen_capture_start — 开始截图采集
 * 创建 ScreenCapture 实例，定时截图并通过 IPC 推送到渲染进程
 */
ipcMain.handle(
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
    console.log('[IPC] screen_capture_start 已启动');
    return { success: true };
  },
);

/**
 * screen_capture_stop — 停止截图采集
 */
ipcMain.handle('screen_capture_stop', async () => {
  if (activeCapture) {
    activeCapture.dispose();
    activeCapture = null;
    console.log('[IPC] screen_capture_stop 已停止');
  }
  return { success: true };
});

/**
 * screen_list_windows — 获取可捕获窗口列表
 * 返回窗口 id、标题、缩略图（base64）
 */
ipcMain.handle('screen_list_windows', async () => {
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
    console.error('[IPC] screen_list_windows failed:', err);
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
ipcMain.handle('audio_list_sources', async () => {
  try {
    return await listAudioSources();
  } catch (err) {
    console.error('[IPC] audio_list_sources failed:', err);
    return [];
  }
});

/**
 * audio_capture_start — 开始系统音频捕获
 * 创建 AudioCapture 实例，通过 desktopCapturer 发现音频源，
 * 委托渲染进程执行 getUserMedia 采集
 */
ipcMain.handle(
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
      console.log('[IPC] audio_capture_start 已启动');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] audio_capture_start failed:', message);
      activeAudioCapture.dispose();
      activeAudioCapture = null;
      return { success: false, error: message };
    }
  },
);

/**
 * audio_capture_stop — 停止系统音频捕获
 */
ipcMain.handle('audio_capture_stop', async () => {
  if (activeAudioCapture) {
    activeAudioCapture.dispose();
    activeAudioCapture = null;
    console.log('[IPC] audio_capture_stop 已停止');
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
// 应用生命周期
// ================================================================

app.whenReady().then(() => {
  createWindow();

  // macOS 下点击 dock 图标时重新创建窗口
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
  // 清理托盘
  if (tray) {
    tray.destroy();
    tray = null;
  }
  mainWindow = null;
  app.quit();
});
