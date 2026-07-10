import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Timer,
  FileText,
  Layers,
  Lightbulb,
  Rocket,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Play,
  Coffee,
  RotateCcw,
  Sparkles,
  Brain,
  CheckCircle2,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/* ================================================================
 *  Types
 * ================================================================ */

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: string;
  bg: string;
  ringColor: string;
  flowItems: FlowItem[];
}

interface FlowItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
}

/* ================================================================
 *  Constants — 4 核心模块
 * ================================================================ */

const featureSteps: OnboardingStep[] = [
  {
    id: 'pomodoro',
    title: '番茄钟',
    subtitle: '专注计时',
    description: '科学管理时间，高效专注每一刻。设定时间 → 开始专注 → 短暂休息 → 循环往复。',
    icon: Timer,
    accent: 'text-pomodoro',
    bg: 'bg-pomodoro/10',
    ringColor: 'ring-pomodoro/20',
    flowItems: [
      { icon: Timer, label: '设定时间' },
      { icon: Play, label: '开始专注' },
      { icon: Coffee, label: '休息放松' },
      { icon: RotateCcw, label: '循环往复' },
    ],
  },
  {
    id: 'notes',
    title: '智能笔记',
    subtitle: '结构化记录',
    description: '使用富文本编辑器创建笔记，借助 AI 一键生成摘要和闪卡，知识不再遗漏。',
    icon: FileText,
    accent: 'text-note',
    bg: 'bg-note/10',
    ringColor: 'ring-note/20',
    flowItems: [
      { icon: FileText, label: '创建笔记' },
      { icon: Sparkles, label: 'AI 摘要' },
      { icon: Layers, label: '生成闪卡' },
      { icon: CheckCircle2, label: '知识沉淀' },
    ],
  },
  {
    id: 'flashcards',
    title: '闪卡复习',
    subtitle: '间隔重复',
    description: '基于 SM-2 算法的间隔复习系统，创建牌组和卡片，科学规划复习节奏。',
    icon: Layers,
    accent: 'text-flashcard',
    bg: 'bg-flashcard/10',
    ringColor: 'ring-flashcard/20',
    flowItems: [
      { icon: Layers, label: '创建牌组' },
      { icon: FileText, label: '添加卡片' },
      { icon: Brain, label: 'SM-2 复习' },
      { icon: CheckCircle2, label: '巩固记忆' },
    ],
  },
  {
    id: 'feynman',
    title: '费曼学习法',
    subtitle: '以教代学',
    description: '输入一个概念，用通俗语言解释它，AI 帮你评估理解深度，发现知识盲区。',
    icon: Lightbulb,
    accent: 'text-feynman',
    bg: 'bg-feynman/10',
    ringColor: 'ring-feynman/20',
    flowItems: [
      { icon: Lightbulb, label: '输入概念' },
      { icon: MessageSquare, label: '通俗解释' },
      { icon: Eye, label: 'AI 评估' },
      { icon: Brain, label: '深度理解' },
    ],
  },
];

/** Total steps: Welcome(0) + 4 features(1-4) + Ready(5) */
const TOTAL_STEPS = 2 + featureSteps.length; // 6
const LAST_INDEX = TOTAL_STEPS - 1; // 5

/* ================================================================
 *  Step Dots — 进度指示器
 * ================================================================ */

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'rounded-kb-full transition-all duration-kb-normal ease-kb-default',
            i === current
              ? 'w-6 h-2 bg-brand-600'
              : i < current
                ? 'w-2 h-2 bg-brand-400'
                : 'w-2 h-2 bg-border-strong',
          )}
        />
      ))}
    </div>
  );
}

/* ================================================================
 *  Step 0: Welcome
 * ================================================================ */

function StepWelcome({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-kb-xl text-center px-kb-lg">
      {/* Logo */}
      <div className="flex items-center gap-kb-sm">
        <div className="p-3 rounded-kb-xl bg-brand-600/10">
          <BookOpen className="w-icon-xl h-icon-xl text-brand-600" strokeWidth={1.5} />
        </div>
      </div>

      {/* 品牌名 */}
      <h1 className="text-d1 font-bold text-brand-600 tracking-tight">课伴</h1>

      {/* 文案 */}
      <div className="flex flex-col gap-kb-xs max-w-sm">
        <h2 className="text-d2 font-bold text-text-primary">欢迎使用课伴</h2>
        <p className="text-b1 text-text-secondary">你的本地优先智能学习助手</p>
      </div>

      {/* 操作 */}
      <div className="flex flex-col items-center gap-kb-md w-full max-w-xs">
        <Button
          size="lg"
          variant="primary"
          className="w-full"
          iconRight={<ArrowRight className="w-icon-sm h-icon-sm" />}
          onClick={onNext}
        >
          开始了解
        </Button>

        <button
          onClick={onSkip}
          className="flex items-center gap-1 text-b2 text-text-tertiary hover:text-text-secondary transition-colors duration-kb-fast"
        >
          <SkipForward className="w-icon-xs h-icon-xs" strokeWidth={1.5} />
          跳过引导
        </button>
      </div>
    </div>
  );
}

