import type { Command } from 'commander';
import { MESSAGES } from '../constants/index.js';
import {
  runPreChecks,
  ensureOnMainWorkBranch,
  getCurrentBranch,
  getMainWorkBranch,
  isMainWorktree,
  isInsideGitRepo,
  getMainWorktreePath,
  printSuccess,
  printInfo,
  printHint,
  printError,
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
 * 三种场景：
 * 1. 不在 git 仓库中 → 报错
 * 2. 在子 worktree 中 → 输出提示和 cd 命令
 * 3. 在主 worktree 中 → 切换到主工作分支
 */
async function handleHome(): Promise<void> {
  // 场景 1：不在 git 仓库中，直接报错
  if (!isInsideGitRepo()) {
    printError(MESSAGES.NOT_GIT_REPO);
    return;
  }

  // 场景 2：在子 worktree 中，输出 cd 提示
  if (!isMainWorktree()) {
    const mainPath = getMainWorktreePath();
    printHint(MESSAGES.HOME_NOT_IN_MAIN_WORKTREE(mainPath));
    return;
  }

  // 场景 3：在主 worktree 中，切换到主工作分支
  await runPreChecks({ requireHead: true, requireProjectConfig: true, requireMainBranchExists: true });

  const mainBranch = getMainWorkBranch();
  const currentBranch = getCurrentBranch();

  if (currentBranch === mainBranch) {
    printInfo(MESSAGES.HOME_ALREADY_ON_MAIN(mainBranch));
    return;
  }

  await ensureOnMainWorkBranch();
  printSuccess(MESSAGES.HOME_SWITCH_SUCCESS(currentBranch, mainBranch));
}
