import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES, AUTO_SAVE_COMMIT_MESSAGE } from '../constants/index.js';
import type { SyncOptions } from '../types/index.js';
import {
  runPreChecks,
  getGitTopLevel,
  getProjectWorktrees,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  printSuccess,
  printInfo,
  printWarning,
  resolveTargetWorktree,
  getMainWorkBranch,
  rebuildValidateBranch,
  getValidateBranchName,
} from '../utils/index.js';
import type { WorktreeResolveMessages } from '../utils/index.js';

/**
 * 注册 sync 命令：将主分支最新代码同步到目标 worktree（含验证分支重建）
 * @param {Command} program - Commander 实例
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('将主分支最新代码同步到目标 worktree')
    .option('-b, --branch <branchName>', '要同步的分支名（支持模糊匹配，不传则列出所有分支）')
    .action(async (options: SyncOptions) => {
      await handleSync(options);
    });
}

/** sync 命令的分支解析消息配置 */
const SYNC_RESOLVE_MESSAGES: WorktreeResolveMessages = {
  noWorktrees: MESSAGES.SYNC_NO_WORKTREES,
  selectBranch: MESSAGES.SYNC_SELECT_BRANCH,
  multipleMatches: MESSAGES.SYNC_MULTIPLE_MATCHES,
  noMatch: MESSAGES.SYNC_NO_MATCH,
};

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

/** sync 核心操作的执行结果 */
export interface SyncResult {
  /** 是否同步成功 */
  success: boolean;
  /** 是否存在合并冲突 */
  hasConflict: boolean;
}

/**
 * 执行 sync 核心操作（检查未提交→自动保存→merge 主分支）
 * 不包含 worktree 解析交互，供 validate 等命令复用
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} branch - 分支名
 * @returns {SyncResult} sync 执行结果
 */
export async function executeSyncForBranch(targetWorktreePath: string, branch: string): Promise<SyncResult> {
  // 从项目配置获取主工作分支名
  const mainWorktreePath = getGitTopLevel();
  const mainBranch = getMainWorkBranch();

  // 检查目标 worktree 是否有未提交变更，有则自动保存
  if (!isWorkingDirClean(targetWorktreePath)) {
    autoSaveChanges(targetWorktreePath, branch);
  }

  // 在目标 worktree 中合并主分支
  printInfo(MESSAGES.SYNC_MERGING(branch, mainBranch));
  const hasConflict = mergeMainBranch(targetWorktreePath, mainBranch);

  if (hasConflict) {
    printWarning(MESSAGES.SYNC_CONFLICT(targetWorktreePath));
    return { success: false, hasConflict: true };
  }

  printSuccess(MESSAGES.SYNC_SUCCESS(branch, mainBranch));

  // 合并成功后重建验证分支（基于最新的主分支 HEAD）
  await rebuildValidateBranch(branch, mainWorktreePath);
  const validateBranchName = getValidateBranchName(branch);
  printInfo(MESSAGES.SYNC_VALIDATE_BRANCH_REBUILT(validateBranchName));

  return { success: true, hasConflict: false };
}

/**
 * 执行 sync 命令的核心逻辑
 * 将主分支最新代码同步到目标 worktree
 * @param {SyncOptions} options - 命令选项
 */
async function handleSync(options: SyncOptions): Promise<void> {
  runPreChecks({ mainWorktree: true, headExists: true, projectConfig: true });

  logger.info(`sync 命令执行，分支: ${options.branch ?? '(未指定)'}`);

  // 解析目标 worktree（精确匹配 / 模糊匹配 / 交互选择）
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, SYNC_RESOLVE_MESSAGES, options.branch);
  const { path: targetWorktreePath, branch } = worktree;

  await executeSyncForBranch(targetWorktreePath, branch);
}
