import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import {
  runPreChecks,
  getGitTopLevel,
  getConfigValue,
  isWorkingDirClean,
  gitResetHard,
  gitCleanForce,
  confirmDestructiveAction,
  printSuccess,
  printInfo,
} from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 注册 reset 命令：重置主 worktree 工作区和暂存区
 * @param {Command} program - Commander 实例
 */
export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description(getCurrentLanguage() === 'en' ? 'Reset main worktree working directory and staging area (preserves validate snapshots)' : '重置主 worktree 工作区和暂存区（保留 validate 快照）')
    .action(async () => {
      await handleReset();
    });
}

/**
 * 执行 reset 命令：重置主 worktree 工作区和暂存区
 */
async function handleReset(): Promise<void> {
  await runPreChecks({ requireMainWorktree: true, requireHead: true, requireProjectConfig: true });

  const mainWorktreePath = getGitTopLevel();
  logger.info('reset 命令执行');

  if (!isWorkingDirClean(mainWorktreePath)) {
    // 根据配置决定是否需要确认
    if (getConfigValue('confirmDestructiveOps')) {
      const confirmed = await confirmDestructiveAction(
        'git reset --hard + git clean -fd',
        getCurrentLanguage() === 'en' ? 'Discard all uncommitted changes' : '丢弃所有未提交的更改',
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
