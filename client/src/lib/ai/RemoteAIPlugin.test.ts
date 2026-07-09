import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAiPost } = vi.hoisted(() => ({ mockAiPost: vi.fn() }));
vi.mock('../http/apiClient', () => ({
  aiClient: { post: mockAiPost },
}));

import { RemoteAIPlugin } from './RemoteAIPlugin';
import { AIError } from './types';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RemoteAIPlugin', () => {
  const plugin = new RemoteAIPlugin();

  // ── summarizeNote ──────────────────────────────────────────
  describe('summarizeNote()', () => {
    it('should call /api/v1/ai/summarize with text and options', async () => {
      mockAiPost.mockResolvedValueOnce({ summary: '短摘要', model: 'test', tokens_used: 10, latency_ms: 100 });
      const result = await plugin.summarizeNote('这是笔记内容');
      expect(mockAiPost).toHaveBeenCalledWith('/api/v1/ai/summarize', { text: '这是笔记内容', options: {} });
      expect(result.summary).toBe('短摘要');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should pass options along with text', async () => {
      mockAiPost.mockResolvedValueOnce({ summary: '摘要', model: 'test', tokens_used: 10, latency_ms: 100 });
      await plugin.summarizeNote('内容', { maxLength: 200, language: 'zh' });
      expect(mockAiPost).toHaveBeenCalledWith('/api/v1/ai/summarize', {
        text: '内容',
        options: { max_length: 200, language: 'zh' },
      });
    });
  });

  // ── generateFlashcards ─────────────────────────────────────
  describe('generateFlashcards()', () => {
    it('should call /api/v1/ai/generate-cards with note and options', async () => {
      mockAiPost.mockResolvedValueOnce({ cards: [{ front: 'Q', back: 'A', type: 'basic', confidence: 0.8 }], total_extracted: 1, model: 'test', tokens_used: 10 });
      const result = await plugin.generateFlashcards('笔记');
      expect(mockAiPost).toHaveBeenCalledWith('/api/v1/ai/generate-cards', { note: '笔记', options: {} });
      expect(result.cards).toHaveLength(1);
    });

    it('should pass flashcard options', async () => {
      mockAiPost.mockResolvedValueOnce({ cards: [], total_extracted: 0, model: 'test', tokens_used: 10 });
      await plugin.generateFlashcards('笔记', { count: 5, difficulty: 'hard' });
      expect(mockAiPost).toHaveBeenCalledWith('/api/v1/ai/generate-cards', {
        note: '笔记',
        options: { max_cards: 5, difficulty: 'hard' },
      });
    });
  });

  // ── evaluateExplanation ─────────────────────────────────────
  describe('evaluateExplanation()', () => {
    it('should call /api/v1/ai/evaluate-explanation with concept and explanation', async () => {
      mockAiPost.mockResolvedValueOnce({
        overall_score: 80,
        dimensions: [],
        strengths: [],
        improvements: [],
        encouragement: 'good',
        model: 'test',
        tokens_used: 10,
        latency_ms: 100,
      });
      const result = await plugin.evaluateExplanation('量子力学', '量子力学是研究微观粒子的学科');
      expect(mockAiPost).toHaveBeenCalledWith('/api/v1/ai/evaluate-explanation', {
        concept: '量子力学',
        explanation: '量子力学是研究微观粒子的学科',
      });
      expect(result.overallScore).toBe(80);
    });
  });

  // ── recommendDuration ───────────────────────────────────────
  describe('recommendDuration()', () => {
    it('should call /api/v1/ai/recommend-duration with transformed history', async () => {
      mockAiPost.mockResolvedValueOnce({
        recommended_minutes: 30,
        break_minutes: 5,
        reason: '基于历史数据',
        source: 'ai',
        model: 'test',
        tokens_used: 10,
        latency_ms: 100,
      });
      const history = { sessions: [{ duration: 25, completed: true, date: '2024-01-01' }] };
      const result = await plugin.recommendDuration(history);
      expect(mockAiPost).toHaveBeenCalledWith('/api/v1/ai/recommend-duration', {
        history: [{ duration_minutes: 25, completed: true, subject: '', timestamp: '2024-01-01' }],
      });
      expect(result.recommendedDuration).toBe(30);
      expect(result.isLocalFallback).toBe(false);
    });
  });

  // ── Error handling ─────────────────────────────────────────
  describe('error handling', () => {
    it('should convert timeout error to AIError(timeout)', async () => {
      const timeoutErr = new Error('request timeout exceeded');
      mockAiPost.mockRejectedValue(timeoutErr);
      try {
        await plugin.summarizeNote('x');
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(AIError);
        expect(e.code).toBe('timeout');
        expect(e.retryable).toBe(true);
      }
      mockAiPost.mockReset();
    });

    it('should convert AbortError to AIError(timeout)', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError');
      mockAiPost.mockRejectedValueOnce(abortErr);
      try {
        await plugin.summarizeNote('x');
      } catch (e: any) {
        expect(e).toBeInstanceOf(AIError);
        expect(e.code).toBe('timeout');
      }
    });

    it('should convert 429 error to AIError(rate_limit)', async () => {
      mockAiPost.mockRejectedValueOnce(new Error('HTTP 429'));
      try {
        await plugin.generateFlashcards('x');
      } catch (e: any) {
        expect(e).toBeInstanceOf(AIError);
        expect(e.code).toBe('rate_limit');
        expect(e.retryable).toBe(true);
      }
    });

    it('should convert 503 error to AIError(service_unavailable)', async () => {
      mockAiPost.mockRejectedValueOnce(new Error('HTTP 503'));
      try {
        await plugin.evaluateExplanation('c', 'e');
      } catch (e: any) {
        expect(e).toBeInstanceOf(AIError);
        expect(e.code).toBe('service_unavailable');
        expect(e.retryable).toBe(true);
      }
    });

    it('should convert unknown error to AIError(service_unavailable, retryable=false)', async () => {
      mockAiPost.mockRejectedValueOnce(new Error('something weird'));
      try {
        await plugin.recommendDuration({ sessions: [] });
      } catch (e: any) {
        expect(e).toBeInstanceOf(AIError);
        expect(e.code).toBe('service_unavailable');
        expect(e.retryable).toBe(false);
      }
    });
  });
});
