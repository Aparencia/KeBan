import { create } from 'zustand';
import { loadSettings, saveSettings, recordSession, playCompletionSound, sendNotification } from './usePomodoroPersistence';
import { soundPlayer } from '@/lib/audio/SoundPlayer';

type Phase = 'work' | 'short_break' | 'long_break';
type Mode = 'class' | 'self_study';

interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  classDuration: number;
}

interface PomodoroState {
  phase: Phase;
  isRunning: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  completedCount: number;
  mode: Mode;
  settings: PomodoroSettings;
  /** 当前工作会话开始时间戳（ms），用于计算 actualDuration */
  sessionStartTime: number | null;
  /** 当前番茄目标文字 */
  currentGoal: string | null;
  /** 是否处于沉浸专注模式 */
  isImmersive: boolean;
  /** 退出沉浸后标记，用于 resume 时自动重入 */
  wasImmersive: boolean;

  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (mode: Mode) => void;
  setCurrentGoal: (goal: string | null) => void;
  enterImmersive: () => void;
  exitImmersive: () => void;
  tick: () => void;
  updateSettings: (settings: Partial<PomodoroSettings>) => void;
  initialize: () => Promise<void>;
}

const getPhaseDuration = (phase: Phase, settings: PomodoroSettings, mode?: Mode): number => {
  switch (phase) {
    case 'work':
      return (mode === 'class' ? settings.classDuration : settings.workDuration) * 60;
    case 'short_break':
      return settings.shortBreakDuration * 60;
    case 'long_break':
      return settings.longBreakDuration * 60;
  }
};

const getNextPhase = (
  currentPhase: Phase,
  completedCount: number,
  longBreakInterval: number,
  mode?: Mode,
): Phase => {
  if (currentPhase === 'work') {
    // 上课模式始终短休，不进入长休
    if (mode === 'class') return 'short_break';
    return (completedCount + 1) % longBreakInterval === 0
      ? 'long_break'
      : 'short_break';
  }
  return 'work';
};

