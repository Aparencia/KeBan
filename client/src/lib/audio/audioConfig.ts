/**
 * @ai-context 熵减音效系统分为 4 个独立类别（操作/成就/AI/深潜），
 * 每个类别可单独控制开关和音量。全局静音覆盖所有类别。
 * 音效配置持久化到 settingsStore（localStorage）。
 * 白噪音/BGM 为独立音频系统，由 useAudioPlayer 管理。
 */

/* ── 音效分类系统 ──────────────────────────────────── */

/** 音效类别枚举 */
export type SoundCategory = 'operation' | 'achievement' | 'ai' | 'pomodoro';

/** 单个音效定义 */
export interface SoundDefinition {
  id: string;
  name: string;
  category: SoundCategory;
  filePath: string;
}

/** 单个类别的音效设置 */
export interface CategorySoundSettings {
  enabled: boolean;
  /** 音量 0-100 */
  volume: number;
}

/** 全局音效设置 */
export interface SoundSettings {
  masterMute: boolean;
  categories: Record<SoundCategory, CategorySoundSettings>;
}

/** 音效类别显示名称映射 */
export const CATEGORY_LABELS: Record<SoundCategory, string> = {
  operation: '操作音效',
  achievement: '成就音效',
  ai: 'AI 音效',
  pomodoro: '深潜音效',
};

/** 音效类别描述映射 */
export const CATEGORY_DESCRIPTIONS: Record<SoundCategory, string> = {
  operation: '截图、结礁保存、卡片翻转等交互反馈',
  achievement: '打卡、成就解锁等激励反馈',
  ai: 'AI 分析完成等智能功能提示',
  pomodoro: '深潜启停、计时提醒',
};

/** 默认音效设置 */
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterMute: false,
  categories: {
    operation: { enabled: true, volume: 80 },
    achievement: { enabled: true, volume: 80 },
    ai: { enabled: true, volume: 70 },
    pomodoro: { enabled: true, volume: 80 },
  },
};

/** localStorage 持久化键 */
export const SOUND_SETTINGS_KEY = 'kb_sound_settings';

/** 音效清单 — 所有可用音效文件，按类别分组 */
export const SOUND_DEFINITIONS: SoundDefinition[] = [
  // 操作音效
  { id: 'capture_start', name: '截图开始', category: 'operation', filePath: '/sounds/capture_start.wav' },
  { id: 'capture_stop', name: '截图结束', category: 'operation', filePath: '/sounds/capture_stop.wav' },
  { id: 'note_autosave', name: '结礁自动保存', category: 'operation', filePath: '/sounds/note_autosave.wav' },
  { id: 'note_manual_save', name: '结礁手动保存', category: 'operation', filePath: '/sounds/note_manual_save.wav' },
  { id: 'card_flip', name: '卡片翻转', category: 'operation', filePath: '/sounds/card_flip.wav' },
  { id: 'daily_checkin', name: '每日打卡', category: 'operation', filePath: '/sounds/daily_checkin.wav' },
  { id: 'feynman_record_start', name: '浮出水面录音开始', category: 'operation', filePath: '/sounds/feynman_record_start.wav' },
  { id: 'feynman_record_stop', name: '浮出水面录音结束', category: 'operation', filePath: '/sounds/feynman_record_stop.wav' },

  // 成就音效
  { id: 'achievement_unlocked', name: '成就解锁', category: 'achievement', filePath: '/sounds/achievement_unlocked.wav' },
  { id: 'deck_complete', name: '卡组完成', category: 'achievement', filePath: '/sounds/deck_complete.wav' },
  { id: 'feynman_complete', name: '浮出水面完成', category: 'achievement', filePath: '/sounds/feynman_complete.wav' },

  // AI 音效
  { id: 'ai_analysis_done', name: 'AI 分析完成', category: 'ai', filePath: '/sounds/ai_analysis_done.wav' },
  { id: 'feynman_weak_point', name: '浮出水面薄弱点', category: 'ai', filePath: '/sounds/feynman_weak_point.wav' },

  // 深潜音效
  { id: 'pomodoro_start', name: '深潜开始', category: 'pomodoro', filePath: '/sounds/pomodoro_start.wav' },
  { id: 'pomodoro_pause', name: '深潜暂停', category: 'pomodoro', filePath: '/sounds/pomodoro_pause.wav' },
  { id: 'pomodoro_tick', name: '深潜滴答', category: 'pomodoro', filePath: '/sounds/pomodoro_tick.wav' },
  { id: 'pomodoro_tick_final', name: '深潜最终滴答', category: 'pomodoro', filePath: '/sounds/pomodoro_tick_final.wav' },
  { id: 'pomodoro_5min_warning', name: '5分钟提醒', category: 'pomodoro', filePath: '/sounds/pomodoro_5min_warning.wav' },
  { id: 'pomodoro_work_complete', name: '工作完成', category: 'pomodoro', filePath: '/sounds/pomodoro_work_complete.wav' },
  { id: 'pomodoro_break_end', name: '休息结束', category: 'pomodoro', filePath: '/sounds/pomodoro_break_end.wav' },
  { id: 'rate_remember', name: '评分-记得', category: 'pomodoro', filePath: '/sounds/rate_remember.wav' },
  { id: 'rate_fuzzy', name: '评分-模糊', category: 'pomodoro', filePath: '/sounds/rate_fuzzy.wav' },
  { id: 'rate_forgot', name: '评分-忘记', category: 'pomodoro', filePath: '/sounds/rate_forgot.wav' },
];

