/**
 * AI Hook 共享类型与工具函数
 *
 * 所有 useAI* hooks 共用的状态类型、初始状态和错误处理逻辑
 */

import { AIError } from '../types';
import { hasUserKeys } from '../apiKeyManager';

/** AI Hook 统一状态 */
export interface AIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isFallback: boolean;
  /** 当后端 503 且用户未配置 API Key 时为 true，UI 可展示跳转设置页引导 */
  needsConfig: boolean;
}

export const INITIAL_STATE: AIState<never> = {
  data: null, loading: false, error: null, isFallback: false, needsConfig: false,
};

/**
 * 统一处理 service_unavailable 错误：
 * - 用户无自配 Key → 提示前往设置页配置
 * - 用户有自配 Key → 正常网络/服务错误提示
 */
export function handleServiceUnavailable(): { error: string; needsConfig: boolean } {
  if (!hasUserKeys()) {
    return {
      error: '当前还没有配置 API Key 呢，请前往设置页面配置',
      needsConfig: true,
    };
  }
  return {
    error: 'AI 服务暂时不可用，请稍后重试',
    needsConfig: false,
  };
}

/**
 * 统一 AI 错误处理 — 根据错误码设置对应状态
 * @returns 处理后的状态片段，供 setState 使用
 */
export function resolveAIErrorState(
  error: unknown,
  fallbackMessage?: { message: string; suggestion: string },
): Pick<AIState<never>, 'data' | 'loading' | 'error' | 'isFallback' | 'needsConfig'> {
  const aiError = error instanceof AIError ? error : null;

  if (aiError?.code === 'content_too_short') {
    return { data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false };
  }
  if (aiError?.code === 'offline') {
    return { data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false };
  }
  if (aiError?.code === 'timeout') {
    return { data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false };
  }
  if (aiError?.code === 'service_unavailable') {
    const svc = handleServiceUnavailable();
    return { data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig };
  }

  // 通用降级
  if (fallbackMessage) {
    return {
      data: null, loading: false,
      error: fallbackMessage.message + '。' + fallbackMessage.suggestion,
      isFallback: true, needsConfig: false,
    };
  }

  const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'AI 操作失败');
  return { data: null, loading: false, error: msg, isFallback: true, needsConfig: false };
}