export const usePomodoroStore = create<PomodoroState>((set, get) => {
  const defaultSettings: PomodoroSettings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStartBreak: true,
    autoStartWork: false,
    soundEnabled: true,
    notificationEnabled: false,
    classDuration: 45,
  };

  return {
    phase: 'work',
    isRunning: false,
    isPaused: false,
    remainingSeconds: defaultSettings.workDuration * 60,
    totalSeconds: defaultSettings.workDuration * 60,
    completedCount: 0,
    mode: 'self_study',
    settings: defaultSettings,
    sessionStartTime: null,
    currentGoal: null,
    isImmersive: false,
    wasImmersive: false,

    initialize: async () => {
      const saved = await loadSettings();
      if (saved) {
        // 兼容旧数据：若缺少 classDuration，补上默认值
        const merged = { ...defaultSettings, ...saved };
        const phase = get().phase;
        const mode = get().mode;
        const duration = getPhaseDuration(phase, merged, mode);
        set({
          settings: merged,
          remainingSeconds: get().isRunning || get().isPaused ? get().remainingSeconds : duration,
          totalSeconds: get().isRunning || get().isPaused ? get().totalSeconds : duration,
        });
        // 如果启用了通知，主动请求权限
        if (merged.notificationEnabled && 'Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    },

    start: () => {
      set({ isRunning: true, isPaused: false, sessionStartTime: Date.now() });
      soundPlayer.play('pomodoro_start');
    },

    pause: () => {
      set({ isRunning: false, isPaused: true });
      soundPlayer.play('pomodoro_pause');
    },

    resume: () => {
      const { sessionStartTime, wasImmersive } = get();
      set({
        isRunning: true,
        isPaused: false,
        // 如果 sessionStartTime 为空（重置后），重新记录
        sessionStartTime: sessionStartTime ?? Date.now(),
        // 若上次是从沉浸模式退出的，自动重新进入沉浸
        isImmersive: wasImmersive ? true : get().isImmersive,
        wasImmersive: false,
      });
    },

    reset: () => {
      const { phase, settings, mode } = get();
      const duration = getPhaseDuration(phase, settings, mode);
      set({
        remainingSeconds: duration,
        totalSeconds: duration,
        isRunning: false,
        isPaused: false,
        sessionStartTime: null,
        wasImmersive: false,
      });
    },

    skip: () => {
      const { phase, completedCount, settings, mode } = get();
      const newCount = phase === 'long_break' ? 0 : (phase === 'work' ? completedCount + 1 : completedCount);
      const nextPhase = getNextPhase(phase, completedCount, settings.longBreakInterval, mode);
      const duration = getPhaseDuration(nextPhase, settings, mode);
      set({
        phase: nextPhase,
        remainingSeconds: duration,
        totalSeconds: duration,
        completedCount: newCount,
        isRunning: false,
        isPaused: false,
      });
    },

    setMode: (mode) => {
      const { settings, phase, isRunning, isPaused } = get();
      set({ mode });
      // 切换模式后，若计时器未运行，重置当前阶段时长
      if (!isRunning && !isPaused) {
        const duration = getPhaseDuration(phase, settings, mode);
        set({ remainingSeconds: duration, totalSeconds: duration });
      }
    },

    setCurrentGoal: (goal) => set({ currentGoal: goal }),

    enterImmersive: () => set({ isImmersive: true }),
    exitImmersive: () => {
      const { isRunning } = get();
      // 退出沉浸时自动暂停计时器（不等于结束专注）
      if (isRunning) {
        soundPlayer.play('pomodoro_pause');
      }
      set({ isImmersive: false, wasImmersive: true, isRunning: false, isPaused: true });
    },

    tick: () => {
      const { remainingSeconds, isRunning, phase, completedCount, settings, mode } = get();
      if (!isRunning) return;

      if (remainingSeconds <= 1) {
        // Phase completed
        const wasRunning = isRunning;
        const newCount = phase === 'long_break' ? 0 : (phase === 'work' ? completedCount + 1 : completedCount);
        const nextPhase = getNextPhase(phase, completedCount, settings.longBreakInterval, mode);
        const duration = getPhaseDuration(nextPhase, settings, mode);

        // Determine auto-start behavior
        let shouldAutoStart = false;
        if (nextPhase !== 'work' && settings.autoStartBreak) {
          shouldAutoStart = true;
        } else if (nextPhase === 'work' && settings.autoStartWork) {
          shouldAutoStart = true;
        }
        // Breaks always auto-start if timer was running
        if (nextPhase !== 'work' && wasRunning) {
          shouldAutoStart = true;
        }

        // 记录完成的番茄会话
        if (phase === 'work') {
          const { sessionStartTime: sst } = get();
          const workMinutes = mode === 'class' ? settings.classDuration : settings.workDuration;
          const actualDuration = sst
            ? Math.round((Date.now() - sst) / 1000)
            : workMinutes * 60;
          recordSession({
            mode: get().mode,
            duration: workMinutes * 60,
            actualDuration,
            completedAt: new Date(),
            interrupted: false,
            goal: get().currentGoal ?? undefined,
          }).then(() => {
            // 触发成就检查（动态 import 避免循环依赖）
            import('@/lib/achievements/evaluator').then(({ checkAchievements }) => {
              checkAchievements({ type: 'pomodoro_completed' }).then((unlocked) => {
                unlocked.forEach(a => {
                  window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: a }));
                });
              });
            }).catch(() => {});
          }).catch(() => {});
        }
        // 播放提示音
        if (settings.soundEnabled) {
          playCompletionSound();
        }
        // 播放阶段完成音效
        if (phase === 'work') {
          soundPlayer.play('pomodoro_work_complete');
        } else {
          soundPlayer.play('pomodoro_break_end');
          // 长休结束 = 一整轮完成
          if (phase === 'long_break') {
            soundPlayer.play('pomodoro_complete');
          }
        }
        // 发送浏览器通知
        if (settings.notificationEnabled) {
          if (phase === 'work') {
            sendNotification('工作完成！', '休息一下吧 ☕').catch(() => {});
          } else {
            sendNotification('休息结束！', '开始下一个番茄 🍅').catch(() => {});
          }
        }

        set({
          phase: nextPhase,
          remainingSeconds: duration,
          totalSeconds: duration,
          completedCount: newCount,
          isRunning: shouldAutoStart,
          isPaused: !shouldAutoStart,
          // 切换到新阶段时清空计时，下一个 start/resume 会重新设置
          sessionStartTime: null,
        });
      } else {
        const nextRemaining = remainingSeconds - 1;
        // 5 分钟预警（工作阶段）
        if (phase === 'work' && nextRemaining === 300) {
          soundPlayer.play('pomodoro_5min_warning');
        }
        // 最后 10 秒滴答
        if (phase === 'work' && nextRemaining <= 10 && nextRemaining > 0) {
          soundPlayer.play('pomodoro_tick_final');
        }
        set({ remainingSeconds: nextRemaining });
      }
    },

    updateSettings: (newSettings) => {
      const { settings, phase, isRunning, isPaused, mode } = get();
      const merged = { ...settings, ...newSettings };

      // If not running, update timer to reflect new duration
      if (!isRunning && !isPaused) {
        const duration = getPhaseDuration(phase, merged, mode);
        set({
          settings: merged,
          remainingSeconds: duration,
          totalSeconds: duration,
        });
      } else {
        set({ settings: merged });
      }

      // 持久化设置
      saveSettings(merged).catch(() => {});
    },
  };
});
