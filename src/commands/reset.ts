import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import {
  validateMainWorktree,
  getGitTopLevel,
  isWorkingDirClean,
  gitResetHard,
  gitCleanForce,
  printSuccess,
  printInfo,
} from '../utils/index.js';

/**
 * 注册 reset 命令：重置主 worktree 工作区和暂存区
 * @param {Command} program - Commander 实例
 */
export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('重置主 worktree 工作区和暂存区（保留 validate 快照）')
    .action(() => {
      handleReset();
    });
}

/**
 * 执行 reset 命令：重置主 worktree 工作区和暂存区
 */
function handleReset(): void {
  validateMainWorktree();
  const mainWorktreePath = getGitTopLevel();
  logger.info('reset 命令执行');

  if (!isWorkingDirClean(mainWorktreePath)) {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
    printSuccess(MESSAGES.RESET_SUCCESS);
  } else {
    printInfo(MESSAGES.RESET_ALREADY_CLEAN);
  }
}
