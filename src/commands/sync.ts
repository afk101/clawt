import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES, AUTO_SAVE_COMMIT_MESSAGE } from '../constants/index.js';
import type { SyncOptions } from '../types/index.js';
import {
  validateMainWorktree,
  getGitTopLevel,
  getProjectName,
  getProjectWorktreeDir,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  getCurrentBranch,
  hasSnapshot,
  removeSnapshot,
  printSuccess,
  printInfo,
  printWarning,
} from '../utils/index.js';

/**
 * 注册 sync 命令：将主分支最新代码同步到目标 worktree
 * @param {Command} program - Commander 实例
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('将主分支最新代码同步到目标 worktree')
    .requiredOption('-b, --branch <branchName>', '要同步的分支名')
    .action(async (options: SyncOptions) => {
      await handleSync(options);
    });
}

/**
 * 自动保存目标 worktree 中的未提交变更
 * @param {string} worktreePath - 目标 worktree 路径
 * @param {string} branch - 分支名
 */
function autoSaveChanges(worktreePath: string, branch: string): void {
  gitAddAll(worktreePath);
  gitCommit(AUTO_SAVE_COMMIT_MESSAGE, worktreePath);
  printInfo(MESSAGES.SYNC_AUTO_COMMITTED(branch));
  logger.info(`已自动保存 ${branch} 分支的未提交变更`);
}

/**
 * 在目标 worktree 中合并主分支
 * @param {string} worktreePath - 目标 worktree 路径
 * @param {string} mainBranch - 主分支名
 * @returns {boolean} 是否存在冲突（true 表示有冲突）
 */
function mergeMainBranch(worktreePath: string, mainBranch: string): boolean {
  try {
    gitMerge(mainBranch, worktreePath);
    return false;
  } catch {
    // 合并失败时检查是否为冲突
    if (hasMergeConflict(worktreePath)) {
      return true;
    }
    // 非冲突错误则向上抛出
    throw new ClawtError(`合并 ${mainBranch} 失败`);
  }
}

/**
 * 执行 sync 命令的核心逻辑
 * 将主分支最新代码同步到目标 worktree
 * @param {SyncOptions} options - 命令选项
 */
async function handleSync(options: SyncOptions): Promise<void> {
  validateMainWorktree();

  const { branch } = options;
  logger.info(`sync 命令执行，分支: ${branch}`);

  // 检查目标 worktree 是否存在
  const projectWorktreeDir = getProjectWorktreeDir();
  const targetWorktreePath = join(projectWorktreeDir, branch);

  if (!existsSync(targetWorktreePath)) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(branch));
  }

  // 获取主分支名（不硬编码 main/master）
  const mainWorktreePath = getGitTopLevel();
  const mainBranch = getCurrentBranch(mainWorktreePath);

  // 检查目标 worktree 是否有未提交变更，有则自动保存
  if (!isWorkingDirClean(targetWorktreePath)) {
    autoSaveChanges(targetWorktreePath, branch);
  }

  // 在目标 worktree 中合并主分支
  printInfo(MESSAGES.SYNC_MERGING(branch, mainBranch));
  const hasConflict = mergeMainBranch(targetWorktreePath, mainBranch);

  if (hasConflict) {
    printWarning(MESSAGES.SYNC_CONFLICT(targetWorktreePath));
    return;
  }

  // 合并成功后清除该分支的 validate 快照（代码基础已变化，旧快照无效）
  const projectName = getProjectName();
  if (hasSnapshot(projectName, branch)) {
    removeSnapshot(projectName, branch);
    logger.info(`已清除分支 ${branch} 的 validate 快照`);
  }

  printSuccess(MESSAGES.SYNC_SUCCESS(branch, mainBranch));
}
