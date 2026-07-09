import type { AIPlugin, SummarizeResult, FlashcardResult, EvaluateResult, DurationResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions, DurationOptions, DurationHistoryData } from './types';
import { AIError } from './types';
import { apiClient } from '../http/apiClient';

const AI_GATEWAY_URL = import.meta.env.VITE_AI_GATEWAY_URL || 'http://localhost:8000';

/**
 * 远程 AI 插件 — 通过 HTTPS 调用 ai-gateway 服务
 */
export class RemoteAIPlugin implements AIPlugin {
  private timeout: number;

  constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  async summarizeNote(noteContent: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    try {
      const result = await apiClient.post<SummarizeResult>(
        `${AI_GATEWAY_URL}/api/v1/ai/summarize`,
        { content: noteContent, ...options },
      );
      return { ...result, generatedAt: new Date(result.generatedAt || Date.now()) };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    try {
      const result = await apiClient.post<FlashcardResult>(
        `${AI_GATEWAY_URL}/api/v1/ai/generate-cards`,
        { content: noteContent, ...options },
      );
      return { ...result, generatedAt: new Date(result.generatedAt || Date.now()) };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult> {
    try {
      const result = await apiClient.post<EvaluateResult>(
        `${AI_GATEWAY_URL}/api/v1/ai/evaluate-explanation`,
        { concept, explanation, ...options },
      );
      return { ...result, generatedAt: new Date(result.generatedAt || Date.now()) };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult> {
    try {
      const result = await apiClient.post<DurationResult>(
        `${AI_GATEWAY_URL}/api/v1/ai/recommend-duration`,
        { history: historyData, ...options },
      );
      return { ...result, isLocalFallback: false };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): AIError {
    if (error.message?.includes('timeout') || error.name === 'AbortError') {
      return new AIError('AI 服务响应超时，请稍后重试', 'timeout', true);
    }
    if (error.message?.includes('429')) {
      return new AIError('AI 调用次数已达上限，请稍后重试', 'rate_limit', true);
    }
    if (error.message?.includes('503')) {
      return new AIError('AI 服务暂时不可用', 'service_unavailable', true);
    }
    return new AIError(error.message || 'AI 功能暂不可用', 'service_unavailable', false);
  }
}
