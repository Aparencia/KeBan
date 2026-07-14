/**
 * 主窗口管理器
 *
 * 从 main.ts 拆分而来，负责 BrowserWindow 创建配置
 * 及关闭行为偏好持久化。
 */

import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import { access, readFile, writeFile } from 'fs/promises';
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

/** 缓存的关闭选择，避免在同步事件处理器中执行异步 I/O */
let cachedCloseChoice: string | null = null;

/** 读取保存的关闭选择 */
export async function getCloseChoice(): Promise<string | null> {
  try {
    const configPath = path.join(app.getPath('userData'), 'close-preference.json');
    try {
      await access(configPath);
    } catch {
      return null;
    }
    const data = JSON.parse(await readFile(configPath, 'utf-8'));
    cachedCloseChoice = data.choice || null;
    return cachedCloseChoice;
  } catch { /* ignore */ }
  return null;
}

/** 保存关闭选择到配置文件 */
export async function saveCloseChoice(choice: string): Promise<void> {
  try {
    const configPath = path.join(app.getPath('userData'), 'close-preference.json');
    await writeFile(configPath, JSON.stringify({ choice }), 'utf-8');
    cachedCloseChoice = choice;
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
    title: '熵减',
    frame: false,
    show: false, // 启动缓冲带：等待渲染就绪后再显示
    backgroundColor: '#0C1524', // 深海底色，防止白闪
    icon: path.join(app.getAppPath(), 'app-icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 启动缓冲带：渲染进程首次绘制完成后显示窗口
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    logger.info('[Window] Window shown (ready-to-show)');
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
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 生产模式：加载打包后的 index.html
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));

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

  // 预加载关闭偏好（异步加载，同步事件处理器使用缓存值）
  getCloseChoice(); // fire-and-forget：加载结果写入 cachedCloseChoice

  // 关闭窗口时根据用户偏好决定行为
  win.on('close', (event) => {
    if (!isQuittingRef.value) {
      event.preventDefault();
      const savedChoice = cachedCloseChoice;
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
