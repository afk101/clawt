import chalk from 'chalk';
import { join } from 'node:path';
import { MESSAGES } from '../constants/index.js';
import { checkBranchExists } from './git.js';
import { getProjectWorktreeDir } from './worktree.js';
import { printInfo, printDoubleSeparator, printSeparator } from './formatter.js';

/** dry-run 模式下任务描述的最大显示长度 */
const DRY_RUN_TASK_DESC_MAX_LENGTH = 80;

/**
 * 截取任务描述，超出最大长度时末尾加省略号
 * 多行内容会被合并为单行显示
 * @param {string} task - 原始任务描述
 * @returns {string} 截取后的任务描述
 */
export function truncateTaskDesc(task: string): string {
  // 将换行替换为空格，保证单行显示
  const oneLine = task.replace(/\n/g, ' ').trim();
  if (oneLine.length <= DRY_RUN_TASK_DESC_MAX_LENGTH) {
    return oneLine;
  }
  return oneLine.slice(0, DRY_RUN_TASK_DESC_MAX_LENGTH) + '...';
}

/**
 * 输出 dry-run 预览信息，展示将要创建的 worktree 列表和任务摘要
 * @param {string[]} branchNames - 分支名列表
 * @param {string[]} tasks - 任务描述列表（与 branchNames 等长，交互式模式可为空数组）
 * @param {number} concurrency - 并发数
 */
export function printDryRunPreview(branchNames: string[], tasks: string[], concurrency: number): void {
  const projectDir = getProjectWorktreeDir();
  const isInteractive = tasks.length === 0;

  // 标题区
  printDoubleSeparator();
  printInfo(`  ${chalk.bold(MESSAGES.DRY_RUN_TITLE)}`);
  printDoubleSeparator();

  // 摘要行：合并为一行，用 │ 分隔
  const summaryParts = [
    MESSAGES.DRY_RUN_TASK_COUNT(branchNames.length),
    MESSAGES.DRY_RUN_CONCURRENCY(concurrency),
    MESSAGES.DRY_RUN_WORKTREE_DIR(projectDir),
  ];
  if (isInteractive) {
    summaryParts.push(MESSAGES.DRY_RUN_INTERACTIVE_MODE);
  }
  printInfo(summaryParts.join(chalk.gray(' │ ')));

  printSeparator();

  // 逐个展示 worktree 信息
  let hasConflict = false;
  for (let i = 0; i < branchNames.length; i++) {
    const branch = branchNames[i];
    const worktreePath = join(projectDir, branch);
    const exists = checkBranchExists(branch);

    if (exists) hasConflict = true;

    // 序号行：正常用绿色 ✓，冲突用黄色 ⚠ + 警告文本
    const indexLabel = `[${i + 1}/${branchNames.length}]`;
    if (exists) {
      printInfo(`${chalk.yellow('⚠')} ${indexLabel} ${chalk.yellow(branch)} ${chalk.gray('—')} ${chalk.yellow(MESSAGES.DRY_RUN_BRANCH_EXISTS_WARNING(branch))}`);
    } else {
      printInfo(`${chalk.green('✓')} ${indexLabel} ${chalk.cyan(branch)}`);
    }

    // 路径行（2空格缩进）
    printInfo(`  ${chalk.gray(MESSAGES.PATH_LABEL)} ${worktreePath}`);

    // 任务描述行（2空格缩进，非交互式模式）
    if (!isInteractive) {
      printInfo(`  ${chalk.gray(MESSAGES.TASK_LABEL)} ${truncateTaskDesc(tasks[i])}`);
    }

    printInfo('');
  }

  // 结尾
  printDoubleSeparator();
  if (hasConflict) {
    printInfo(chalk.yellow(`⚠ ${MESSAGES.DRY_RUN_HAS_CONFLICT}`));
  } else {
    printInfo(chalk.green(`✓ ${MESSAGES.DRY_RUN_READY}`));
  }
}
