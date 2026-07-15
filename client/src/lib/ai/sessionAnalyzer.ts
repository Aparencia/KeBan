/**
 * 智能模式课后分析客户端
 * 将 SessionBundle 发送到多模态分析端点，获取结构化课堂笔记
 */

import { supabase } from '@/lib/auth/supabaseClient';
import { requireGatewayUrl } from '@/lib/ai/config';
import { getActiveUserKey } from '@/lib/ai/apiKeyManager';
import type { SessionBundle } from '@/lib/capture/captureTypes';

// ================================================================
// 分析结果类型
// ================================================================

/** @ai-context 多模态分析接口返回的结构化笔记结果 */
export interface AnalyzeResult {
  content: string;
  keyframesAnalyzed: number;
  modelUsed: string;
}

// ================================================================
// 请求/响应载荷类型（仅内部使用）
// ================================================================

interface AnalyzeRequestPayload {
  keyframes: Array<{
    timestamp: number;
    image_base64: string;
    change_type: string;
  }>;
  audio_segments: Array<{
    timestamp_start: number;
    timestamp_end: number;
    audio_text: null;
  }>;
  duration: number;
  language?: string;
}

interface AnalyzeResponsePayload {
  content: string;
  keyframes_analyzed: number;
  model_used: string;
}

// ================================================================
// 分析函数
// ================================================================

/**
 * 将智能模式采集的 SessionBundle 发送到多模态分析端点
 * @ai-context 调用 POST /api/v1/multimodal/analyze-session，超时 120s
 */
export async function analyzeSession(
  bundle: SessionBundle,
  options?: { language?: string },
): Promise<AnalyzeResult> {
  const gatewayUrl = requireGatewayUrl();

  const payload: AnalyzeRequestPayload = {
    keyframes: bundle.keyframes.map((kf) => ({
      timestamp: kf.timestamp / 1000,  // ms → s
      image_base64: kf.imageBase64,
      change_type: kf.changeType,
    })),
    audio_segments: bundle.audioSegments.map((seg) => ({
      timestamp_start: seg.timestampStart / 1000,  // ms → s
      timestamp_end: seg.timestampEnd / 1000,       // ms → s
      audio_text: null,
    })),
    duration: bundle.duration / 1000,  // ms → s
    ...(options?.language ? { language: options.language } : {}),
  };

  // 构造鉴权 headers，复用项目现有的 supabase + X-User-API-Key 模式
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  const userKey = getActiveUserKey();
  if (userKey) headers.set('X-User-API-Key', userKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(
      `${gatewayUrl}/api/v1/multimodal/analyze-session`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`服务端分析失败 (HTTP ${response.status}): ${body || '未知错误'}`);
    }

    const data = (await response.json()) as AnalyzeResponsePayload;

    return {
      content: data.content,
      keyframesAnalyzed: data.keyframes_analyzed,
      modelUsed: data.model_used,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('分析请求超时（120秒），请检查网络连接后重试');
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error('无法连接至 AI 网关，请检查网关地址和网络状态');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ================================================================
// Path C 视频分析函数
// ================================================================

/**
 * 上传录制视频到多模态分析端点，生成结构化课堂笔记
 * @ai-context Path C 全程录制结束后调用，超时 300s（视频文件较大）
 */
export async function analyzeVideo(
  filePath: string,
  options?: { duration?: number; language?: string },
): Promise<AnalyzeResult> {
  const gatewayUrl = requireGatewayUrl();

  // Electron 渲染进程通过 file:// 协议读取本地视频文件
  const fileResponse = await fetch(`file://${filePath}`);
  const blob = await fileResponse.blob();

  const formData = new FormData();
  formData.append('video_file', blob, filePath.split(/[\\/]/).pop() ?? 'recording.webm');
  if (options?.duration !== undefined) {
    formData.append('duration', String(options.duration));
  }
  if (options?.language) {
    formData.append('language', options.language);
  }

  // 复用项目鉴权模式：supabase session + X-User-API-Key
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers();
  // FormData 自动设置 Content-Type: multipart/form-data; boundary=...
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  const userKey = getActiveUserKey();
  if (userKey) headers.set('X-User-API-Key', userKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(
      `${gatewayUrl}/api/v1/multimodal/analyze-video`,
      {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`视频分析失败 (HTTP ${response.status}): ${body || '未知错误'}`);
    }

    const data = (await response.json()) as AnalyzeResponsePayload;
    return {
      content: data.content,
      keyframesAnalyzed: data.keyframes_analyzed,
      modelUsed: data.model_used,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('视频分析请求超时（300秒），请检查网络连接后重试');
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error('无法连接至 AI 网关，请检查网关地址和网络状态');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
