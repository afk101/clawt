import { join } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { SESSIONS_DIR, SESSION_FILE_EXTENSION } from '../constants/index.js';
import { getProjectName } from './git.js';
import { ensureDir } from './fs.js';
import { logger } from '../logger/index.js';
import type { TaskResult } from '../types/index.js';

/**
 * 获取指定分支的 session 文件路径
 * @param {string} branch - 分支名
 * @returns {string} session 文件完整路径
 */
export function getSessionFilePath(branch: string): string {
  const projectName = getProjectName();
  return join(SESSIONS_DIR, projectName, `${branch}${SESSION_FILE_EXTENSION}`);
}

/**
 * 持久化 session_id 到文件
 * @param {string} branch - 分支名
 * @param {string} sessionId - Claude Code 返回的 session_id
 */
export function saveSessionId(branch: string, sessionId: string): void {
  const filePath = getSessionFilePath(branch);
  const dir = join(filePath, '..');
  ensureDir(dir);
  writeFileSync(filePath, sessionId, 'utf-8');
  logger.info(`session_id 已保存: ${branch} -> ${sessionId}`);
}

/**
 * 读取指定分支的 session_id
 * @param {string} branch - 分支名
 * @returns {string | null} session_id，文件不存在或为空时返回 null
 */
export function loadSessionId(branch: string): string | null {
  const filePath = getSessionFilePath(branch);
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, 'utf-8').trim();
  return content || null;
}

/**
 * 删除指定分支的 session 文件
 * 文件不存在时静默忽略
 * @param {string} branch - 分支名
 */
export function removeSessionId(branch: string): void {
  const filePath = getSessionFilePath(branch);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    logger.info(`session 文件已删除: ${branch}`);
  }
}

/**
 * 批量持久化任务结果中的 session_id
 * 仅对成功且包含 session_id 的结果进行保存
 * @param {TaskResult[]} results - 任务执行结果列表
 */
export function persistSessionIds(results: TaskResult[]): void {
  let count = 0;
  for (const result of results) {
    if (result.success && result.result?.session_id) {
      saveSessionId(result.branch, result.result.session_id);
      count++;
    }
  }
  if (count > 0) {
    logger.info(`共持久化 ${count} 个 session_id`);
  }
}
