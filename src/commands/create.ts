import type { Command } from 'commander';
import { MESSAGES, EXIT_CODES } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import type { CreateOptions } from '../types/index.js';
import { PRE_CHECK_CREATE } from '../constants/index.js';
import {
  runPreChecks,
  createWorktrees,
  getValidateBranchName,
  printSuccess,
  printInfo,
  printSeparator,
  runPostCreateHooks,
} from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 注册 create 命令：批量创建 worktree 及对应分支（含验证分支）
 * @param {Command} program - Commander 实例
 */
export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description(getCurrentLanguage() === 'en' ? 'Batch create worktrees and corresponding branches (including validation branches)' : '批量创建 worktree 及对应分支（含验证分支）')
    .requiredOption('-b, --branch <branchName>', getCurrentLanguage() === 'en' ? 'Branch name' : '分支名')
    .option('-n, --number <count>', getCurrentLanguage() === 'en' ? 'Number of worktrees to create' : '创建数量', '1')
    .option('--post-create', getCurrentLanguage() === 'en' ? 'Execute postCreate hook (enabled by default, use --no-post-create to skip)' : '执行 postCreate hook（默认开启，--no-post-create 跳过）', true)
    .action(async (options: CreateOptions) => {
      await handleCreate(options);
    });
}

/**
 * 执行 create 命令的核心逻辑
 * @param {CreateOptions} options - 命令选项
 */
async function handleCreate(options: CreateOptions): Promise<void> {
  await runPreChecks(PRE_CHECK_CREATE);

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

  // 执行 postCreate hook
  runPostCreateHooks(worktrees, !options.postCreate);

  printSuccess(MESSAGES.WORKTREE_CREATED(worktrees.length));
  printInfo('');

  worktrees.forEach((wt, index) => {
    printInfo(getCurrentLanguage() === 'en' ? `Directory path ${index + 1}:` : `目录路径${index + 1}：`);
    printInfo(`  ${wt.path}`);
    printInfo(getCurrentLanguage() === 'en' ? `  Branch: ${wt.branch}` : `  分支名: ${wt.branch}`);
    printInfo(getCurrentLanguage() === 'en' ? `  Validation branch: ${getValidateBranchName(wt.branch)}` : `  验证分支: ${getValidateBranchName(wt.branch)}`);
    printSeparator();
  });
}
