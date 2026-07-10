/**
 * 平台检测工具
 * 支持 Electron / PWA / Browser 三种运行环境
 */

export function isElectron(): boolean {
  return !!window.electronAPI;
}

export function isDesktop(): boolean {
  return isElectron();
}

export function isPWA(): boolean {
  return !isDesktop() && window.matchMedia('(display-mode: standalone)').matches;
}

export function isBrowser(): boolean {
  return !isDesktop() && !isPWA();
}

export function getPlatform(): 'electron' | 'pwa' | 'browser' {
  if (isElectron()) return 'electron';
  if (isPWA()) return 'pwa';
  return 'browser';
}
