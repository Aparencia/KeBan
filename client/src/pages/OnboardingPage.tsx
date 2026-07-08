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
  SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui';

/* ---- 常量 ---- */
const modules = [
  { icon: Timer, name: '番茄钟', desc: '专注学习，科学管理时间', accent: 'text-pomodoro', bg: 'bg-pomodoro/10' },
  { icon: FileText, name: '智能笔记', desc: '结构化记录，知识不遗漏', accent: 'text-note', bg: 'bg-note/10' },
  { icon: Layers, name: '闪卡', desc: '间隔重复，高效记忆', accent: 'text-flashcard', bg: 'bg-flashcard/10' },
  { icon: Lightbulb, name: '费曼学习', desc: '以教代学，深度理解', accent: 'text-feynman', bg: 'bg-feynman/10' },
];

/* ---- 步骤指示器 ---- */
function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`
            rounded-kb-full transition-all duration-kb-normal ease-kb-default
            ${i === current ? 'w-6 h-2 bg-brand-600' : 'w-2 h-2 bg-border-strong'}
          `}
        />
      ))}
    </div>
  );
}

/* ---- Step 1: 欢迎 ---- */
function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
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

/* ---- Step 2: 模块介绍 ---- */
function StepModules({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-kb-xl px-kb-lg w-full max-w-2xl">
      <div className="text-center flex flex-col gap-kb-xs">
        <h2 className="text-h1 font-bold text-text-primary">四大核心模块</h2>
        <p className="text-b2 text-text-secondary">科学方法，高效学习</p>
      </div>

      <div className="grid grid-cols-2 gap-kb-md w-full">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.name}
              className="
                bg-bg-elevated rounded-kb-xl shadow-kb-md
                border border-border/40
                p-kb-md flex flex-col gap-kb-sm
                transition-all duration-kb-normal ease-kb-default
                hover:-translate-y-0.5 hover:shadow-kb-lg
              "
            >
              <div className={`p-2.5 rounded-kb-lg ${mod.bg} w-fit`}>
                <Icon className={`w-icon-md h-icon-md ${mod.accent}`} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-b2 font-semibold text-text-primary">{mod.name}</span>
                <span className="text-b3 text-text-secondary leading-snug">{mod.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        size="lg"
        variant="primary"
        className="w-full max-w-xs"
        iconRight={<ArrowRight className="w-icon-sm h-icon-sm" />}
        onClick={onNext}
      >
        下一步
      </Button>
    </div>
  );
}

/* ---- Step 3: 准备就绪 ---- */
function StepReady({ onStart }: { onStart: () => void }) {
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

      <Button
        size="lg"
        variant="primary"
        className="w-full max-w-xs"
        iconRight={<ArrowRight className="w-icon-sm h-icon-sm" />}
        onClick={onStart}
      >
        开始学习
      </Button>
    </div>
  );
}

/* ---- 主页面 ---- */
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const finish = useCallback(() => {
    localStorage.setItem('kb-onboarding-done', 'true');
    navigate('/', { replace: true });
  }, [navigate]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 2)), []);

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
          {step === 0 && <StepWelcome onNext={next} onSkip={finish} />}
          {step === 1 && <StepModules onNext={next} />}
          {step === 2 && <StepReady onStart={finish} />}
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="pb-kb-md">
        <StepDots current={step} />
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
