import chalk from 'chalk';
import { TASK_STATUS_ICONS, TASK_STATUS_LABELS } from '../constants/index.js';
import { formatDuration } from './formatter.js';

/** 单个任务的进度状态 */
export interface TaskProgress {
  /** 任务序号（从 1 开始） */
  index: number;
  /** 分支名（用于显示） */
  branch: string;
  /** worktree 路径（完成/失败后显示，终端可点击跳转） */
  path: string;
  /** 任务状态 */
  status: 'pending' | 'running' | 'done' | 'failed';
  /** 任务启动时间戳 */
  startedAt: number;
  /** 任务完成时间戳 */
  finishedAt: number | null;
  /** 最后活动时间戳（stderr 有输出时更新） */
  lastActiveAt: number;
  /** 耗时（毫秒），完成后由 ClaudeCodeResult 填入 */
  durationMs: number | null;
  /** 费用（美元），完成后由 ClaudeCodeResult 填入 */
  costUsd: number | null;
}

/**
 * 计算分支名的最大显示宽度，用于对齐
 * @param {TaskProgress[]} tasks - 任务列表
 * @returns {number} 最大分支名长度
 */
export function getMaxBranchWidth(tasks: TaskProgress[]): number {
  return Math.max(...tasks.map((t) => t.branch.length));
}

/**
 * 渲染单个任务行（TTY 模式）
 * 格式: [1/3] feat-1  ⠹ 运行中 1m23s
 * 完成/失败后追加 worktree 路径，终端可点击跳转
 * @param {TaskProgress} task - 任务进度
 * @param {number} total - 总任务数
 * @param {number} maxBranchWidth - 分支名最大宽度（用于对齐）
 * @param {string} spinnerChar - 当前 spinner 帧字符
 * @returns {string} 渲染后的单行字符串（含 chalk 颜色）
 */
export function renderTaskLine(task: TaskProgress, total: number, maxBranchWidth: number, spinnerChar: string): string {
  const indexStr = `[${task.index}/${total}]`;
  const branchStr = task.branch.padEnd(maxBranchWidth);

  switch (task.status) {
    case 'pending': {
      return `${indexStr} ${branchStr}  ${chalk.gray(TASK_STATUS_ICONS.PENDING)} ${chalk.gray(TASK_STATUS_LABELS.PENDING)}  ${chalk.dim(task.path)}`;
    }
    case 'running': {
      const elapsed = formatDuration(Date.now() - task.startedAt);
      return `${indexStr} ${branchStr}  ${chalk.cyan(spinnerChar)} ${chalk.cyan(TASK_STATUS_LABELS.RUNNING)} ${chalk.gray(elapsed)}  ${chalk.dim(task.path)}`;
    }
    case 'done': {
      const duration = task.durationMs != null ? formatDuration(task.durationMs) : 'N/A';
      const cost = task.costUsd != null ? `$${task.costUsd.toFixed(2)}` : '';
      return `${indexStr} ${branchStr}  ${chalk.green(TASK_STATUS_ICONS.DONE)} ${chalk.green(TASK_STATUS_LABELS.DONE)}   ${chalk.gray(duration)}  ${chalk.yellow(cost)}  ${chalk.dim(task.path)}`;
    }
    case 'failed': {
      const duration = task.durationMs != null ? formatDuration(task.durationMs) : 'N/A';
      return `${indexStr} ${branchStr}  ${chalk.red(TASK_STATUS_ICONS.FAILED)} ${chalk.red(TASK_STATUS_LABELS.FAILED)}   ${chalk.gray(duration)}  ${chalk.dim(task.path)}`;
    }
  }
}

/**
 * 渲染汇总行，统计各状态的任务数
 * 格式: [2/8 运行中, 3/8 已完成, 3/8 排队中]
 * @param {TaskProgress[]} tasks - 任务列表
 * @param {number} total - 总任务数
 * @returns {string} 汇总行字符串
 */
export function renderSummaryLine(tasks: TaskProgress[], total: number): string {
  const running = tasks.filter((t) => t.status === 'running').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

  const parts: string[] = [];
  if (running > 0) parts.push(chalk.cyan(`${running}/${total} ${TASK_STATUS_LABELS.RUNNING}`));
  if (done > 0) parts.push(chalk.green(`${done}/${total} ${TASK_STATUS_LABELS.DONE}`));
  if (failed > 0) parts.push(chalk.red(`${failed}/${total} ${TASK_STATUS_LABELS.FAILED}`));
  if (pending > 0) parts.push(chalk.gray(`${pending}/${total} ${TASK_STATUS_LABELS.PENDING}`));

  return `[${parts.join(', ')}]`;
}
