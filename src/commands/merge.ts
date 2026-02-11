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
  hasLocalCommits,
  printSuccess,
  printInfo,
  getConfigValue,
  confirmAction,
  cleanupWorktrees,
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
    .option('-m, --message <message>', '提交信息（工作区有修改时必填）')
    .action(async (options: MergeOptions) => {
      await handleMerge(options);
    });
}

/**
 * 判断 merge 成功后是否需要清理 worktree 和分支
 * 如果全局配置了 autoDeleteBranch 则直接返回 true，否则询问用户
 * @param {string} branchName - 分支名
 * @returns {Promise<boolean>} 是否清理
 */
async function shouldCleanupAfterMerge(branchName: string): Promise<boolean> {
  const autoDelete = getConfigValue('autoDeleteBranch');
  if (autoDelete) {
    printInfo(`已配置自动删除，merge 成功后将自动清理 worktree 和分支: ${branchName}`);
    return true;
  }
  return confirmAction(`merge 成功后是否删除对应的 worktree 和分支 (${branchName})？`);
}

/**
 * 清理已合并的 worktree 和对应分支
 * @param {string} worktreePath - worktree 目录路径
 * @param {string} branchName - 分支名
 */
function cleanupWorktreeAndBranch(worktreePath: string, branchName: string): void {
  cleanupWorktrees([{ path: worktreePath, branch: branchName }]);
  printSuccess(MESSAGES.WORKTREE_CLEANED(branchName));
}

/**
 * 执行 merge 命令的核心逻辑
 * @param {MergeOptions} options - 命令选项
 */
async function handleMerge(options: MergeOptions): Promise<void> {
  validateMainWorktree();

  const mainWorktreePath = getGitTopLevel();
  const projectDir = getProjectWorktreeDir();
  const targetWorktreePath = join(projectDir, options.branch);

  logger.info(`merge 命令执行，分支: ${options.branch}，提交信息: ${options.message ?? '(未提供)'}`);

  // 检查目标 worktree 是否存在
  if (!existsSync(targetWorktreePath)) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(options.branch));
  }

  // 步骤 3：主 worktree 状态检测
  if (!isWorkingDirClean(mainWorktreePath)) {
    throw new ClawtError(MESSAGES.MAIN_WORKTREE_DIRTY);
  }

  // merge 前确认是否清理 worktree 和分支
  const shouldCleanup = await shouldCleanupAfterMerge(options.branch);

  // 步骤 4：根据目标 worktree 状态决定是否需要提交
  const targetClean = isWorkingDirClean(targetWorktreePath);

  if (!targetClean) {
    // 目标 worktree 有未提交修改，必须提供 -m
    if (!options.message) {
      throw new ClawtError(MESSAGES.TARGET_WORKTREE_DIRTY_NO_MESSAGE);
    }
    gitAddAll(targetWorktreePath);
    gitCommit(options.message, targetWorktreePath);
  } else {
    // 目标 worktree 干净，检查是否有本地提交
    if (!hasLocalCommits(options.branch, mainWorktreePath)) {
      throw new ClawtError(MESSAGES.TARGET_WORKTREE_NO_CHANGES);
    }
    // 有本地提交，跳过提交步骤，直接合并
  }

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

  // 步骤 8：输出成功提示（根据是否有 message 选择对应模板）
  if (options.message) {
    printSuccess(MESSAGES.MERGE_SUCCESS(options.branch, options.message));
  } else {
    printSuccess(MESSAGES.MERGE_SUCCESS_NO_MESSAGE(options.branch));
  }

  // 步骤 9：merge 成功后清理 worktree 和分支
  if (shouldCleanup) {
    cleanupWorktreeAndBranch(targetWorktreePath, options.branch);
  }
}
