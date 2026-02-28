import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import {
  validateMainWorktree,
  getGitTopLevel,
  getConfigValue,
  isWorkingDirClean,
  gitResetHard,
  gitCleanForce,
  confirmDestructiveAction,
  printSuccess,
  printInfo,
  requireProjectConfig,
} from '../utils/index.js';

/**
 * 注册 reset 命令：重置主 worktree 工作区和暂存区
 * @param {Command} program - Commander 实例
 */
export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('重置主 worktree 工作区和暂存区（保留 validate 快照）')
    .action(async () => {
      await handleReset();
    });
}

/**
 * 执行 reset 命令：重置主 worktree 工作区和暂存区
 */
async function handleReset(): Promise<void> {
  validateMainWorktree();
  requireProjectConfig();

  const mainWorktreePath = getGitTopLevel();
  logger.info('reset 命令执行');

  if (!isWorkingDirClean(mainWorktreePath)) {
    // 根据配置决定是否需要确认
    if (getConfigValue('confirmDestructiveOps')) {
      const confirmed = await confirmDestructiveAction(
        'git reset --hard + git clean -fd',
        '丢弃所有未提交的更改',
      );
      if (!confirmed) {
        printInfo(MESSAGES.DESTRUCTIVE_OP_CANCELLED);
        return;
      }
    }

    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
    printSuccess(MESSAGES.RESET_SUCCESS);
  } else {
    printInfo(MESSAGES.RESET_ALREADY_CLEAN);
  }
}
