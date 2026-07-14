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
import { useShallow } from 'zustand/react/shallow';
import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import { audioTracks, loadAudioPreferences, saveAudioPreferences } from '@/lib/audio/audioConfig';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AudioPreferences } from '@/lib/audio/audioConfig';

const WHITE_NOISE_FADE_MS = 1000;
const WHITE_NOISE_FADE_OUT_MS = 1500;
const TIMER_TICK_INTERVAL_MS = 1000;

export default function PomodoroPage() {
  const {
    phase, isRunning, isPaused, remainingSeconds, totalSeconds,
    completedCount, mode, settings, currentGoal, isImmersive,
    start, pause, resume, reset, skip, setMode, setCurrentGoal,
    enterImmersive, exitImmersive, tick,
  } = usePomodoroStore(useShallow(s => s));

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
    src: whiteNoiseTrack.src, volume: audioPrefs.whiteNoiseVolume,
    loop: true, fadeInMs: WHITE_NOISE_FADE_MS, fadeOutMs: WHITE_NOISE_FADE_OUT_MS,
  });

  useEffect(() => {
    if (isRunning && phase === 'work' && audioPrefs.whiteNoiseEnabled) {
      whiteNoisePlayer.play();
    } else {
      whiteNoisePlayer.pause();
    }
  }, [isRunning, phase, audioPrefs.whiteNoiseEnabled]); // eslint-disable-line

  const toggleWhiteNoise = () => {
    const next = { ...audioPrefs, whiteNoiseEnabled: !audioPrefs.whiteNoiseEnabled };
    setAudioPrefs(next); saveAudioPreferences(next);
  };
  const handleWhiteNoiseVolume = (vol: number) => {
    const next = { ...audioPrefs, whiteNoiseVolume: vol };
    setAudioPrefs(next); saveAudioPreferences(next);
    whiteNoisePlayer.setVolume(vol);
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => tick(), TIMER_TICK_INTERVAL_MS);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, tick]);

  useEffect(() => {
    if (isRunning || isPaused) {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      const phaseLabel = phase === 'work' ? '专注' : phase === 'short_break' ? '短休' : '长休';
      document.title = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} - ${phaseLabel} | 深潜`;
    } else {
      document.title = '深潜 - 熵减';
    }
    return () => { document.title = '熵减'; };
  }, [remainingSeconds, phase, isRunning, isPaused]);

  const handleMainButton = () => {
    if (isRunning) pause();
    else if (isPaused) resume();
    else setGoalModalOpen(true);
  };

  const handleGoalSubmit = async (goal: string) => {
    setCurrentGoal(goal);
    setGoalModalOpen(false);
    start();
    enterImmersive();
    if (rememberGoal) {
      try {
        const existing = await db.pomodoroGoals.where('text').equals(goal).first();
        if (existing) {
          await db.pomodoroGoals.update(existing.id, { useCount: existing.useCount + 1, lastUsedAt: new Date() });
        } else {
          await db.pomodoroGoals.add({ id: crypto.randomUUID(), text: goal, useCount: 1, lastUsedAt: new Date() });
        }
      } catch (e) { console.error('[Pomodoro] Failed to save goal:', e); }
    }
  };

  const mainButtonLabel = isRunning ? '暂停' : isPaused ? '继续' : '开始';
  const mainButtonIcon = isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />;
  const prefersReduced = useReducedMotion();

  const immersiveEnter = prefersReduced ? {} : { opacity: 0, scale: 0.9, filter: 'blur(8px)' };
  const immersiveAnimate = { opacity: 1, scale: 1, filter: 'blur(0px)' };
  const immersiveExit = prefersReduced ? {} : { opacity: 0, scale: 0.95, filter: 'blur(4px)' };
  const immersiveTransition = prefersReduced ? { duration: 0 } : { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const };

  return (
    <AnimatePresence mode="wait">
      {isImmersive ? (
        createPortal(
          <motion.div
            key="immersive"
            className="fixed inset-0 z-40 flex flex-col overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1C1B19 0%, #242320 50%, #1C1B19 100%)' }}
            initial={immersiveEnter}
            animate={immersiveAnimate}
            exit={immersiveExit}
            transition={immersiveTransition}
          >
            <div className="pt-6"><SlideToExit onExit={exitImmersive} /></div>
            {currentGoal && (
              <p className="text-center text-[12px] text-white/30 mt-2 truncate px-16">{currentGoal}</p>
            )}
            <div className="flex-1 flex items-center justify-center">
              <ImmersiveTimer />
            </div>
          </motion.div>,
          document.body,
        )
      ) : (
        <motion.div
          key="normal"
          className="flex flex-col items-center min-h-[calc(100vh-12rem)] px-4 py-8 relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* 背景环境光 */}
          <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full kb-ambient-glow"
              style={{ background: `radial-gradient(circle, ${phase === 'work' ? 'rgba(91,138,114,0.06)' : phase === 'short_break' ? 'rgba(123,196,184,0.06)' : 'rgba(107,155,210,0.06)'} 0%, transparent 70%)` }}
            />
          </div>

          {/* Mode tabs — 胶囊切换 */}
          <motion.div
            className="flex items-center gap-0.5 p-1 bg-bg-secondary/80 backdrop-blur-sm rounded-full border border-border/30"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            {([
              { key: 'class' as const, label: '上课模式', sub: `${settings.classDuration}min`, Icon: GraduationCap },
              { key: 'self_study' as const, label: '自习模式', sub: `${settings.workDuration}min`, Icon: BookOpen },
            ]).map(({ key, label, sub, Icon }) => (
              <motion.button
                key={key}
                onClick={() => setMode(key)}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'relative flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-medium transition-all duration-300',
                  mode === key
                    ? 'text-white shadow-[0_2px_12px_rgba(91,138,114,0.3)]'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {mode === key && (
                  <motion.div
                    layoutId="pomo-mode-bg"
                    className="absolute inset-0 rounded-full bg-brand-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                  {label}
                  <span className={cn('text-[10px] opacity-60', mode === key && 'opacity-80')}>· {sub}</span>
                </span>
              </motion.button>
            ))}
          </motion.div>

          {/* 模式提示 */}
          <motion.div
            className="mt-3 flex items-center gap-1.5 text-[11px] text-text-tertiary/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{mode === 'class' ? `课堂 ${settings.classDuration}min · 短休 ${settings.shortBreakDuration}min` : `专注 ${settings.workDuration}min · 连续番茄+长休`}</span>
          </motion.div>

          <div className="flex-1" />

          {/* Timer Ring */}
          <motion.div
            className="my-8 relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }}
          >
            {currentGoal && (
              <p className="text-[12px] text-text-tertiary text-center mb-3 truncate max-w-[280px]">{currentGoal}</p>
            )}
            <TimerRing
              totalSeconds={totalSeconds}
              remainingSeconds={remainingSeconds}
              phase={phase}
              isRunning={isRunning}
            />
          </motion.div>

          {/* Session dots */}
          <motion.div
            className="flex items-center gap-2 mb-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05, type: 'spring', stiffness: 400 }}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-300',
                  i < completedCount
                    ? 'bg-brand-500 shadow-[0_0_8px_rgba(91,138,114,0.4)]'
                    : 'border-2 border-border/40',
                )}
              />
            ))}
            <span className="text-[11px] text-text-tertiary ml-1 font-mono tabular-nums">
              {completedCount}/{settings.longBreakInterval}
            </span>
          </motion.div>

          {/* 白噪音控制 */}
          <motion.div
            className="flex items-center gap-2 mb-8 px-4 py-2 bg-bg-elevated/60 backdrop-blur-sm rounded-full border border-border/30"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleWhiteNoise}
              className={cn(
                'p-1.5 rounded-full transition-all duration-200',
                audioPrefs.whiteNoiseEnabled ? 'text-brand-500' : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              {audioPrefs.whiteNoiseEnabled
                ? <Volume2 className="w-4 h-4" strokeWidth={1.5} />
                : <VolumeX className="w-4 h-4" strokeWidth={1.5} />}
            </motion.button>
            <span className="text-[11px] text-text-tertiary select-none">🎵 {whiteNoiseTrack.nameZh}</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={audioPrefs.whiteNoiseVolume}
              onChange={(e) => handleWhiteNoiseVolume(parseFloat(e.target.value))}
              className="w-16 h-1 accent-brand-500 cursor-pointer"
            />
          </motion.div>

          {/* Controls */}
          <motion.div
            className="flex items-center gap-4 mb-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <motion.button
              whileTap={{ scale: 0.9, rotate: -180 }}
              onClick={reset}
              className="w-10 h-10 rounded-full border border-border/40 flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:border-text-tertiary/50 transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleMainButton}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center',
                'bg-brand-500 text-white',
                'shadow-[0_4px_16px_rgba(91,138,114,0.35)]',
                'hover:shadow-[0_6px_24px_rgba(91,138,114,0.45)]',
                'transition-shadow duration-300',
              )}
            >
              {mainButtonIcon}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9, x: 3 }}
              onClick={skip}
              className="w-10 h-10 rounded-full border border-border/40 flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:border-text-tertiary/50 transition-all duration-200"
            >
              <SkipForward className="w-4 h-4" strokeWidth={1.5} />
            </motion.button>
          </motion.div>

          {/* 沉浸模式入口 */}
          {(isRunning || isPaused) && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => enterImmersive()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-secondary/60 transition-all duration-200 mb-6"
            >
              <Focus className="w-4 h-4" strokeWidth={1.5} />
              进入专注模式
            </motion.button>
          )}

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
