import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, GraduationCap, BookOpen, Clock, Volume2, VolumeX, Focus } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { db } from '@/lib/storage';
import TimerRing from '../components/TimerRing';
import GoalInput from '../components/GoalInput';
import ImmersiveTimer from '../components/ImmersiveTimer';
import SlideToExit from '../components/SlideToExit';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import { audioTracks, loadAudioPreferences, saveAudioPreferences } from '@/lib/audio/audioConfig';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AudioPreferences } from '@/lib/audio/audioConfig';

export default function PomodoroPage() {
  const {
    phase,
    isRunning,
    isPaused,
    remainingSeconds,
    totalSeconds,
    completedCount,
    mode,
    settings,
    currentGoal,
    isImmersive,
    start,
    pause,
    resume,
    reset,
    skip,
    setMode,
    setCurrentGoal,
    enterImmersive,
    exitImmersive,
    tick,
  } = usePomodoroStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [rememberGoal, setRememberGoal] = useState(false);

  // ── 白噪音 ──
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>(() => loadAudioPreferences());

  const whiteNoiseTrack = useMemo(
    () => audioTracks.find((t) => t.id === audioPrefs.whiteNoiseTrackId) ?? audioTracks[0],
    [audioPrefs.whiteNoiseTrackId],
  );

  const whiteNoisePlayer = useAudioPlayer({
    src: whiteNoiseTrack.src,
    volume: audioPrefs.whiteNoiseVolume,
    loop: true,
    fadeInMs: 1000,
    fadeOutMs: 1500,
  });

  // 工作阶段且白噪音开启时自动播放
  useEffect(() => {
    if (isRunning && phase === 'work' && audioPrefs.whiteNoiseEnabled) {
      whiteNoisePlayer.play();
    } else {
      whiteNoisePlayer.pause();
    }
  }, [isRunning, phase, audioPrefs.whiteNoiseEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleWhiteNoise = () => {
    const next = { ...audioPrefs, whiteNoiseEnabled: !audioPrefs.whiteNoiseEnabled };
    setAudioPrefs(next);
    saveAudioPreferences(next);
  };

  const handleWhiteNoiseVolume = (vol: number) => {
    const next = { ...audioPrefs, whiteNoiseVolume: vol };
    setAudioPrefs(next);
    saveAudioPreferences(next);
    whiteNoisePlayer.setVolume(vol);
  };

  // Timer interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, tick]);

  // Update document title
  useEffect(() => {
    if (isRunning || isPaused) {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      const phaseLabel =
        phase === 'work' ? '专注' : phase === 'short_break' ? '短休' : '长休';
      document.title = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} - ${phaseLabel} | 番茄钟`;
    } else {
      document.title = '番茄钟 - 课伴';
    }
    return () => {
      document.title = '课伴 KeBan';
    };
  }, [remainingSeconds, phase, isRunning, isPaused]);

  const handleMainButton = () => {
    if (isRunning) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      // 弹出目标输入框
      setGoalModalOpen(true);
    }
  };

  const handleGoalSubmit = async (goal: string) => {
    setCurrentGoal(goal);
    setGoalModalOpen(false);
    start();
    enterImmersive();

    // 若启用了记住目标，保存到 Dexie
    if (rememberGoal) {
      try {
        const existing = await db.pomodoroGoals.where('text').equals(goal).first();
        if (existing) {
          await db.pomodoroGoals.update(existing.id, {
            useCount: existing.useCount + 1,
            lastUsedAt: new Date(),
          });
        } else {
          await db.pomodoroGoals.add({
            id: crypto.randomUUID(),
            text: goal,
            useCount: 1,
            lastUsedAt: new Date(),
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console -- 保存目标失败错误记录
        console.error('[Pomodoro] Failed to save goal:', e);
      }
    }
  };

  const mainButtonLabel = isRunning ? '暂停' : isPaused ? '继续' : '开始';
  const mainButtonIcon = isRunning ? (
    <Pause className="w-icon-md h-icon-md" />
  ) : (
    <Play className="w-icon-md h-icon-md" />
  );

  // ── 减弱动效偏好 ──
  const prefersReduced = useReducedMotion();

  // ── 过渡动画配置 ──
  const immersiveEnter = prefersReduced
    ? {}
    : { opacity: 0, scale: 0.9 };
  const immersiveAnimate = { opacity: 1, scale: 1 };
  const immersiveExit = prefersReduced
    ? {}
    : { opacity: 0, scale: 0.95 };
  const immersiveTransition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.4, 0, 0.2, 1] };

  const normalEnter = prefersReduced
    ? {}
    : { opacity: 0 };
  const normalAnimate = { opacity: 1 };
  const normalExit = prefersReduced
    ? {}
    : { opacity: 0 };
  const normalTransition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.4, 0, 0.2, 1] };

  return (
    <AnimatePresence mode="wait">
      {isImmersive ? (
        /* ── 沉浸模式全屏覆盖（Portal 到 body，避免祖先 transform 破坏 fixed 定位） ── */
        createPortal(
          <motion.div
            key="immersive"
            className="fixed inset-0 z-40 flex flex-col overflow-hidden border-none outline-none ring-0 shadow-none"
            style={{ background: '#1A1D23' }}
            initial={immersiveEnter}
            animate={immersiveAnimate}
            exit={immersiveExit}
            transition={immersiveTransition}
          >
            {/* 顶部滑动退出条 */}
            <div className="pt-kb-lg">
              <SlideToExit onExit={exitImmersive} />
            </div>

            {/* 当前目标文字 */}
            {currentGoal && (
              <p className="text-center text-b3 text-text-tertiary/60 mt-kb-sm truncate px-kb-xl">
                {currentGoal}
              </p>
            )}

            {/* 圆环居中 */}
            <div className="flex-1 flex items-center justify-center">
              <ImmersiveTimer />
            </div>
          </motion.div>,
          document.body,
        )
      ) : (
        /* ── 普通视图 ── */
        <motion.div
          key="normal"
          className="flex flex-col items-center min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-4rem)] px-kb-md py-kb-lg"
          initial={normalEnter}
          animate={normalAnimate}
          exit={normalExit}
          transition={normalTransition}
        >
      {/* Mode tabs */}
      <div className="flex items-center gap-kb-xs p-1 bg-bg-secondary rounded-kb-full border border-border/40">
        <button
          onClick={() => setMode('class')}
          className={cn(
            'flex items-center gap-kb-xs px-4 py-2 rounded-kb-full text-b2 font-medium',
            'transition-all duration-kb-fast ease-kb-default',
            'hover:scale-[1.02] active:scale-[0.98]',
            mode === 'class'
              ? 'bg-brand-600 text-white shadow-kb-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <GraduationCap className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          上课模式
        </button>
        <button
          onClick={() => setMode('self_study')}
          className={cn(
            'flex items-center gap-kb-xs px-4 py-2 rounded-kb-full text-b2 font-medium',
            'transition-all duration-kb-fast ease-kb-default',
            'hover:scale-[1.02] active:scale-[0.98]',
            mode === 'self_study'
              ? 'bg-brand-600 text-white shadow-kb-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <BookOpen className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          自习模式
        </button>
      </div>

      {/* 模式提示标签 */}
      <div className="mt-kb-md flex items-center gap-1.5 text-c1 text-text-tertiary">
        {mode === 'class' ? (
          <>
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>课堂时长 {settings.classDuration}min · 课间短休 {settings.shortBreakDuration}min</span>
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>专注 {settings.workDuration}min · 多番茄连续，支持长休息</span>
          </>
        )}
      </div>

      {/* Spacer to push ring to center */}
      <div className="flex-1" />

      {/* Timer Ring */}
      <div className="my-kb-xl">
        {currentGoal && (
          <p className="text-sm text-text-tertiary text-center mb-2 truncate">{currentGoal}</p>
        )}
        <TimerRing
          totalSeconds={totalSeconds}
          remainingSeconds={remainingSeconds}
          phase={phase}
          isRunning={isRunning}
        />
      </div>

      {/* Completed count indicators */}
      <div className="flex items-center gap-2 mb-kb-xl">
        {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2.5 h-2.5 rounded-kb-full transition-all duration-kb-normal',
              i < completedCount
                ? 'bg-pomodoro shadow-[0_0_6px_rgba(244,63,94,0.4)]'
                : 'border-2 border-border/50',
            )}
          />
        ))}
        <span className="text-c1 text-text-tertiary ml-1">
          {completedCount}/{settings.longBreakInterval}
        </span>
      </div>

      {/* 白噪音控制区 */}
      <div className="flex items-center gap-kb-sm mb-kb-xl px-kb-md py-2 bg-bg-secondary/60 rounded-kb-full border border-border/30">
        <button
          onClick={toggleWhiteNoise}
          className={cn(
            'p-1.5 rounded-kb-full transition-colors duration-kb-fast',
            audioPrefs.whiteNoiseEnabled ? 'text-brand-500' : 'text-text-tertiary hover:text-text-secondary',
          )}
          title={audioPrefs.whiteNoiseEnabled ? '关闭白噪音' : '开启白噪音'}
        >
          {audioPrefs.whiteNoiseEnabled
            ? <Volume2 className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
            : <VolumeX className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
        </button>
        <span className="text-c1 text-text-tertiary select-none">🎵 {whiteNoiseTrack.nameZh}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={audioPrefs.whiteNoiseVolume}
          onChange={(e) => handleWhiteNoiseVolume(parseFloat(e.target.value))}
          className="w-16 h-1 accent-brand-500 cursor-pointer"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-kb-md mb-kb-2xl">
        <Button
          variant="ghost"
          size="md"
          onClick={reset}
          icon={<RotateCcw className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="text-text-secondary"
        >
          重置
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={handleMainButton}
          icon={mainButtonIcon}
          className="px-8 min-w-[140px]"
        >
          {mainButtonLabel}
        </Button>

        <Button
          variant="ghost"
          size="md"
          onClick={skip}
          icon={<SkipForward className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          iconRight={undefined}
          className="text-text-secondary"
        >
          跳过
        </Button>
      </div>

      {/* 沉浸模式入口：计时器运行中或暂停时均可进入 */}
      {(isRunning || isPaused) && (
        <button
          onClick={() => enterImmersive()}
          className={cn(
            'flex items-center gap-kb-xs px-4 py-2 rounded-kb-full text-b2 font-medium',
            'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary/80',
            'transition-all duration-kb-fast ease-kb-default',
            'mb-kb-lg',
          )}
        >
          <Focus className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          进入专注模式
        </button>
      )}

      {/* Goal Input Modal */}
      <GoalInput
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onSubmit={handleGoalSubmit}
        rememberGoal={rememberGoal}
        onRememberChange={setRememberGoal}
      />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
