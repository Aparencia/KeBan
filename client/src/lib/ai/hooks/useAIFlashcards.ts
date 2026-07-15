import { useState, useCallback } from 'react';
import { aiPluginLoader } from '../AIPluginLoader';
import { getLocalFallbackMessage } from '../LocalFallback';
import { soundPlayer } from '@/lib/audio/SoundPlayer';
import { type AIState, INITIAL_STATE, resolveAIErrorState } from './types';
import type { FlashcardResult, FlashcardOptions } from '../types';

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
      soundPlayer.play('ai_analysis_done');
      setState({ data: result, loading: false, error: null, isFallback: false, needsConfig: false });
      return result;
    } catch (error: unknown) {
      setState(resolveAIErrorState(error, getLocalFallbackMessage('flashcard')));
      throw error;
    }
  }, []);

  return { ...state, generate };
}
