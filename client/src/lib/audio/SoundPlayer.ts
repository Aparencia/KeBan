/**
 * 音效播放器
 *
 * 基于 Web Audio API 实现，零依赖。
 * 支持预加载、音量控制、静音切换。
 * 播放失败时静默降级，不影响主流程。
 */

/** 音效 ID 到文件路径的映射 */
const SOUND_MAP = {
  capture_start: '/sounds/capture_start.wav',
  capture_stop: '/sounds/capture_stop.wav',
  note_autosave: '/sounds/note_autosave.wav',
  note_manual_save: '/sounds/note_manual_save.wav',
  pomodoro_start: '/sounds/pomodoro_start.wav',
  pomodoro_pause: '/sounds/pomodoro_pause.wav',
  pomodoro_tick: '/sounds/pomodoro_tick.wav',
  pomodoro_tick_final: '/sounds/pomodoro_tick_final.wav',
  pomodoro_5min_warning: '/sounds/pomodoro_5min_warning.wav',
  pomodoro_work_complete: '/sounds/pomodoro_work_complete.wav',
  pomodoro_break_end: '/sounds/pomodoro_break_end.wav',
  pomodoro_complete: '/sounds/pomodoro_complete.wav',
  rate_remember: '/sounds/rate_remember.wav',
  rate_fuzzy: '/sounds/rate_fuzzy.wav',
  rate_forgot: '/sounds/rate_forgot.wav',
  card_flip: '/sounds/card_flip.wav',
  deck_complete: '/sounds/deck_complete.wav',
  achievement_unlocked: '/sounds/achievement_unlocked.wav',
  ai_analysis_done: '/sounds/ai_analysis_done.wav',
  daily_checkin: '/sounds/daily_checkin.wav',
  feynman_record_start: '/sounds/feynman_record_start.wav',
  feynman_record_stop: '/sounds/feynman_record_stop.wav',
  feynman_complete: '/sounds/feynman_complete.wav',
  feynman_weak_point: '/sounds/feynman_weak_point.wav',
} as const;

export type SoundId = keyof typeof SOUND_MAP;

class SoundPlayer {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private volume: number = 0.7;
  private muted: boolean = false;

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  /** 预加载音效到 AudioBuffer */
  async preload(soundId: SoundId): Promise<void> {
    const path = SOUND_MAP[soundId];
    if (!path || this.buffers.has(path)) return;
    try {
      const ctx = this.getContext();
      const response = await fetch(path);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(path, audioBuffer);
    } catch {
      // 静默降级
    }
  }

  /** 预加载所有音效 */
  async preloadAll(): Promise<void> {
    await Promise.allSettled(
      (Object.keys(SOUND_MAP) as SoundId[]).map((id) => this.preload(id)),
    );
  }

  /** 播放音效 */
  play(soundId: SoundId, options?: { volume?: number }): void {
    if (this.muted) return;
    try {
      const path = SOUND_MAP[soundId];
      if (!path) return;
      const buffer = this.buffers.get(path);
      if (!buffer) {
        // 未预加载则异步加载后播放
        this.preload(soundId).then(() => this.play(soundId, options));
        return;
      }
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = options?.volume ?? this.volume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch {
      // 静默降级，不影响主流程
    }
  }

  /** 设置全局音量 (0-1) */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /** 获取当前音量 */
  getVolume(): number {
    return this.volume;
  }

  /** 设置静音 */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** 是否静音 */
  isMuted(): boolean {
    return this.muted;
  }
}

export const soundPlayer = new SoundPlayer();
