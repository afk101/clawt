import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LOGS_DIR } from '../constants/index.js';
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
