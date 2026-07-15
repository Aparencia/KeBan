import { useState, useCallback } from 'react';
import { aiPluginLoader } from '../AIPluginLoader';
import { type AIState, INITIAL_STATE, resolveAIErrorState } from './types';
import type { FeynmanAnswerEvalResult } from '../types';

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
      setState(resolveAIErrorState(error, {
        message: 'AI 评估服务暂时不可用',
        suggestion: '您可以对照标准答案自行检查回答的准确性',
      }));
      throw error;
    }
  }, []);

  return { ...state, evaluateAnswers };
}
