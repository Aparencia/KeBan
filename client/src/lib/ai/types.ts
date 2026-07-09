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
  style?: 'bullet' | 'paragraph' | 'outline';
  language?: string;
}

export interface SummarizeResult {
  summary: string;
  keyPoints?: string[];
  generatedAt: Date;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

// === Flashcards ===
export interface FlashcardOptions {
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cardType?: 'question_answer' | 'fill_blank' | 'true_false' | 'mixed';
}

export interface Flashcard {
  front: string;
  back: string;
  hint?: string;
  type?: string;
  confidence?: number;
}

export interface FlashcardResult {
  cards: Flashcard[];
  totalExtracted?: number;
  generatedAt: Date;
  model?: string;
  tokensUsed?: number;
}

// === Evaluate (Feynman) ===
export interface EvaluateOptions {
  criteria?: string[];
}

export interface EvaluateDimension {
  name: string;
  score: number;    // 0-10
  feedback: string;
}

export interface EvaluateResult {
  overallScore: number;
  dimensions: EvaluateDimension[];
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
  encouragement?: string;
  generatedAt: Date;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
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
  breakMinutes?: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  source?: 'ai' | 'local_rule' | string;
  isLocalFallback: boolean;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
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
