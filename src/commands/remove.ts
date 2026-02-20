import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { RemoveOptions } from '../types/index.js';
import {
  validateMainWorktree,
  getProjectName,
  getProjectWorktreeDir,
  getProjectWorktrees,
  removeWorktreeByPath,
  deleteBranch,
  getConfigValue,
  gitWorktreePrune,
  removeEmptyDir,
  printInfo,
  printSuccess,
  printError,
  confirmAction,
} from '../utils/index.js';

/**
 * 注册 remove 命令：移除 worktree
 * @param {Command} program - Commander 实例
 */
export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .description('移除 worktree（支持单个/批量/全部）')
    .option('--all', '移除当前项目下所有 worktree')
    .option('-b, --branch <branchName>', '指定分支名（完整分支名精确匹配）')
    .action(async (options: RemoveOptions) => {
      await handleRemove(options);
    });
}

/**
 * 根据参数确定要移除的 worktree 列表
 * @param {RemoveOptions} options - 命令选项
 * @returns {Array<{path: string, branch: string}>} 待移除的 worktree 列表
 */
function resolveWorktreesToRemove(options: RemoveOptions): Array<{ path: string; branch: string }> {
  const allWorktrees = getProjectWorktrees();

  if (options.all) {
    return allWorktrees;
  }

  if (!options.branch) {
    throw new ClawtError('请指定 --all 或 -b <branchName> 参数');
  }

  // 分支级移除：匹配 branchName 或 branchName-*
  const matched = allWorktrees.filter(
    (wt) => wt.branch === options.branch || wt.branch.startsWith(`${options.branch}-`),
  );
  if (matched.length === 0) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(options.branch));
  }
  return matched;
}

/**
 * 执行 remove 命令的核心逻辑
 * @param {RemoveOptions} options - 命令选项
 */
async function handleRemove(options: RemoveOptions): Promise<void> {
  validateMainWorktree();

  const projectName = getProjectName();
  logger.info(`remove 命令执行，项目: ${projectName}`);

  const worktreesToRemove = resolveWorktreesToRemove(options);

  if (worktreesToRemove.length === 0) {
    printInfo(MESSAGES.NO_WORKTREES);
    return;
  }

  // 列出即将移除的 worktree
  printInfo('即将移除以下 worktree 及本地分支：\n');
  worktreesToRemove.forEach((wt, index) => {
    printInfo(`  ${index + 1}. ${wt.path}  →  分支: ${wt.branch}`);
  });
  printInfo('');

  // 判断是否需要删除分支
  const autoDelete = getConfigValue('autoDeleteBranch');
  let shouldDeleteBranch = autoDelete;

  if (!autoDelete) {
    shouldDeleteBranch = await confirmAction('是否同时删除对应的本地分支？');
  }

  // 执行移除，收集失败项
  const failures: Array<{ path: string; error: string }> = [];
  for (const wt of worktreesToRemove) {
    try {
      removeWorktreeByPath(wt.path);
      if (shouldDeleteBranch) {
        deleteBranch(wt.branch);
      }
      printSuccess(MESSAGES.WORKTREE_REMOVED(wt.path));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`移除 worktree 失败: ${wt.path} - ${error}`);
      failures.push({ path: wt.path, error: errorMessage });
    }
  }

  // 清理 worktree 并清除空目录
  gitWorktreePrune();
  const projectDir = getProjectWorktreeDir();
  removeEmptyDir(projectDir);

  // 汇总报告失败项
  if (failures.length > 0) {
    printError(MESSAGES.REMOVE_PARTIAL_FAILURE(failures));
    throw new ClawtError(
      `${failures.length} 个 worktree 移除失败`,
    );
  }
}
