/**
 * 文件日志模块
 *
 * 将应用日志写入 userData/logs/ 目录，每次启动生成独立日志文件。
 * 提供 info / warn / error / crash 四个级别，crash 额外记录进程状态。
 * fs 写入失败时静默降级到 console.error。
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

class Logger {
  private stream: fs.WriteStream | null = null;
  private initialized = false;

  /** 初始化日志目录和文件流（惰性调用，确保 app 已 ready） */
  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const logsDir = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(logsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logsDir, `app-${timestamp}.log`);
      this.stream = fs.createWriteStream(logFile, { flags: 'a' });
      this.stream.write(`# KeBan log started at ${new Date().toISOString()}\n`);
    } catch (err) {
      console.error('[Logger] Failed to initialize file logger:', err);
      this.stream = null;
    }
  }

  private write(level: string, message: string, extra?: string): void {
    this.ensureInit();
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}\n`;
    const fullLine = extra ? `${line}${extra}\n` : line;

    // 始终输出到控制台
    if (level === 'ERROR' || level === 'CRASH') {
      console.error(fullLine.trimEnd());
    } else if (level === 'WARN') {
      console.warn(fullLine.trimEnd());
    } else {
      console.log(fullLine.trimEnd());
    }

    // 写入文件（失败时静默降级）
    if (this.stream) {
      try {
        this.stream.write(fullLine);
      } catch {
        // 静默降级
      }
    }
  }

  info(msg: string): void {
    this.write('INFO', msg);
  }

  warn(msg: string): void {
    this.write('WARN', msg);
  }

  error(msg: string, error?: unknown): void {
    const extra = error instanceof Error ? error.stack ?? '' : error ? String(error) : undefined;
    this.write('ERROR', msg, extra);
  }

  /** 严重错误：除错误信息外还记录进程状态快照 */
  crash(msg: string, error?: unknown): void {
    const parts: string[] = [];

    if (error instanceof Error) {
      parts.push(error.stack ?? error.message);
    } else if (error) {
      parts.push(String(error));
    }

    try {
      const mem = process.memoryUsage();
      parts.push(
        `--- Process State ---`,
        `pid: ${process.pid}`,
        `uptime: ${process.uptime()}s`,
        `memory: rss=${Math.round(mem.rss / 1048576)}MB heap=${Math.round(mem.heapUsed / 1048576)}/${Math.round(mem.heapTotal / 1048576)}MB`,
        `electron: ${process.versions.electron ?? 'N/A'}`,
        `node: ${process.versions.node}`,
        `platform: ${process.platform} ${process.arch}`,
      );
    } catch {
      parts.push('--- Process State: unavailable ---');
    }

    this.write('CRASH', msg, parts.join('\n'));
  }
}

export const logger = new Logger();
