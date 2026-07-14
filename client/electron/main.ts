/**
 * Electron 主进程入口
 *
 * 应用生命周期管理、单实例锁、IPC handler 注册。
 * 窗口创建 → windowManager.ts
 * 托盘管理 → trayManager.ts
 * AI 网关代理 → ai/index.ts + ai/handlers/*.ts
 * 截图/音频采集 → captureHandlers.ts
 */

import { app, BrowserWindow, Menu, dialog, session } from 'electron';
import * as path from 'path';
import { writeFile, readFile } from 'fs/promises';
import { safeHandle, setMainWindowId } from './ipcUtils.js';
import { logger } from './logger.js';
import { registerAIHandlers } from './ai/index.js';
import { initAutoUpdater, checkForUpdate, downloadUpdate, installUpdate, destroyAutoUpdater, setAutoCheckEnabled } from './updater.js';
import { createMainWindow, saveCloseChoice } from './windowManager.js';
import { destroyTray } from './trayManager.js';
import { registerCaptureHandlers, disposeCaptureHandlers } from './captureHandlers.js';
import { initialize, getConnection, close as closeDb, checkpointAndClose, reinitialize, getDbPath } from './db/sqliteService.js';
import { initializeSchema } from './db/schema.js';
import { saveCustomStoragePath, resolveDbPath } from './db/storageConfig.js';
import { migrateDatabaseFiles, verifyDatabaseIntegrity, createBackup } from './db/dbFileMigrator.js';
import SqliteRepository from './db/sqliteRepository.js';
import { registerMigrationHandlers } from './db/migration.js';

// 仅开发模式禁用 Electron 安全警告，生产环境保留
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// ================================================================
// 模块级状态
// ================================================================

/** 标记应用是否正在退出（区分"最小化到托盘"与"真正退出"） */
const isQuittingRef = { value: false };

/** v1.1.0: 存储路径切换互斥锁 */
let isChangingPath = false;

/** 主窗口引用 */
let mainWindow: BrowserWindow | null = null;

// ================================================================
// 退出辅助
// ================================================================

/** 确认退出应用 */
function performQuit(): void {
  isQuittingRef.value = true;
  app.quit();
}

