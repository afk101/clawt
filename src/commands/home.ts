import type { Command } from 'commander';
import { MESSAGES } from '../constants/index.js';
import {
  runPreChecks,
  ensureOnMainWorkBranch,
  getCurrentBranch,
  getMainWorkBranch,
  printSuccess,
  printInfo,
  guardMainWorkBranchExists,
} from '../utils/index.js';

/**
 * 注册 home 命令：快速切换回主工作分支
 * @param {Command} program - Commander 实例
 */
export function registerHomeCommand(program: Command): void {
  program
    .command('home')
    .description('切换回主工作分支')
    .action(async () => {
      await handleHome();
    });
}

/**
 * 执行 home 命令：切换回主工作分支
 */
async function handleHome(): Promise<void> {
  await runPreChecks({ requireMainWorktree: true, requireHead: true, requireProjectConfig: true, requireMainBranchExists: true });

  const mainBranch = getMainWorkBranch();
  const currentBranch = getCurrentBranch();

  if (currentBranch === mainBranch) {
    printInfo(MESSAGES.HOME_ALREADY_ON_MAIN(mainBranch));
    return;
  }

  await ensureOnMainWorkBranch();
  printSuccess(MESSAGES.HOME_SWITCH_SUCCESS(currentBranch, mainBranch));
}