/* ================================================================
 *  Step 1-4: Feature Demo
 * ================================================================ */

function StepFeature({
  step,
  index,
  total,
  onNext,
  onPrev,
}: {
  step: OnboardingStep;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const Icon = step.icon;
  // index is used for step numbering display
  const isLast = index === total - 1;

  return (
    <div className="flex flex-col items-center gap-kb-lg px-kb-lg w-full max-w-lg">
      {/* 步骤编号 */}
      <span className={cn('text-c1 font-medium tracking-wide', step.accent)}>
        {index + 1} / {total}
      </span>

      {/* 图标 */}
      <div
        className={cn(
          'p-4 rounded-kb-xl ring-2 transition-all duration-kb-normal',
          step.bg,
          step.ringColor,
        )}
      >
        <Icon className={cn('w-icon-xl h-icon-xl', step.accent)} strokeWidth={1.5} />
      </div>

      {/* 标题 */}
      <div className="flex flex-col gap-kb-xs text-center">
        <h2 className="text-h1 font-bold text-text-primary">{step.title}</h2>
        <p className={cn('text-b2 font-medium', step.accent)}>{step.subtitle}</p>
      </div>

      {/* 描述 */}
      <p className="text-b1 text-text-secondary text-center max-w-sm leading-relaxed">
        {step.description}
      </p>

      {/* 流程演示 */}
      <div className="flex items-center gap-1 sm:gap-2 w-full justify-center flex-wrap">
        {step.flowItems.map((item, i) => {
          const ItemIcon = item.icon;
          return (
            <div key={i} className="flex items-center gap-1">
              <div
                className={cn(
                  'flex flex-col items-center gap-1 px-kb-sm py-kb-xs rounded-kb-lg',
                  step.bg,
                  'transition-all duration-kb-normal',
                )}
              >
                <ItemIcon className={cn('w-icon-sm h-icon-sm', step.accent)} strokeWidth={1.5} />
                <span className="text-c2 text-text-secondary whitespace-nowrap">{item.label}</span>
              </div>
              {i < step.flowItems.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-text-tertiary shrink-0" strokeWidth={1.5} />
              )}
            </div>
          );
        })}
      </div>

      {/* 导航按钮 */}
      <div className="flex items-center gap-kb-sm w-full max-w-xs mt-kb-sm">
        <Button size="lg" variant="secondary" className="flex-1" onClick={onPrev}>
          <span className="flex items-center gap-1">
            <ArrowLeft className="w-icon-sm h-icon-sm" />
            上一步
          </span>
        </Button>
        <Button
          size="lg"
          variant="primary"
          className="flex-1"
          iconRight={<ArrowRight className="w-icon-sm h-icon-sm" />}
          onClick={onNext}
        >
          {isLast ? '下一步' : '下一步'}
        </Button>
      </div>
    </div>
  );
}

/* ================================================================
 *  Step 5: Ready
 * ================================================================ */

function StepReady({ onStart, onPrev }: { onStart: () => void; onPrev: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-kb-xl text-center px-kb-lg">
      {/* 大图标 */}
      <div className="p-4 rounded-kb-xl bg-brand-600/10">
        <Rocket className="w-icon-xl h-icon-xl text-brand-600" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-kb-xs max-w-sm">
        <h2 className="text-d2 font-bold text-text-primary">准备就绪！</h2>
        <p className="text-b1 text-text-secondary">所有数据保存在本地，随时可用</p>
      </div>

      <div className="flex items-center gap-kb-sm w-full max-w-xs">
        <Button size="lg" variant="secondary" className="flex-1" onClick={onPrev}>
          <span className="flex items-center gap-1">
            <ArrowLeft className="w-icon-sm h-icon-sm" />
            上一步
          </span>
        </Button>
        <Button
          size="lg"
          variant="primary"
          className="flex-1"
          iconRight={<ArrowRight className="w-icon-sm h-icon-sm" />}
          onClick={onStart}
        >
          开始使用
        </Button>
      </div>
    </div>
  );
}

/* ================================================================
 *  Main Page
 * ================================================================ */

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const finish = useCallback(() => {
    localStorage.setItem('kb-onboarding-done', 'true');
    navigate('/', { replace: true });
  }, [navigate]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, LAST_INDEX)), []);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const renderStep = () => {
    if (step === 0) {
      return <StepWelcome onNext={next} onSkip={finish} />;
    }

    if (step >= 1 && step <= featureSteps.length) {
      const featureIndex = step - 1;
      return (
        <StepFeature
          step={featureSteps[featureIndex]}
          index={featureIndex}
          total={featureSteps.length}
          onNext={next}
          onPrev={prev}
        />
      );
    }

    // Final step
    return <StepReady onStart={finish} onPrev={prev} />;
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-between py-kb-2xl overflow-hidden">
      {/* 动画容器 */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div
          key={step}
          className="w-full flex justify-center"
          style={{
            animation: 'kb-slide-in 250ms ease-in-out both',
          }}
        >
          {renderStep()}
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="pb-kb-md">
        <StepDots current={step} total={TOTAL_STEPS} />
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes kb-slide-in {
          from {
            opacity: 0;
            transform: translateX(32px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
