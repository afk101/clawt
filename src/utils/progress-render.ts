import chalk from 'chalk';
import stringWidth from 'string-width';
import { TASK_STATUS_ICONS, TASK_STATUS_LABELS } from '../constants/index.js';
import { formatDuration } from './formatter.js';

/** ANSI 颜色/样式转义序列的匹配正则 */
const ANSI_ESCAPE_RE = /\x1B\[[0-9;]*m/g;

/** ANSI 样式重置序列，用于截断后关闭未闭合的颜色 */
const ANSI_RESET = '\x1B[0m';

/**
 * 将含 ANSI 转义码的字符串截断到指定可见宽度
 *
 * 逐字符遍历原始字符串，跳过 ANSI 序列不计入可见宽度，
 * 在可见宽度达到上限时截断并追加样式重置序列防止颜色泄漏。
 * @param {string} text - 可能含 ANSI 颜色码的字符串
 * @param {number} maxWidth - 终端可见列数上限
 * @returns {string} 截断后的字符串（不超过 maxWidth 可见列）
 */
export function truncateToTerminalWidth(text: string, maxWidth: number): string {
  // 快速路径：实际可见宽度未超限时直接返回
  if (stringWidth(text) <= maxWidth) {
    return text;
  }

  let visibleWidth = 0;
  let result = '';
  let i = 0;

  while (i < text.length) {
    // 检查当前位置是否是 ANSI 转义序列的起始
    if (text[i] === '\x1B' && text[i + 1] === '[') {
      // 匹配完整的 ANSI 序列（格式: ESC [ <数字;...> m）
      const match = text.slice(i).match(/^\x1B\[[0-9;]*m/);
      if (match) {
        // ANSI 序列不占可见宽度，直接保留
        result += match[0];
        i += match[0].length;
        continue;
      }
    }

    // 计算当前字符的可见宽度（中文/emoji 为 2，ASCII 为 1）
    const charWidth = stringWidth(text[i]);

    // 加上当前字符后是否会超出上限
    if (visibleWidth + charWidth > maxWidth) {
      break;
    }

    result += text[i];
    visibleWidth += charWidth;
    i++;
  }

  // 追加样式重置，防止截断后颜色泄漏到下一行
  return result + ANSI_RESET;
}

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
  /** 当前活动描述文本（仅 running 状态有效） */
  activity: string | null;
  /** 结果预览文本（完成/失败后显示） */
  resultPreview: string | null;
}

/**
 * 计算路径的最大显示宽度，用于对齐
 * @param {TaskProgress[]} tasks - 任务列表
 * @returns {number} 最大路径长度
 */
export function getMaxPathWidth(tasks: TaskProgress[]): number {
  return Math.max(...tasks.map((t) => t.path.length));
}

/**
 * 渲染单个任务行（TTY 模式）
 * 格式: [1/3] /path/to/worktree  ⠹ 运行中 1m23s
 * 完成/失败后末尾追加结果预览文本
 * @param {TaskProgress} task - 任务进度
 * @param {number} total - 总任务数
 * @param {number} maxPathWidth - 路径最大宽度（用于对齐）
 * @param {string} spinnerChar - 当前 spinner 帧字符
 * @returns {string} 渲染后的单行字符串（含 chalk 颜色）
 */
export function renderTaskLine(task: TaskProgress, total: number, maxPathWidth: number, spinnerChar: string): string {
  const indexStr = `[${task.index}/${total}]`;
  const pathStr = task.path.padEnd(maxPathWidth);

  switch (task.status) {
    case 'pending': {
      return `${indexStr} ${pathStr}  ${chalk.gray(TASK_STATUS_ICONS.PENDING)} ${chalk.gray(TASK_STATUS_LABELS.PENDING)}`;
    }
    case 'running': {
      const elapsed = formatDuration(Date.now() - task.startedAt);
      // 仅显示活动信息，不显示路径（路径已在第二列显示）
      const detail = task.activity ? `  ${chalk.dim(task.activity)}` : '';
      return `${indexStr} ${pathStr}  ${chalk.cyan(spinnerChar)} ${chalk.cyan(TASK_STATUS_LABELS.RUNNING)} ${chalk.gray(elapsed)}${detail}`;
    }
    case 'done': {
      const duration = task.durationMs != null ? formatDuration(task.durationMs) : 'N/A';
      const cost = task.costUsd != null ? `$${task.costUsd.toFixed(2)}` : '';
      const preview = task.resultPreview ? `  ${chalk.dim(task.resultPreview)}` : '';
      return `${indexStr} ${pathStr}  ${chalk.green(TASK_STATUS_ICONS.DONE)} ${chalk.green(TASK_STATUS_LABELS.DONE)}   ${chalk.gray(duration)}  ${chalk.yellow(cost)}${preview}`;
    }
    case 'failed': {
      const duration = task.durationMs != null ? formatDuration(task.durationMs) : 'N/A';
      const preview = task.resultPreview ? `  ${chalk.dim(task.resultPreview)}` : '';
      return `${indexStr} ${pathStr}  ${chalk.red(TASK_STATUS_ICONS.FAILED)} ${chalk.red(TASK_STATUS_LABELS.FAILED)}   ${chalk.gray(duration)}${preview}`;
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
