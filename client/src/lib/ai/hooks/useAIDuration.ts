import { useState, useCallback } from 'react';
import { aiPluginLoader } from '../AIPluginLoader';
import { type AIState, INITIAL_STATE, resolveAIErrorState } from './types';
import type { DurationResult, DurationHistoryData, DurationOptions } from '../types';

/**
 * AI 深潜推荐 hook（自动降级到本地引擎）
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
      const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : '深潜推荐失败');
      setState({ data: null, loading: false, error: msg, isFallback: true, needsConfig: false });
    }
  }, []);

  return { ...state, recommend };
}
