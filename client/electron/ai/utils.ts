/**
 * AI 网关公共工具函数
 *
 * 提取自 aiHandlers.ts，包含所有 AI handler 共用的
 * POST 请求辅助函数、网关地址管理和功能注册表接口定义。
 */

import { logger } from '../logger.js';

// ================================================================
// 常量
// ================================================================

const DEFAULT_GATEWAY_URL = '';

/** 获取 AI 网关地址，优先读取环境变量 VITE_AI_GATEWAY_URL */
export function gatewayUrl(): string {
  return process.env.VITE_AI_GATEWAY_URL || DEFAULT_GATEWAY_URL;
}

// ================================================================
// AI 功能注册表接口定义
// ================================================================

/**
 * AI 功能定义接口
 *
 * 每个 AI handler 文件导出一个符合此接口的对象，
 * 由 ai/index.ts 统一收集并注册到 IPC 系统。
 */
export interface AIFeatureDef {
  /** 功能唯一标识符，对应 IPC channel 名称 */
  id: string;
  /** 功能显示名称 */
  name: string;
  /** 功能版本 */
  version: string;
  /** 注册函数，由注册引擎调用 */
  register: () => void;
}

// ================================================================
// 通用 POST 请求辅助函数
// ================================================================

/**
 * 通用 POST 请求辅助函数：
 * 1. 将请求体序列化为 JSON
 * 2. 如有 authToken，添加 Authorization header
 * 3. HTTP 失败时抛出包含状态码和详情的错误字符串
 * 4. 返回解析后的 JSON 响应
 */
export async function postJson<TReq, TRes>(
  apiPath: string,
  body: TReq,
  authToken?: string,
): Promise<{ data: TRes; requestId: string | undefined }> {
  const base = gatewayUrl();
  if (!base) {
    throw new Error('[KeBan] AI Gateway URL not configured. Please set VITE_AI_GATEWAY_URL in environment');
  }
  const url = `${base}${apiPath}`;
  const startTime = Date.now();
  logger.info(`[AI-Gateway] [${new Date().toISOString()}] POST ${url}`);

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
      logger.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} TIMEOUT after ${elapsed}ms`);
      throw new Error('Request timeout after 60s');
    }
    logger.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} FAILED after ${elapsed}ms: ${networkError.message}`);
    throw new Error(`Network error: ${networkError.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const elapsed = Date.now() - startTime;
  const requestId = resp.headers.get('ai-gateway-request-id') ?? undefined;

  if (!resp.ok) {
    const detail = await resp.text().catch(() => 'unknown error');
    logger.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} -> ${resp.status} (${elapsed}ms): ${detail}`);
    throw new Error(`HTTP ${resp.status}: ${detail}`);
  }

  logger.info(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} -> ${resp.status} (${elapsed}ms)`);

  try {
    const data = (await resp.json()) as TRes;
    return { data, requestId };
  } catch (e) {
    logger.error(`[AI-Gateway] Response parse error for ${url}: ${e}`);
    throw new Error(`Response parse error: ${e}`);
  }
}
