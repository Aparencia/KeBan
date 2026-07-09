import { useState, useCallback } from 'react';
import { aiPluginLoader } from './AIPluginLoader';
import { getLocalFallbackMessage } from './LocalFallback';
import type {
  SummarizeResult, FlashcardResult, EvaluateResult, DurationResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions, DurationHistoryData, DurationOptions,
} from './types';

interface AIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isFallback: boolean;
}

/**
 * AI 摘要 hook
 */
export function useAISummarize() {
  const [state, setState] = useState<AIState<SummarizeResult>>({
    data: null, loading: false, error: null, isFallback: false,
  });

  const summarize = useCallback(async (content: string, options?: SummarizeOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await aiPluginLoader.summarizeNote(content, options);
      setState({ data: result, loading: false, error: null, isFallback: false });
      return result;
    } catch (error: unknown) {
      const fallback = getLocalFallbackMessage('summarize');
      setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true });
    }
  }, []);

  return { ...state, summarize };
}

/**
 * AI 闪卡生成 hook
 */
export function useAIFlashcards() {
  const [state, setState] = useState<AIState<FlashcardResult>>({
    data: null, loading: false, error: null, isFallback: false,
  });

  const generate = useCallback(async (content: string, options?: FlashcardOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await aiPluginLoader.generateFlashcards(content, options);
      setState({ data: result, loading: false, error: null, isFallback: false });
      return result;
    } catch (error: unknown) {
      const fallback = getLocalFallbackMessage('flashcard');
      setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true });
    }
  }, []);

  return { ...state, generate };
}

/**
 * AI 费曼评估 hook
 */
export function useAIEvaluate() {
  const [state, setState] = useState<AIState<EvaluateResult>>({
    data: null, loading: false, error: null, isFallback: false,
  });

  const evaluate = useCallback(async (concept: string, explanation: string, options?: EvaluateOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await aiPluginLoader.evaluateExplanation(concept, explanation, options);
      setState({ data: result, loading: false, error: null, isFallback: false });
      return result;
    } catch (error: unknown) {
      const fallback = getLocalFallbackMessage('evaluate');
      setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true });
    }
  }, []);

  return { ...state, evaluate };
}

/**
 * AI 番茄钟推荐 hook（自动降级到本地引擎）
 */
export function useAIDuration() {
  const [state, setState] = useState<AIState<DurationResult>>({
    data: null, loading: false, error: null, isFallback: false,
  });

  const recommend = useCallback(async (historyData: DurationHistoryData, options?: DurationOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await aiPluginLoader.recommendDuration(historyData, options);
      setState({ data: result, loading: false, error: null, isFallback: result.isLocalFallback });
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : '番茄钟推荐失败');
      setState({ data: null, loading: false, error: msg, isFallback: true });
    }
  }, []);

  return { ...state, recommend };
}
