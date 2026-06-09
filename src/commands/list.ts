import type { Command } from 'commander';
import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import type { ListOptions } from '../types/index.js';
import {
  runPreChecks,
  getProjectName,
  getProjectWorktrees,
  getWorktreeStatus,
  formatWorktreeStatus,
  isWorktreeIdle,
  printInfo,
} from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';
// getWorktreeStatus 和 formatWorktreeStatus 仅在文本模式下使用

/**
 * 格式化来源分支展示文本
 * @param {string | null} baseBranch - 来源分支
 * @returns {string} 来源分支展示文本
 */
function formatBaseBranchInline(baseBranch: string | null): string {
  const fallback = getCurrentLanguage() === 'en' ? 'Not recorded' : '未记录';
  return `<- ${baseBranch ?? fallback}`;
}

/**
 * 注册 list 命令：列出当前项目所有 worktree
 * @param {Command} program - Commander 实例
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description(getCurrentLanguage() === 'en' ? 'List all worktrees for the current project (supports --json output)' : '列出当前项目所有 worktree（支持 --json 格式输出）')
    .option('--json', getCurrentLanguage() === 'en' ? 'Output in JSON format' : '以 JSON 格式输出')
    .action(async (options: ListOptions) => {
      await handleList(options);
    });
}

/**
 * 执行 list 命令的核心逻辑
 * @param {ListOptions} options - 命令选项
 */
async function handleList(options: ListOptions): Promise<void> {
  await runPreChecks({ requireMainWorktree: true });

  const projectName = getProjectName();
  const worktrees = getProjectWorktrees();

  logger.info(`list 命令执行，项目: ${projectName}，共 ${worktrees.length} 个 worktree`);

  if (options.json) {
    printListAsJson(projectName, worktrees);
    return;
  }

  printListAsText(projectName, worktrees);
}

/**
 * 以 JSON 格式输出 worktree 列表（包含 path、branch 和 baseBranch）
 * @param {string} projectName - 项目名称
 * @param {import('../types/index.js').WorktreeInfo[]} worktrees - worktree 列表
 */
function printListAsJson(projectName: string, worktrees: import('../types/index.js').WorktreeInfo[]): void {
  const result = {
    project: projectName,
    total: worktrees.length,
    worktrees: worktrees.map((wt) => ({
      path: wt.path,
      branch: wt.branch,
      baseBranch: wt.baseBranch,
    })),
  };

  console.log(JSON.stringify(result, null, 2));
}

/**
 * 以文本格式输出 worktree 列表
 * @param {string} projectName - 项目名称
 * @param {import('../types/index.js').WorktreeInfo[]} worktrees - worktree 列表
 */
function printListAsText(projectName: string, worktrees: import('../types/index.js').WorktreeInfo[]): void {
  const lang = getCurrentLanguage();
  printInfo(`${lang === 'en' ? 'Current project' : '当前项目'}: ${projectName}\n`);

  if (worktrees.length === 0) {
    printInfo(`  ${MESSAGES.NO_WORKTREES}`);
  } else {
    for (const wt of worktrees) {
      // 获取并展示 worktree 变更状态
      const status = getWorktreeStatus(wt);

      // 空闲状态的 worktree 路径用橙色高亮，提示用户关注
      const isIdle = status ? isWorktreeIdle(status) : false;
      const pathDisplay = isIdle ? chalk.hex('#FF8C00')(wt.path) : wt.path;

      printInfo(`  ${pathDisplay}   [${wt.branch}]   ${formatBaseBranchInline(wt.baseBranch)}`);

      if (status) {
        printInfo(`    ${formatWorktreeStatus(status)}`);
      } else {
        printInfo(`    ${chalk.yellow(MESSAGES.WORKTREE_STATUS_UNAVAILABLE)}`);
      }

      printInfo('');
    }
    printInfo(`${worktrees.length} ${lang === 'en' ? 'worktree(s)' : '个 worktree'}`);
  }
}
