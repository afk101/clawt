import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import chalk from 'chalk';
import { LOGS_DIR, DEBUG_TIMESTAMP_FORMAT } from '../constants/index.js';
import { existsSync, mkdirSync } from 'node:fs';

// 确保日志目录存在
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

/** 日志格式：[2025-02-06 14:30:22] [INFO]  消息内容 */
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  const upperLevel = level.toUpperCase().padEnd(5);
  return `[${timestamp}] [${upperLevel}] ${message}`;
});

/** 日志滚动传输：按日期滚动，保留 30 天，单文件最大 10MB */
const dailyRotateTransport = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: 'clawt-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '30d',
});

/** winston 日志实例 */
export const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [dailyRotateTransport],
});

/** 日志级别颜色映射 */
const LEVEL_COLORS: Record<string, (text: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  debug: chalk.gray,
};

/**
 * 为日志级别添加对应颜色
 * @param {string} level - 日志级别
 * @returns {string} 带颜色的日志级别字符串
 */
function colorizeLevel(level: string): string {
  const colorFn = LEVEL_COLORS[level] || chalk.white;
  return colorFn(level.toUpperCase().padEnd(5));
}

/**
 * 启用控制台日志输出（--debug 模式）
 * 动态向 winston 实例添加 Console transport，输出带颜色和时间戳的调试信息
 * 该函数幂等，多次调用不会重复添加 transport
 */
export function enableConsoleTransport(): void {
  // 幂等保护：检查是否已添加过 Console transport
  const hasConsole = logger.transports.some(
    (t) => t instanceof winston.transports.Console,
  );
  if (hasConsole) {
    return;
  }

  /** --debug 模式的控制台日志格式：精简时间戳 + 带颜色级别 + 消息 */
  const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${chalk.gray(timestamp)} ${colorizeLevel(level)} ${message}`;
  });

  const consoleTransport = new winston.transports.Console({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: DEBUG_TIMESTAMP_FORMAT }),
      consoleFormat,
    ),
  });

  logger.add(consoleTransport);
}
