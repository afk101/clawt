import { execCommand } from './shell.js';
import { logger } from '../logger/index.js';

/**
 * 创建 worktree 并同时创建新分支
 * @param {string} branchName - 新分支名
 * @param {string} worktreePath - worktree 目录路径
 * @param {string} cwd - 工作目录
 */
export function createWorktree(branchName: string, worktreePath: string, cwd?: string): void {
  logger.info(`创建 worktree: ${worktreePath}`);
  execCommand(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd });
}

/**
 * 强制移除 worktree
 * @param {string} worktreePath - worktree 目录路径
 * @param {string} cwd - 工作目录
 */
export function removeWorktreeByPath(worktreePath: string, cwd?: string): void {
  logger.info(`移除 worktree: ${worktreePath}`);
  execCommand(`git worktree remove -f "${worktreePath}"`, { cwd });
}

/**
 * 获取 git worktree list 的输出
 * @param {string} cwd - 工作目录
 * @returns {string} worktree 列表
 */
export function gitWorktreeList(cwd?: string): string {
  return execCommand('git worktree list', { cwd });
}

/**
 * 执行 git worktree prune
 * @param {string} cwd - 工作目录
 */
export function gitWorktreePrune(cwd?: string): void {
  execCommand('git worktree prune', { cwd });
}
