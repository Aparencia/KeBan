import { useNavigate } from 'react-router-dom';
import {
  X, Sparkles, CheckCircle2, Circle, MessageCircle, Check,
} from 'lucide-react';
import { AIThinkingIndicator } from '@/components/ui/AIThinkingIndicator';
import { Button, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── AI 评估结果 props ──
interface AIEvalSectionProps {
  show: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  needsConfig: boolean;
  data: {
    overallScore: number;
    dimensions: { name: string; score: number }[];
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  } | null;
}

// ── AI 反问区域 props ──
interface AIQuestionSectionProps {
  isCompleted: boolean;
  showQuestionPanel: boolean;
  onTogglePanel: () => void;
  onStartQuestion: () => void;
  loading: boolean;
  error: string | null;
  needsConfig: boolean;
  questionData: {
    questions: { question: string; focus?: string }[];
  } | null;
  localAnswers: string[];
  onAnswerChange: (index: number, value: string) => void;
  onSubmitAnswers: () => void;
  answerEvalLoading: boolean;
  answerEvalError: string | null;
  answerEvalNeedsConfig: boolean;
  answerEvalData: {
    understandingScore: number;
    feedback: string;
    strongPoints: string[];
    weakPoints: string[];
  } | null;
}

export interface AIEvaluationPanelProps {
  eval: AIEvalSectionProps;
  question: AIQuestionSectionProps;
}

/**
 * AI 评估结果展示与追问交互面板。
 * 包含 AI 讲解评估结果 + AI 反问答题区域。
 */
export function AIEvaluationPanel({ eval: evalProps, question: qProps }: AIEvaluationPanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <>
      {/* ── AI 评估结果 ── */}
      {evalProps.show && (
        <div className={cn(
          'p-kb-md rounded-kb-lg',
          'bg-brand-600/5 border border-brand-500/20',
        )}>
          <div className="flex items-center justify-between mb-kb-md">
            <h3 className="text-b1 font-semibold text-text-primary flex items-center gap-2">
              <Sparkles className="w-icon-sm h-icon-sm text-brand-500" strokeWidth={1.5} />
              AI 评估结果
            </h3>
            <button
              onClick={evalProps.onClose}
              className="p-1 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {evalProps.loading && (
            <div className="flex items-center gap-2 text-b2 text-text-secondary py-4">
              <AIThinkingIndicator size={4} gap={3} />
              正在评估你的讲解…
            </div>
          )}

          {evalProps.error && !evalProps.loading && (
            <div className="p-3 rounded-kb-md bg-semantic-error/10 border border-semantic-error/20 text-b2 text-semantic-error">
              {evalProps.error}
              {evalProps.needsConfig && (
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-2 block text-b3 underline hover:no-underline"
                >
                  前往设置页配置 API Key
                </button>
              )}
            </div>
          )}

          {evalProps.data && !evalProps.loading && (
            <div className="flex flex-col gap-kb-md kb-ai-result-enter">
              {/* Overall score */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-16 h-16 rounded-kb-full flex items-center justify-center flex-shrink-0',
                  'bg-brand-600/10 text-brand-600 text-h2 font-bold',
                )}>
                  {evalProps.data.overallScore}
                </div>
                <div>
                  <p className="text-b1 font-semibold text-text-primary">综合评分</p>
                  <p className="text-b2 text-text-tertiary">
                    {evalProps.data.overallScore >= 80 ? '讲得非常出色！' : evalProps.data.overallScore >= 60 ? '掌握较好，还有提升空间' : '建议继续深化理解'}
                  </p>
                </div>
              </div>

              {/* Dimensions */}
              {evalProps.data.dimensions.length > 0 && (
                <div>
                  <p className="text-b3 font-medium text-text-tertiary uppercase tracking-wide mb-2">维度评分</p>
                  <div className="flex flex-col gap-2">
                    {evalProps.data.dimensions.map((dim, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-b2 text-text-secondary w-20 flex-shrink-0">{dim.name}</span>
                        <div className="flex-1 h-2 bg-bg-tertiary rounded-kb-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-kb-full transition-all duration-500"
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                        <span className="text-b3 text-text-tertiary w-8 text-right">{dim.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {evalProps.data.strengths.length > 0 && (
                <div>
                  <p className="text-b3 font-medium text-semantic-success uppercase tracking-wide mb-1">优势</p>
                  <ul className="flex flex-col gap-1">
                    {evalProps.data.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-b2 text-text-secondary">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-semantic-success flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {evalProps.data.weaknesses.length > 0 && (
                <div>
                  <p className="text-b3 font-medium text-semantic-error uppercase tracking-wide mb-1">待改进</p>
                  <ul className="flex flex-col gap-1">
                    {evalProps.data.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-b2 text-text-secondary">
                        <Circle className="w-3.5 h-3.5 mt-0.5 text-rose-400 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {evalProps.data.suggestions.length > 0 && (
                <div>
                  <p className="text-b3 font-medium text-text-tertiary uppercase tracking-wide mb-1">建议</p>
                  <ul className="flex flex-col gap-1">
                    {evalProps.data.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-b2 text-text-secondary">
                        <span className="mt-1 w-1.5 h-1.5 rounded-kb-full bg-brand-500 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AI 反问区域 ── */}
      {qProps.isCompleted && (
        <div className={cn(
          'p-kb-md rounded-kb-lg',
          'bg-feynman/5 border border-feynman/20',
        )}>
          <div className="flex items-center justify-between mb-kb-md">
            <h3 className="text-b1 font-semibold text-text-primary flex items-center gap-2">
              <MessageCircle className="w-icon-sm h-icon-sm text-feynman" strokeWidth={1.5} />
              AI 反问
            </h3>
            {qProps.showQuestionPanel && (
              <button
                onClick={qProps.onTogglePanel}
                className="p-1 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {!qProps.showQuestionPanel && (
            <button
              onClick={qProps.onStartQuestion}
              disabled={qProps.loading}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-kb-md text-b2 font-medium',
                'bg-feynman text-text-inverse',
                'hover:bg-feynman/90 active:scale-[0.98] transition-all duration-kb-fast',
                qProps.loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {qProps.loading ? (
                <AIThinkingIndicator size={4} gap={3} />
              ) : (
                <MessageCircle className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
              )}
              让 AI 反问
            </button>
          )}

          {qProps.showQuestionPanel && (
            <div className="flex flex-col gap-kb-md">
              {/* 加载中 */}
              {qProps.loading && (
                <div className="flex items-center gap-2 text-b2 text-text-secondary py-4">
                  <AIThinkingIndicator size={4} gap={3} />
                  AI 正在思考追问...
                </div>
              )}

              {/* 错误 */}
              {qProps.error && !qProps.loading && (
                <div className="p-3 rounded-kb-md bg-semantic-error/10 border border-semantic-error/20 text-b2 text-semantic-error">
                  {qProps.error}
                  {qProps.needsConfig && (
                    <button
                      onClick={() => navigate('/settings')}
                      className="mt-2 block text-b3 underline hover:no-underline"
                    >
                      前往设置页配置 API Key
                    </button>
                  )}
                </div>
              )}

              {/* 追问卡片 */}
              {qProps.questionData && !qProps.loading && (
                <div className="kb-ai-result-enter flex flex-col gap-kb-sm">
                  <p className="text-b2 text-text-tertiary">
                    以下是 AI 小白的追问，请试着回答：
                  </p>
                  {qProps.questionData.questions.map((q, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-kb-md rounded-kb-md',
                        'bg-bg-elevated border border-border/40',
                      )}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-kb-full bg-feynman/10 text-feynman text-c1 font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-b2 text-text-primary font-medium">{q.question}</p>
                          {q.focus && (
                            <p className="text-c1 text-text-tertiary mt-0.5">聚焦：{q.focus}</p>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={qProps.localAnswers[i] || ''}
                        onChange={(e) => qProps.onAnswerChange(i, e.target.value)}
                        placeholder="在这里写下你的回答..."
                        className={cn(
                          'w-full mt-2 p-2.5 rounded-kb-md',
                          'bg-bg-secondary border border-border/40',
                          'text-b2 text-text-primary placeholder:text-text-tertiary/60',
                          'outline-none resize-none min-h-[80px]',
                          'focus:border-feynman/50 focus:ring-1 focus:ring-feynman/20 transition-all duration-kb-fast',
                        )}
                      />
                    </div>
                  ))}

                  {/* 提交回答按钮 */}
                  {qProps.questionData.questions.length > 0 && (
                    <Button
                      variant="ai"
                      size="md"
                      className="w-full"
                      onClick={qProps.onSubmitAnswers}
                      disabled={qProps.answerEvalLoading || qProps.localAnswers.every(a => !a?.trim())}
                      loading={qProps.answerEvalLoading}
                      icon={!qProps.answerEvalLoading ? <Check className="w-4 h-4" strokeWidth={2} /> : undefined}
                    >
                      提交回答，查看理解度评估
                    </Button>
                  )}

                  {/* 评估结果 */}
                  {qProps.answerEvalLoading && (
                    <div className="flex items-center gap-2 text-b2 text-text-secondary py-4">
                      <AIThinkingIndicator size={4} gap={3} />
                      正在评估你的回答...
                    </div>
                  )}

                  {qProps.answerEvalError && !qProps.answerEvalLoading && (
                    <div className="p-3 rounded-kb-md bg-semantic-error/10 border border-semantic-error/20 text-b2 text-semantic-error">
                      {qProps.answerEvalError}
                      {qProps.answerEvalNeedsConfig && (
                        <button
                          onClick={() => navigate('/settings')}
                          className="mt-2 block text-b3 underline hover:no-underline"
                        >
                          前往设置页配置 API Key
                        </button>
                      )}
                    </div>
                  )}

                  {qProps.answerEvalData && !qProps.answerEvalLoading && (
                    <div className={cn(
                      'p-kb-md rounded-kb-md kb-ai-result-enter',
                      'bg-brand-600/5 border border-brand-500/20',
                    )}>
                      <h4 className="text-b1 font-semibold text-text-primary mb-kb-md flex items-center gap-2">
                        <Sparkles className="w-icon-sm h-icon-sm text-brand-500" strokeWidth={1.5} />
                        理解度评估
                      </h4>

                      {/* 分数 */}
                      <div className="flex items-center gap-3 mb-kb-md">
                        <div className={cn(
                          'w-14 h-14 rounded-kb-full flex items-center justify-center flex-shrink-0',
                          'bg-feynman/10 text-feynman text-h2 font-bold',
                        )}>
                          {qProps.answerEvalData.understandingScore}
                        </div>
                        <div>
                          <p className="text-b1 font-semibold text-text-primary">理解度评分</p>
                          <p className="text-b2 text-text-tertiary">
                            {qProps.answerEvalData.understandingScore >= 8
                              ? '深入理解，能举一反三！'
                              : qProps.answerEvalData.understandingScore >= 6
                                ? '理解较好，还有深化空间'
                                : '建议继续学习，加深理解'}
                          </p>
                        </div>
                      </div>

                      {/* 反馈 */}
                      {qProps.answerEvalData.feedback && (
                        <p className="text-b2 text-text-secondary mb-kb-md leading-relaxed">
                          {qProps.answerEvalData.feedback}
                        </p>
                      )}

                      {/* 强项 */}
                      {qProps.answerEvalData.strongPoints.length > 0 && (
                        <div className="mb-2">
                          <p className="text-b3 font-medium text-semantic-success uppercase tracking-wide mb-1">强项</p>
                          <ul className="flex flex-col gap-1">
                            {qProps.answerEvalData.strongPoints.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-b2 text-text-secondary">
                                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-semantic-success flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 薄弱点 */}
                      {qProps.answerEvalData.weakPoints.length > 0 && (
                        <div>
                          <p className="text-b3 font-medium text-semantic-error uppercase tracking-wide mb-1">待加强</p>
                          <ul className="flex flex-col gap-1">
                            {qProps.answerEvalData.weakPoints.map((w, i) => (
                              <li key={i} className="flex items-start gap-2 text-b2 text-text-secondary">
                                <Circle className="w-3.5 h-3.5 mt-0.5 text-rose-400 flex-shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
