/**
 * 平台检测工具
 */

export function isTauri(): boolean {
  return !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;
}

export function isPWA(): boolean {
  return !isTauri() && window.matchMedia('(display-mode: standalone)').matches;
}

export function isBrowser(): boolean {
  return !isTauri() && !isPWA();
}

export function getPlatform(): 'tauri' | 'pwa' | 'browser' {
  if (isTauri()) return 'tauri';
  if (isPWA()) return 'pwa';
  return 'browser';
}
