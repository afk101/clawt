import { join, isAbsolute } from 'node:path';
import { execSync } from 'node:child_process';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';

/**
 * index.lock 错误的关键词匹配模式
 * 每个模式同时要求包含 index 关键词，避免 "Unable to write" 单独匹配导致误报
 */
const INDEX_LOCK_ERROR_PATTERNS = [
  /Unable to write.*index/i,
  /index\.lock/i,
  /Unable to create.*index/i,
];

/** 从 Git 错误消息中提取 index.lock 文件路径的正则（路径被 ASCII 单引号包裹） */
const INDEX_LOCK_PATH_EXTRACT_PATTERN = /'([^']*index\.lock)'/;

/**
 * 检测错误消息是否为 Git index.lock 相关错误
 * @param {string} errorMessage - 错误消息字符串
 * @returns {boolean} 是否为 index.lock 相关错误
 */
export function isGitIndexLockError(errorMessage: string): boolean {
  return INDEX_LOCK_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

/**
 * 从错误对象中提取完整的错误消息（包括 stderr）
 * execSync/execFileSync 抛出的错误对象的 stderr 属性包含 git 的实际错误输出
 * @param {unknown} error - 捕获的错误对象
 * @returns {string} 合并后的错误消息
 */
function extractFullErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const stderr = (error as { stderr?: string | Buffer }).stderr;
  const stderrStr = stderr ? String(stderr) : '';
  return stderrStr ? `${error.message}\n${stderrStr}` : error.message;
}

/**
 * 定位 Git index.lock 文件的完整路径
 * 兼容主 worktree 和子 worktree 场景（子 worktree 的 .git 是文件而非目录）
 * @param {string} [cwd] - 工作目录
 * @returns {string} index.lock 文件的完整路径
 */
export function findGitIndexLockPath(cwd?: string): string {
  try {
    // 不使用 shell.ts 的 execCommand，避免循环依赖（shell.ts → git-lock.ts → shell.ts）
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    // git rev-parse --git-dir 在某些场景（如设置了 GIT_DIR 环境变量）下返回绝对路径
    return isAbsolute(gitDir) ? join(gitDir, 'index.lock') : join(cwd || process.cwd(), gitDir, 'index.lock');
  } catch (error) {
    logger.warn(`定位 git 目录失败: ${error}`);
    // 降级：返回默认路径
    return join(cwd || process.cwd(), '.git', 'index.lock');
  }
}

/**
 * 从 Git 错误消息中解析 index.lock 文件的完整路径
 * Git 的 index.lock 错误消息格式统一为：Unable to create '<绝对路径>/index.lock': File exists
 * 路径被 ASCII 单引号包裹（中英文 locale 均如此，实测验证）
 * @param {string} errorMessage - 错误消息字符串
 * @returns {string | undefined} 解析出的路径，无法解析时返回 undefined
 */
function parseIndexLockPathFromError(errorMessage: string): string | undefined {
  const match = errorMessage.match(INDEX_LOCK_PATH_EXTRACT_PATTERN);
  return match?.[1];
}

/**
 * 检测错误是否为 Git index.lock 错误，如果是则抛出中文友好提示的 ClawtError
 * @param {unknown} error - 捕获的错误对象
 * @param {string} [cwd] - 工作目录（用于定位锁文件路径）
 * @throws {ClawtError} 当检测到 index.lock 错误时抛出
 */
export function throwIfGitIndexLockError(error: unknown, cwd?: string): void {
  const errorMessage = extractFullErrorMessage(error);
  if (isGitIndexLockError(errorMessage)) {
    // 优先从 git 错误消息中解析路径（零开销且最准确），解析失败时降级到 findGitIndexLockPath
    const lockFilePath = parseIndexLockPathFromError(errorMessage) ?? findGitIndexLockPath(cwd);
    throw new ClawtError(MESSAGES.GIT_INDEX_LOCKED(lockFilePath));
  }
}
