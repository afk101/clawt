import type { Command } from 'commander';
import { MESSAGES, EXIT_CODES } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import type { CreateOptions } from '../types/index.js';
import {
  validateMainWorktree,
  createWorktrees,
  ensureOnMainWorkBranch,
  getValidateBranchName,
  printSuccess,
  printInfo,
  printSeparator,
} from '../utils/index.js';

/**
 * 注册 create 命令：批量创建 worktree 及对应分支（含验证分支）
 * @param {Command} program - Commander 实例
 */
export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('批量创建 worktree 及对应分支（含验证分支）')
    .requiredOption('-b, --branch <branchName>', '分支名')
    .option('-n, --number <count>', '创建数量', '1')
    .action(async (options: CreateOptions) => {
      await handleCreate(options);
    });
}

/**
 * 执行 create 命令的核心逻辑
 * @param {CreateOptions} options - 命令选项
 */
async function handleCreate(options: CreateOptions): Promise<void> {
  validateMainWorktree();

  await ensureOnMainWorkBranch();

  const count = Number(options.number);

  // 校验创建数量必须为正整数
  if (!Number.isInteger(count) || count <= 0) {
    throw new ClawtError(
      MESSAGES.INVALID_COUNT(options.number),
      EXIT_CODES.ARGUMENT_ERROR,
    );
  }

  logger.info(`create 命令执行，分支: ${options.branch}，数量: ${count}`);

  const worktrees = createWorktrees(options.branch, count);

  printSuccess(MESSAGES.WORKTREE_CREATED(worktrees.length));
  printInfo('');

  worktrees.forEach((wt, index) => {
    printInfo(`目录路径${index + 1}：`);
    printInfo(`  ${wt.path}`);
    printInfo(`  分支名: ${wt.branch}`);
    printInfo(`  验证分支: ${getValidateBranchName(wt.branch)}`);
    printSeparator();
  });
}
