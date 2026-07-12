/**
 * AI 插件接口 — 定义四个 AI 功能
 */
export interface AIPlugin {
  summarizeNote(noteContent: string, options?: SummarizeOptions): Promise<SummarizeResult>;
  generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult>;
  evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult>;
  recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult>;
  extractScreenContent?(imageBase64: string, language?: string): Promise<VisionExtractResult>;
  tagContent?(content: string): Promise<TagContentResult>;
  optimizeCard?(front: string, back: string): Promise<OptimizeCardResult>;
  sortInspiration?(content: string, existingTags?: Record<string, string>): Promise<SortResult>;
  generateFeynmanQuestions(concept: string, explanation: string): Promise<FeynmanQuestionResult>;
  evaluateFeynmanAnswers(concept: string, questions: string[], answers: string[]): Promise<FeynmanAnswerEvalResult>;
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

// === Feynman Question (AI 反问) ===
export interface FeynmanQuestionItem {
  question: string;
  focus: string;
}

export interface FeynmanQuestionResult {
  questions: FeynmanQuestionItem[];
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

// === Feynman Answer Evaluation (理解度评估) ===
export interface FeynmanAnswerEvalResult {
  understandingScore: number;  // 0-10
  feedback: string;
  strongPoints: string[];
  weakPoints: string[];
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

// === Vision Extract ===
export interface VisionExtractResult {
  text: string;
  formulas: string[];
  diagrams: string[];
  keyPoints: string[];
  confidence: number;
}

// === Tag Content ===
export interface TagContentResult {
  contentNature: 'concept' | 'question' | 'inspiration' | 'todo';
  cognitiveDepth: 'shallow' | 'understanding' | 'application';
  subject: string;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

// === Sort Inspiration ===
export type SortTargetType = 'feynman' | 'flashcard' | 'note' | 'todo';

export interface SortSuggestion {
  type: SortTargetType;
  reason: string;
  confidence: number;
}

export interface SortResult {
  suggestions: SortSuggestion[];
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

// === Optimize Card ===
export interface OptimizeCardResult {
  suggestedFront: string;
  suggestedBack: string;
  improvements: string[];
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

// === Error types ===
export type AIErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'service_unavailable'
  | 'content_filter'
  | 'invalid_response'
  | 'content_too_short'
  | 'no_api_key'
  | 'offline';

export class AIError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}
