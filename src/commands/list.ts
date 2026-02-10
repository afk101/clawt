import type { Command } from 'commander';
import { MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import {
  validateMainWorktree,
  getProjectName,
  getProjectWorktrees,
  printInfo,
} from '../utils/index.js';

/**
 * 注册 list 命令：列出当前项目所有 worktree
 * @param {Command} program - Commander 实例
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('列出当前项目所有 worktree')
    .action(() => {
      handleList();
    });
}

/**
 * 执行 list 命令的核心逻辑
 */
function handleList(): void {
  validateMainWorktree();

  const projectName = getProjectName();
  const worktrees = getProjectWorktrees();

  logger.info(`list 命令执行，项目: ${projectName}，共 ${worktrees.length} 个 worktree`);

  printInfo(`当前项目: ${projectName}\n`);

  if (worktrees.length === 0) {
    printInfo(`  ${MESSAGES.NO_WORKTREES}`);
  } else {
    for (const wt of worktrees) {
      printInfo(`  ${wt.path}   [${wt.branch}]`);
    }
    printInfo(`\n共 ${worktrees.length} 个 worktree`);
  }
}
