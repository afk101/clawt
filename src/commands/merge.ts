import type { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { MergeOptions } from '../types/index.js';
import {
  validateMainWorktree,
  getGitTopLevel,
  getProjectWorktreeDir,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  gitPull,
  gitPush,
  printSuccess,
  printError,
} from '../utils/index.js';

/**
 * 注册 merge 命令：合并验证过的分支到主 worktree
 * @param {Command} program - Commander 实例
 */
export function registerMergeCommand(program: Command): void {
  program
    .command('merge')
    .description('合并某个已验证的 worktree 分支到主 worktree')
    .requiredOption('-b, --branch <branchName>', '要合并的分支名')
    .requiredOption('-m, --message <message>', '提交信息')
    .action((options: MergeOptions) => {
      handleMerge(options);
    });
}

/**
 * 执行 merge 命令的核心逻辑
 * @param {MergeOptions} options - 命令选项
 */
function handleMerge(options: MergeOptions): void {
  validateMainWorktree();

  const mainWorktreePath = getGitTopLevel();
  const projectDir = getProjectWorktreeDir();
  const targetWorktreePath = join(projectDir, options.branch);

  logger.info(`merge 命令执行，分支: ${options.branch}，提交信息: ${options.message}`);

  // 检查目标 worktree 是否存在
  if (!existsSync(targetWorktreePath)) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(options.branch));
  }

  // 步骤 3：主 worktree 状态检测
  if (!isWorkingDirClean(mainWorktreePath)) {
    throw new ClawtError(MESSAGES.MAIN_WORKTREE_DIRTY);
  }

  // 步骤 4：在目标 worktree 中提交
  gitAddAll(targetWorktreePath);
  gitCommit(options.message, targetWorktreePath);

  // 步骤 5：回到主 worktree 进行合并
  try {
    gitMerge(options.branch, mainWorktreePath);
  } catch (error) {
    // 检查是否有冲突
    if (hasMergeConflict(mainWorktreePath)) {
      throw new ClawtError(MESSAGES.MERGE_CONFLICT);
    }
    throw error;
  }

  // 步骤 6：冲突检测（二次确认）
  if (hasMergeConflict(mainWorktreePath)) {
    throw new ClawtError(MESSAGES.MERGE_CONFLICT);
  }

  // 步骤 7：推送
  gitPull(mainWorktreePath);
  gitPush(mainWorktreePath);

  // 步骤 8：输出成功提示
  printSuccess(MESSAGES.MERGE_SUCCESS(options.branch, options.message));
}
