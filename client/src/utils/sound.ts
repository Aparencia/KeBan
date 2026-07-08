/**
 * 使用 Web Audio API 播放指定频率的提示音
 * @param frequency 频率（Hz），默认 800
 * @param duration 持续时间（ms），默认 200
 * @param volume 音量（0-1），默认 0.3
 */
export function playBeep(frequency: number = 800, duration: number = 200, volume: number = 0.3): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = volume;

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    oscillator.stop(ctx.currentTime + duration / 1000 + 0.05);

    setTimeout(() => ctx.close(), duration + 200);
  } catch {
    // 静默失败，不影响主流程
  }
}
