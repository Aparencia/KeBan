export interface AudioTrack {
  id: string;
  name: string;
  nameZh: string;
  src: string;
  category: 'white_noise' | 'bgm';
}

export const audioTracks: AudioTrack[] = [
  // 白噪音
  { id: 'rain', name: 'Rain', nameZh: '雨声', src: '/audio/rain.mp3', category: 'white_noise' },
  { id: 'cafe', name: 'Cafe', nameZh: '咖啡厅', src: '/audio/cafe.mp3', category: 'white_noise' },
  { id: 'forest', name: 'Forest', nameZh: '森林', src: '/audio/forest.mp3', category: 'white_noise' },
  { id: 'waves', name: 'Waves', nameZh: '海浪', src: '/audio/waves.mp3', category: 'white_noise' },
  // 背景音乐
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