// ================================================================
// 单实例锁 — 防止重复启动导致多个后台进程
// ================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  // ================================================================
  // 应用生命周期
  // ================================================================

  process.on('uncaughtException', (error) => {
    logger.crash('Uncaught Exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.crash('Unhandled Rejection', error);
  });

  app.whenReady().then(async () => {
    // 异步初始化日志系统（创建日志目录和文件流）
    await logger.initLogger();
    logger.info('App ready');

    // ================================================================
    // SEC-005: CSP 安全策略注入
    // ================================================================
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    try {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // 开发环境：允许 unsafe-inline/unsafe-eval（Vite HMR 需要）
        // 生产环境：禁止 unsafe-eval，保留 unsafe-inline（Tailwind 运行时需要）
        const csp = isDev
          ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:;"
          : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';";

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp],
          },
        });
      });
      logger.info(`[SEC] CSP policy injected (${isDev ? 'development' : 'production'} mode)`);
    } catch (err) {
      // CSP 注入失败时记录错误但不阻塞启动
      logger.error('[SEC] Failed to inject CSP policy', err);
    }

    registerAIHandlers();
    registerCaptureHandlers();

    // v1.0.0: 初始化 SQLite 数据库
    const defaultDbPath = await resolveDbPath();
    const sqliteDb = initialize(defaultDbPath);
    initializeSchema(sqliteDb);
    logger.info('[DB] SQLite initialized and schema ready');

    // v1.0.0: 注册数据迁移 IPC handlers（IndexedDB → SQLite）
    registerMigrationHandlers(safeHandle);

    // 隐藏默认 Electron 菜单栏
    Menu.setApplicationMenu(null);

    // 通用 IPC handlers
    safeHandle('get-app-version', async () => {
      return app.getVersion();
    });

    safeHandle('get-default-storage-path', async () => {
      return app.getPath('userData');
    });

    safeHandle('dialog:selectDirectory', async (_event, options?: { title?: string; defaultPath?: string }) => {
      const result = await dialog.showOpenDialog({
        title: options?.title || '选择数据存储目录',
        defaultPath: options?.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, path: null };
      }

      return { canceled: false, path: result.filePaths[0] };
    });

    // v1.1.0: 获取当前实际使用的存储路径
    safeHandle('storage:get-active-path', async () => {
      return getDbPath() ?? await resolveDbPath();
    });

    // v1.1.0: 存储路径切换（含数据迁移）
    safeHandle('storage:change-path', async (_event, args: { newPath: string }) => {
      if (isChangingPath) {
        return { success: false, error: '正在处理路径切换，请稍后重试' };
      }

      isChangingPath = true;
      const previousPath = path.dirname(getDbPath() ?? await resolveDbPath());

      try {
        const { newPath } = args;

        // 1. 验证路径不同
        const normalizedNew = path.resolve(newPath);
        const normalizedOld = path.resolve(previousPath);
        if (normalizedNew === normalizedOld) {
          return { success: false, error: '新路径与当前路径相同' };
        }

        logger.info(`[Storage] Switching storage path: ${normalizedOld} → ${normalizedNew}`);

        // 2. 为旧数据库创建备份
        await createBackup(normalizedOld);

        // 3. WAL checkpoint 并关闭旧连接
        checkpointAndClose();

        // 4. 迁移数据库文件
        const migrationResult = await migrateDatabaseFiles(normalizedOld, normalizedNew);
        if (!migrationResult.success) {
          logger.error('[Storage] Migration failed:', migrationResult.error);
          // 回滚：重新打开旧路径
          const oldDbPath = path.join(normalizedOld, 'keban.db');
          reinitialize(oldDbPath);
          initializeSchema(getConnection());
          return { success: false, error: migrationResult.error };
        }

        // 5. 验证新数据库完整性
        const newDbPath = path.join(normalizedNew, 'keban.db');
        if (!verifyDatabaseIntegrity(newDbPath)) {
          logger.error('[Storage] Integrity check failed for new database');
          // 回滚
          const oldDbPath = path.join(normalizedOld, 'keban.db');
          reinitialize(oldDbPath);
          initializeSchema(getConnection());
          return { success: false, error: '新数据库完整性校验失败，已回滚到原路径' };
        }

        // 6. 重新连接到新路径
        reinitialize(newDbPath);
        initializeSchema(getConnection());

        // 7. 持久化新路径配置
        await saveCustomStoragePath(normalizedNew);

        logger.info(`[Storage] Path switch completed: ${normalizedNew}`);
        return {
          success: true,
          previousPath: normalizedOld,
          newPath: normalizedNew,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('[Storage] Path switch failed', err);

        // 尝试回滚到旧路径
        try {
          const oldDbPath = path.join(previousPath, 'keban.db');
          reinitialize(oldDbPath);
          initializeSchema(getConnection());
          logger.info('[Storage] Rolled back to previous path');
        } catch (rollbackErr) {
          logger.error('[Storage] Rollback also failed!', rollbackErr);
        }

        return { success: false, error: '路径切换失败: ' + errorMsg };
      } finally {
        isChangingPath = false;
      }
    });

    // 创建主窗口（内部会创建托盘）
    mainWindow = createMainWindow(isQuittingRef, performQuit);

    // SEC-005: 设置主窗口 ID 以启用 IPC sender 验证
    setMainWindowId(mainWindow.webContents.id);

    initAutoUpdater(mainWindow);

    // ---- 窗口控制 IPC handlers ----
    safeHandle('window:minimize', async () => {
      if (mainWindow) mainWindow.minimize();
      return { success: true };
    });

    safeHandle('window:maximize', async () => {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
      return { success: true };
    });

    safeHandle('window:close', async () => {
      if (mainWindow) mainWindow.close();
      return { success: true };
    });

    safeHandle('window:isMaximized', async () => {
      return mainWindow ? mainWindow.isMaximized() : false;
    });

    safeHandle('window:close-action', async (_event, action: 'quit' | 'minimize' | 'cancel', remember: boolean) => {
      if (!mainWindow) return;

      if (remember) {
        await saveCloseChoice(action);
      }

      if (action === 'quit') {
        performQuit();
      } else if (action === 'minimize') {
        mainWindow.hide();
      }
    });

    // 更新相关 IPC handler
    safeHandle('update:check', async () => {
      checkForUpdate();
      return { success: true };
    });

    safeHandle('update:download', async () => {
      downloadUpdate();
      return { success: true };
    });

    safeHandle('update:install', async () => {
      installUpdate();
      return { success: true };
    });

    safeHandle('update:set-auto-check', async (_event, enabled: boolean) => {
      setAutoCheckEnabled(enabled);
      return { success: true };
    });

    // ================================================================
    // v1.0.0: 数据访问 IPC handlers (db:*)
    // ================================================================

    /** 允许的表名白名单（防止 SQL 注入，不暴露原始 SQL） */
    const ALLOWED_TABLES = new Set([
      'notes', 'note_folders', 'flashcard_decks', 'flashcards',
      'flashcard_reviews', 'feynman_notes', 'feynman_summaries',
      'feynman_weak_points', 'operation_log', 'app_settings',
      'sync_conflicts', 'offline_queue', 'study_check_ins',
      'achievements', 'pomodoro_goals', 'pomodoro_sessions',
      'pomodoro_settings', 'window_captures', 'consent',
      'user_profile', 'inspirations', 'search_index',
    ]);

    /** camelCase → snake_case（用于表名映射） */
    const TABLE_NAME_MAP: Record<string, string> = {
      notes: 'notes',
      noteFolders: 'note_folders',
      flashcardDecks: 'flashcard_decks',
      flashcards: 'flashcards',
      flashcardReviews: 'flashcard_reviews',
      feynmanNotes: 'feynman_notes',
      feynmanSummaries: 'feynman_summaries',
      feynmanWeakPoints: 'feynman_weak_points',
      operationLog: 'operation_log',
      appSettings: 'app_settings',
      syncConflicts: 'sync_conflicts',
      offlineQueue: 'offline_queue',
      studyCheckIns: 'study_check_ins',
      achievements: 'achievements',
      pomodoroGoals: 'pomodoro_goals',
      pomodoroSessions: 'pomodoro_sessions',
      pomodoroSettings: 'pomodoro_settings',
      windowCaptures: 'window_captures',
      consent: 'consent',
      userProfile: 'user_profile',
      inspirations: 'inspirations',
      searchIndex: 'search_index',
    };

    function resolveTable(table: string): string {
      const snakeName = TABLE_NAME_MAP[table] || table;
      if (!ALLOWED_TABLES.has(snakeName)) {
        throw new Error(`[DB] Table "${table}" is not in the allowed whitelist`);
      }
      return snakeName;
    }

    /** db:query — 查询：接收 { table, method, args } → 调用 SqliteRepository 对应方法 */
    safeHandle('db:query', async (_event, params: { table: string; method: string; args?: unknown[] }) => {
      const tableName = resolveTable(params.table);
      const repo = new SqliteRepository(tableName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 动态表名场景无法约束具体类型
      const method = params.method as keyof SqliteRepository<any>;
      const allowedMethods = ['getAll', 'getById', 'count'];
      if (!allowedMethods.includes(method)) {
        throw new Error(`[DB] Query method "${params.method}" is not allowed`);
      }
      const fn = (repo as any)[method];
      if (typeof fn !== 'function') {
        throw new Error(`[DB] Method "${params.method}" does not exist on repository`);
      }
      return await fn.call(repo, ...(params.args ?? []));
    });

    /** db:insert — 插入：接收 { table, item } → create() */
    safeHandle('db:insert', async (_event, params: { table: string; item: Record<string, unknown> }) => {
      const tableName = resolveTable(params.table);
      const repo = new SqliteRepository(tableName);
      return await repo.create(params.item as any);
    });

    /** db:update — 更新：接收 { table, id, changes } → update() */
    safeHandle('db:update', async (_event, params: { table: string; id: string; changes: Record<string, unknown> }) => {
      const tableName = resolveTable(params.table);
      const repo = new SqliteRepository(tableName);
      return await repo.update(params.id, params.changes as any);
    });

    /** db:delete — 删除：接收 { table, id } → delete() */
    safeHandle('db:delete', async (_event, params: { table: string; id: string }) => {
      const tableName = resolveTable(params.table);
      const repo = new SqliteRepository(tableName);
      return await repo.delete(params.id);
    });

    /** db:search — 搜索：LIKE 模糊匹配（FTS5 在 T0.5 实现） */
    safeHandle('db:search', async (_event, params: { table: string; query: string }) => {
      const tableName = resolveTable(params.table);
      const dbConn = getConnection();
      const like = `%${params.query}%`;
      // 对 notes 表搜索 title 和 content，其余表搜索所有 TEXT 列
      if (tableName === 'notes') {
        return dbConn.prepare(
          `SELECT * FROM notes WHERE title LIKE ? OR content LIKE ?`
        ).all(like, like);
      }
      // 通用回退：获取表的 TEXT 列并搜索
      const colInfo = dbConn.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string; type: string }>;
      const textCols = colInfo.filter((c) => c.type === 'TEXT' && c.name !== 'id');
      if (textCols.length === 0) return [];
      const where = textCols.map((c) => `"${c.name}" LIKE ?`).join(' OR ');
      return dbConn.prepare(`SELECT * FROM "${tableName}" WHERE ${where}`).all(...textCols.map(() => like));
    });

    /** db:batch — 批量操作：事务执行 */
    safeHandle('db:batch', async (_event, params: { operations: Array<{ type: string; table: string; [key: string]: unknown }> }) => {
      const dbConn = getConnection();

      const txn = dbConn.transaction(() => {
        for (const op of params.operations) {
          const tableName = resolveTable(op.table as string);
          switch (op.type) {
            case 'insert': {
              const item = op.item as Record<string, unknown>;
              const cols = Object.keys(item);
              const placeholders = cols.map(() => '?').join(', ');
              const sql = `INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
              dbConn.prepare(sql).run(...Object.values(item));
              break;
            }
            case 'update': {
              const changes = op.changes as Record<string, unknown>;
              const entries = Object.entries(changes);
              if (entries.length === 0) break;
              const setClauses = entries.map(([col]) => `"${col}" = ?`).join(', ');
              const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE id = ?`;
              dbConn.prepare(sql).run(...entries.map(([, v]) => v), op.id as string);
              break;
            }
            case 'delete':
              dbConn.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(op.id as string);
              break;
            default:
              throw new Error(`[DB] Unknown batch operation type: ${op.type}`);
          }
        }
      });
      txn();
      return { success: true };
    });

    // ================================================================
    // v0.9.0: 备份相关 IPC handlers
    // ================================================================

    /**
     * 显示保存对话框并将备份数据写入文件
     */
    safeHandle('backup:save', async (_event, data: string, defaultName?: string) => {
      const filename = defaultName || `entropy-decrease-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const result = await dialog.showSaveDialog({
        title: '保存备份文件',
        defaultPath: filename,
        filters: [
          { name: '熵减备份文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true, path: null };
      }

      try {
        await writeFile(result.filePath, data, 'utf-8');
        return { success: true, canceled: false, path: result.filePath };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '写入失败';
        return { success: false, canceled: false, path: null, error: msg };
      }
    });

    /**
     * 显示打开对话框，选择备份文件并读取内容
     */
    safeHandle('backup:open', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择备份文件',
        filters: [
          { name: '熵减备份文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, content: null };
      }

      try {
        const content = await readFile(result.filePaths[0], 'utf-8');
        return { success: true, canceled: false, content, path: result.filePaths[0] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '读取失败';
        return { success: false, canceled: false, content: null, error: msg };
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow(isQuittingRef, performQuit);
        // SEC-005: macOS activate 重新创建窗口时同步更新 sender ID
        setMainWindowId(mainWindow.webContents.id);
      }
    });
  });

  // 标记应用即将退出
  app.on('before-quit', () => {
    isQuittingRef.value = true;
  });

  // 所有窗口关闭时退出应用
  app.on('window-all-closed', () => {
    logger.info('All windows closed');

    disposeCaptureHandlers();
    destroyAutoUpdater();
    destroyTray();
    closeDb();
    mainWindow = null;
    app.quit();
  });
}
