/**
 * AI 插件接口 — 定义四个 AI 功能
 */
export interface AIPlugin {
  summarizeNote(noteContent: string, options?: SummarizeOptions): Promise<SummarizeResult>;
  generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult>;
  evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult>;
  recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult>;
}

// === Summarize ===
export interface SummarizeOptions {
  maxLength?: number;
  language?: string;
}

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  generatedAt: Date;
}

// === Flashcards ===
export interface FlashcardOptions {
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

export interface FlashcardResult {
  cards: Flashcard[];
  generatedAt: Date;
}

// === Evaluate (Feynman) ===
export interface EvaluateOptions {
  criteria?: string[];
}

export interface EvaluateDimension {
  name: string;
  score: number;    // 0-100
  feedback: string;
}

export interface EvaluateResult {
  overallScore: number;
  dimensions: EvaluateDimension[];
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
  generatedAt: Date;
}

// === Duration Recommendation ===
export interface DurationHistoryData {
  sessions: Array<{
    duration: number;     // minutes
    completed: boolean;
    date: string;
    subject?: string;
  }>;
  averageFocusTime?: number;
  preferredDuration?: number;
}

export interface DurationOptions {
  minDuration?: number;
  maxDuration?: number;
}

export interface DurationResult {
  recommendedDuration: number; // minutes
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  isLocalFallback: boolean;
}

// === Error types ===
export class AIError extends Error {
  constructor(
    message: string,
    public code: 'timeout' | 'rate_limit' | 'service_unavailable' | 'content_filter' | 'invalid_response',
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}
