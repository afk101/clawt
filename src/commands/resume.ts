import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ResumeOptions, WorktreeInfo } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
} from '../utils/index.js';

/**
 * 注册 resume 命令：在已有 worktree 中恢复 Claude Code 会话
 * @param {Command} program - Commander 实例
 */
export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('在已有 worktree 中恢复 Claude Code 交互式会话')
    .requiredOption('-b, --branch <branchName>', '要恢复的分支名')
    .action((options: ResumeOptions) => {
      handleResume(options);
    });
}

/**
 * 在已有 worktree 列表中按分支名查找对应的 worktree
 * @param {string} branchName - 目标分支名
 * @returns {WorktreeInfo} 匹配的 worktree 信息
 * @throws {ClawtError} 当找不到匹配的 worktree 时抛出
 */
function findWorktreeByBranch(branchName: string): WorktreeInfo {
  const worktrees = getProjectWorktrees();
  const matched = worktrees.find((wt) => wt.branch === branchName);

  if (!matched) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(branchName));
  }

  return matched;
}

/**
 * 执行 resume 命令的核心逻辑
 * 查找已有 worktree 并恢复 Claude Code 会话
 * @param {ResumeOptions} options - 命令选项
 */
function handleResume(options: ResumeOptions): void {
  validateMainWorktree();
  validateClaudeCodeInstalled();

  logger.info(`resume 命令执行，分支: ${options.branch}`);

  // 查找目标 worktree
  const worktree = findWorktreeByBranch(options.branch);

  // 启动 Claude Code 交互式界面
  launchInteractiveClaude(worktree);
}
