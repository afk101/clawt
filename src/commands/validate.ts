import type { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { select } from '@inquirer/prompts';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ValidateOptions } from '../types/index.js';
import {
  validateMainWorktree,
  getProjectName,
  getGitTopLevel,
  getProjectWorktreeDir,
  isWorkingDirClean,
  gitAddAll,
  gitStashPush,
  gitStashApply,
  gitStashPop,
  gitStashList,
  gitRestoreStaged,
  gitResetHard,
  gitCleanForce,
  getStatusPorcelain,
  printSuccess,
  printError,
  printWarning,
  printInfo,
} from '../utils/index.js';

/**
 * 注册 validate 命令：在主 worktree 验证其他分支的变更
 * @param {Command} program - Commander 实例
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('在主 worktree 验证某个 worktree 分支的变更')
    .requiredOption('-b, --branch <branchName>', '要验证的分支名')
    .action(async (options: ValidateOptions) => {
      await handleValidate(options);
    });
}

/**
 * 处理主 worktree 工作区有未提交更改的情况
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function handleDirtyMainWorktree(mainWorktreePath: string): Promise<void> {
  printWarning('主 worktree 当前分支有未提交的更改，请选择处理方式：\n');

  const choice = await select({
    message: '选择处理方式',
    choices: [
      {
        name: 'reset (推荐) - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)',
        value: 'reset',
      },
      {
        name: 'stash        - 暂存更改 (git add . && git stash)',
        value: 'stash',
      },
      {
        name: 'exit         - 退出，手动处理',
        value: 'exit',
      },
    ],
    default: 'reset',
  });

  if (choice === 'exit') {
    throw new ClawtError('用户选择退出');
  }

  if (choice === 'reset') {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  } else if (choice === 'stash') {
    gitAddAll(mainWorktreePath);
    gitStashPush('clawt:auto-stash', mainWorktreePath);
  }

  // 再次检查是否干净
  if (!isWorkingDirClean(mainWorktreePath)) {
    throw new ClawtError('工作区仍然不干净，请手动处理');
  }
}

/**
 * 执行 validate 命令的核心逻辑
 * @param {ValidateOptions} options - 命令选项
 */
async function handleValidate(options: ValidateOptions): Promise<void> {
  validateMainWorktree();

  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();
  const projectDir = getProjectWorktreeDir();
  const targetWorktreePath = join(projectDir, options.branch);

  logger.info(`validate 命令执行，分支: ${options.branch}`);

  // 检查目标 worktree 是否存在
  if (!existsSync(targetWorktreePath)) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(options.branch));
  }

  // 步骤 1：检测主 worktree 工作区状态
  if (!isWorkingDirClean(mainWorktreePath)) {
    await handleDirtyMainWorktree(mainWorktreePath);
  }

  // 步骤 2：在目标 worktree 中创建 stash
  if (isWorkingDirClean(targetWorktreePath)) {
    printInfo(MESSAGES.TARGET_WORKTREE_CLEAN);
    return;
  }

  const stashMessage = `clawt:validate:${options.branch}`;
  gitAddAll(targetWorktreePath);
  gitStashPush(stashMessage, targetWorktreePath);
  gitStashApply(targetWorktreePath);
  gitRestoreStaged(targetWorktreePath);

  // 步骤 3：在主 worktree 应用 stash
  const stashList = gitStashList(mainWorktreePath);
  const firstLine = stashList.split('\n')[0] || '';

  if (!firstLine.includes(stashMessage)) {
    throw new ClawtError(MESSAGES.STASH_CHANGED);
  }

  gitStashPop(0, mainWorktreePath);

  // 步骤 4：输出成功提示
  printSuccess(MESSAGES.VALIDATE_SUCCESS(options.branch));
}