/**
 * 按类别筛选音效定义
 * @param category - 音效类别
 * @returns 该类别下的所有音效定义
 */
export function getSoundsByCategory(category: SoundCategory): SoundDefinition[] {
  return SOUND_DEFINITIONS.filter((s) => s.category === category);
}

/**
 * 根据音效 ID 查找定义
 * @param soundId - 音效 ID
 * @returns 音效定义，未找到返回 undefined
 */
export function findSoundDefinition(soundId: string): SoundDefinition | undefined {
  return SOUND_DEFINITIONS.find((s) => s.id === soundId);
}

/* ── 白噪音 / BGM 系统（独立于音效分类） ──────────── */

export interface AudioTrack {
  id: string;
  name: string;
  nameZh: string;
  src: string;
  category: 'white_noise' | 'bgm';
}

export const audioTracks: AudioTrack[] = [
  { id: 'rain', name: 'Rain', nameZh: '雨声', src: '/audio/rain.mp3', category: 'white_noise' },
  { id: 'cafe', name: 'Cafe', nameZh: '咖啡厅', src: '/audio/cafe.mp3', category: 'white_noise' },
  { id: 'forest', name: 'Forest', nameZh: '森林', src: '/audio/forest.mp3', category: 'white_noise' },
  { id: 'waves', name: 'Waves', nameZh: '海浪', src: '/audio/waves.mp3', category: 'white_noise' },
  { id: 'piano', name: 'Piano', nameZh: '钢琴曲', src: '/audio/piano.mp3', category: 'bgm' },
  { id: 'ambient', name: 'Ambient', nameZh: '轻音乐', src: '/audio/ambient.mp3', category: 'bgm' },
];

export const AUDIO_PREFS_KEY = 'kb_audio_preferences';

export interface AudioPreferences {
  whiteNoiseEnabled: boolean;
  whiteNoiseTrackId: string;
  whiteNoiseVolume: number;
  bgmEnabled: boolean;
  bgmTrackId: string;
  bgmVolume: number;
}

export const defaultAudioPreferences: AudioPreferences = {
  whiteNoiseEnabled: false,
  whiteNoiseTrackId: 'rain',
  whiteNoiseVolume: 0.5,
  bgmEnabled: false,
  bgmTrackId: 'piano',
  bgmVolume: 0.3,
};

export function loadAudioPreferences(): AudioPreferences {
  try {
    const saved = localStorage.getItem(AUDIO_PREFS_KEY);
    if (saved) return { ...defaultAudioPreferences, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return defaultAudioPreferences;
}

export function saveAudioPreferences(prefs: AudioPreferences): void {
  try { localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}
