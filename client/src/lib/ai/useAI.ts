import { useState, useCallback } from 'react';
import { aiPluginLoader } from './AIPluginLoader';
import { getLocalFallbackMessage } from './LocalFallback';
import { AIError } from './types';
import { hasUserKeys } from './apiKeyManager';
import type {
  SummarizeResult, FlashcardResult, EvaluateResult, DurationResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions, DurationHistoryData, DurationOptions,
  VisionExtractResult, OptimizeCardResult,
  FeynmanQuestionResult, FeynmanAnswerEvalResult,
} from './types';

interface AIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isFallback: boolean;
  /** 当后端 503 且用户未配置 API Key 时为 true，UI 可展示跳转设置页引导 */
  needsConfig: boolean;
}

const INITIAL_STATE: AIState<never> = {
  data: null, loading: false, error: null, isFallback: false, needsConfig: false,
};

/**
 * 统一处理 service_unavailable 错误：
 * - 用户无自配 Key → 提示前往设置页配置
 * - 用户有自配 Key → 正常网络/服务错误提示
 */
function handleServiceUnavailable(): { error: string; needsConfig: boolean } {
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
 * AI 摘要 hook
 */
export function useAISummarize() {
  const [state, setState] = useState<AIState<SummarizeResult>>({
    ...INITIAL_STATE,
  });

  const summarize = useCallback(async (content: string, options?: SummarizeOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.summarizeNote(content, options);
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'content_too_short') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const fallback = getLocalFallbackMessage('summarize');
        setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true, needsConfig: false });
      }
    }
  }, []);

  return { ...state, summarize };
}

/**
 * AI 闪卡生成 hook
 */
export function useAIFlashcards() {
  const [state, setState] = useState<AIState<FlashcardResult>>({
    ...INITIAL_STATE,
  });

  const generate = useCallback(async (content: string, options?: FlashcardOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.generateFlashcards(content, options);
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'content_too_short') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const fallback = getLocalFallbackMessage('flashcard');
        setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true, needsConfig: false });
      }
    }
  }, []);

  return { ...state, generate };
}

/**
 * AI 费曼评估 hook
 */
export function useAIEvaluate() {
  const [state, setState] = useState<AIState<EvaluateResult>>({
    ...INITIAL_STATE,
  });

  const evaluate = useCallback(async (concept: string, explanation: string, options?: EvaluateOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.evaluateExplanation(concept, explanation, options);
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'content_too_short') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const fallback = getLocalFallbackMessage('evaluate');
        setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true, needsConfig: false });
      }
    }
  }, []);

  return { ...state, evaluate };
}

/**
 * AI 番茄钟推荐 hook（自动降级到本地引擎）
 */
export function useAIDuration() {
  const [state, setState] = useState<AIState<DurationResult>>({
    ...INITIAL_STATE,
  });

  const recommend = useCallback(async (historyData: DurationHistoryData, options?: DurationOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.recommendDuration(historyData, options);
      setState({ data: result, loading: false, error: null, isFallback: result.isLocalFallback, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'content_too_short') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : '番茄钟推荐失败');
        setState({ data: null, loading: false, error: msg, isFallback: true, needsConfig: false });
      }
    }
  }, []);

  return { ...state, recommend };
}

/**
 * AI 内容打标 hook
 */
export function useAITagContent() {
  const [state, setState] = useState<AIState<{ contentNature: string; cognitiveDepth: string; subject: string }>>({
    ...INITIAL_STATE,
  });

  const tagContent = useCallback(async (content: string) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.tagContent(content);
      const mapped = {
        contentNature: result.contentNature,
        cognitiveDepth: result.cognitiveDepth,
        subject: result.subject,
      };
      setState({ data: mapped, loading: false, error: null, isFallback: false, needsConfig: false });
      return mapped;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const msg = error instanceof Error ? error.message : '内容打标失败';
        setState({ data: null, loading: false, error: msg, isFallback: true, needsConfig: false });
      }
      return null;
    }
  }, []);

  return { ...state, tagContent };
}

/**
 * AI 视觉提取 hook
 */
export function useVisionExtract() {
  const [data, setData] = useState<VisionExtractResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);

  const extract = useCallback(async (imageBase64: string, language = 'zh') => {
    setLoading(true);
    setError(null);
    setNeedsConfig(false);
    try {
      const result = await aiPluginLoader.extractScreenContent(imageBase64, language);
      setData(result);
      return result;
    } catch (err) {
      const aiError = err instanceof AIError ? err : null;
      if (aiError?.code === 'service_unavailable' && !hasUserKeys()) {
        setError('当前还没有配置 API Key 呢，请前往设置页面配置');
        setNeedsConfig(true);
      } else {
        const msg = err instanceof Error ? err.message : '视觉提取失败';
        setError(msg);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { extract, data, loading, error, needsConfig };
}

/**
 * AI 闪卡优化 hook
 */
export function useAIOptimizeCard() {
  const [state, setState] = useState<AIState<OptimizeCardResult>>({
    ...INITIAL_STATE,
  });

  const optimize = useCallback(async (front: string, back: string) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.optimizeCard(front, back);
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'content_too_short') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const fallback = getLocalFallbackMessage('optimize_card');
        setState({ data: null, loading: false, error: fallback.message + '。' + fallback.suggestion, isFallback: true, needsConfig: false });
      }
    }
  }, []);

  return { ...state, optimize };
}

/**
 * AI 费曼反问 hook — 生成追问
 */
export function useAIFeynmanQuestion() {
  const [state, setState] = useState<AIState<FeynmanQuestionResult>>({
    ...INITIAL_STATE,
  });

  const generateQuestions = useCallback(async (concept: string, explanation: string) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.generateFeynmanQuestions(concept, explanation);
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'content_too_short') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const msg = error instanceof Error ? error.message : 'AI 追问生成失败';
        setState({ data: null, loading: false, error: msg, isFallback: true, needsConfig: false });
      }
      return null;
    }
  }, []);

  return { ...state, generateQuestions };
}

/**
 * AI 费曼回答评估 hook — 评估理解度
 */
export function useAIFeynmanEvaluateAnswers() {
  const [state, setState] = useState<AIState<FeynmanAnswerEvalResult>>({
    ...INITIAL_STATE,
  });

  const evaluateAnswers = useCallback(async (
    concept: string,
    questions: string[],
    answers: string[],
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null, needsConfig: false }));
    try {
      const result = await aiPluginLoader.evaluateFeynmanAnswers(concept, questions, answers);
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      const aiError = error instanceof AIError ? error : null;
      if (aiError?.code === 'offline') {
        setState({ data: null, loading: false, error: aiError.message, isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'timeout') {
        setState({ data: null, loading: false, error: 'AI 服务响应超时，请稍后重试', isFallback: false, needsConfig: false });
      } else if (aiError?.code === 'service_unavailable') {
        const svc = handleServiceUnavailable();
        setState({ data: null, loading: false, error: svc.error, isFallback: false, needsConfig: svc.needsConfig });
      } else {
        const msg = error instanceof Error ? error.message : 'AI 评估失败';
        setState({ data: null, loading: false, error: msg, isFallback: true, needsConfig: false });
      }
      return null;
    }
  }, []);

  return { ...state, evaluateAnswers };
}
