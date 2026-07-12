/**
 * 主窗口管理器
 *
 * 从 main.ts 拆分而来，负责 BrowserWindow 创建配置
 * 及关闭行为偏好持久化。
 */

import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger.js';
import { createTray } from './trayManager.js';

// ================================================================
// 常量
// ================================================================

const WINDOW_DEFAULT_WIDTH = 1200;
const WINDOW_DEFAULT_HEIGHT = 800;
const WINDOW_MIN_WIDTH = 600;

// ================================================================
// 关闭偏好持久化
// ================================================================

/** 读取保存的关闭选择 */
function getCloseChoice(): string | null {
  try {
    const configPath = path.join(app.getPath('userData'), 'close-preference.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return data.choice || null;
    }
  } catch { /* ignore */ }
  return null;
}

/** 保存关闭选择到配置文件 */
export function saveCloseChoice(choice: string): void {
  try {
    const configPath = path.join(app.getPath('userData'), 'close-preference.json');
    fs.writeFileSync(configPath, JSON.stringify({ choice }), 'utf-8');
  } catch { /* ignore */ }
}

// ================================================================
// 创建主窗口
// ================================================================

/**
 * 创建并返回主窗口
 *
 * @param isQuittingRef - 退出标志引用，用于区分"最小化到托盘"与"真正退出"
 * @param onQuit - 确认退出时的回调
 * @returns 创建的 BrowserWindow 实例
 */
export function createMainWindow(
  isQuittingRef: { value: boolean },
  onQuit: () => void,
): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_DEFAULT_WIDTH,
    height: WINDOW_DEFAULT_HEIGHT,
    minWidth: 800,
    minHeight: WINDOW_MIN_WIDTH,
    title: '课伴',
    frame: false,
    icon: path.join(__dirname, '..', 'app-icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 窗口最大化状态变化时通知前端
  win.on('maximize', () => {
    win.webContents.send('window:maximized-changed', true);
  });
  win.on('unmaximize', () => {
    win.webContents.send('window:maximized-changed', false);
  });

  // 判断开发/生产模式
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    // 开发模式：连接 Vite 开发服务器
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的 index.html
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

    // 生产环境禁用 DevTools（防止用户打开开发人员工具）
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
    // 拦截 DevTools 快捷键
    win.webContents.on('before-input-event', (event, input) => {
      if (
        (input.control && input.shift && input.key.toLowerCase() === 'i') ||
        (input.control && input.shift && input.key.toLowerCase() === 'j') ||
        (input.key === 'F12')
      ) {
        event.preventDefault();
      }
    });
  }

  // 关闭窗口时根据用户偏好决定行为
  win.on('close', (event) => {
    if (!isQuittingRef.value) {
      event.preventDefault();
      const savedChoice = getCloseChoice();
      if (savedChoice === 'quit') {
        isQuittingRef.value = true;
        onQuit();
      } else if (savedChoice === 'minimize') {
        win.hide();
      } else {
        // 无记忆选择，通知前端弹出确认对话框
        win.webContents.send('window:closing');
      }
    }
  });

  // 创建系统托盘
  createTray(win, onQuit);

  logger.info('[Window] Main window created');
  return win;
}
