/**
 * Electron 主进程入口
 *
 * 创建 BrowserWindow，注册 IPC handler 代理 AI 网关请求。
 */

// 开发时禁用 Electron 安全警告
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// 常量与辅助函数
// ================================================================

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8000';

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
// 创建主窗口
// ================================================================

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '课伴',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

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

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  app.quit();
});
