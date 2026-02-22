import chalk from 'chalk';
import {
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
  CURSOR_UP,
  CLEAR_LINE,
  CURSOR_HIDE,
  CURSOR_SHOW,
  TASK_STATUS_ICONS,
  TASK_STATUS_LABELS,
  MESSAGES,
} from '../constants/index.js';

/** 单个任务的进度状态 */
interface TaskProgress {
  /** 任务序号（从 1 开始） */
  index: number;
  /** 分支名（用于显示） */
  branch: string;
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
 * 将毫秒时长格式化为人类可读字符串
 * 小于 60s 显示秒数，大于等于 60s 显示 分m秒s
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时长字符串
 */
export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

/**
 * 计算分支名的最大显示宽度，用于对齐
 * @param {TaskProgress[]} tasks - 任务列表
 * @returns {number} 最大分支名长度
 */
function getMaxBranchWidth(tasks: TaskProgress[]): number {
  return Math.max(...tasks.map((t) => t.branch.length));
}

/**
 * 渲染单个任务行（TTY 模式）
 * 格式: [1/3] feat-1  ⠹ 运行中 1m23s
 * @param {TaskProgress} task - 任务进度
 * @param {number} total - 总任务数
 * @param {number} maxBranchWidth - 分支名最大宽度（用于对齐）
 * @param {string} spinnerChar - 当前 spinner 帧字符
 * @returns {string} 渲染后的单行字符串（含 chalk 颜色）
 */
function renderTaskLine(task: TaskProgress, total: number, maxBranchWidth: number, spinnerChar: string): string {
  const indexStr = `[${task.index}/${total}]`;
  const branchStr = task.branch.padEnd(maxBranchWidth);

  switch (task.status) {
    case 'pending': {
      return `${indexStr} ${branchStr}  ${chalk.gray(TASK_STATUS_ICONS.PENDING)} ${chalk.gray(TASK_STATUS_LABELS.PENDING)}`;
    }
    case 'running': {
      const elapsed = formatDuration(Date.now() - task.startedAt);
      return `${indexStr} ${branchStr}  ${chalk.cyan(spinnerChar)} ${chalk.cyan(TASK_STATUS_LABELS.RUNNING)} ${chalk.gray(elapsed)}`;
    }
    case 'done': {
      const duration = task.durationMs != null ? formatDuration(task.durationMs) : 'N/A';
      const cost = task.costUsd != null ? `$${task.costUsd.toFixed(2)}` : '';
      return `${indexStr} ${branchStr}  ${chalk.green(TASK_STATUS_ICONS.DONE)} ${chalk.green(TASK_STATUS_LABELS.DONE)}   ${chalk.gray(duration)}  ${chalk.yellow(cost)}`;
    }
    case 'failed': {
      const duration = task.durationMs != null ? formatDuration(task.durationMs) : 'N/A';
      return `${indexStr} ${branchStr}  ${chalk.red(TASK_STATUS_ICONS.FAILED)} ${chalk.red(TASK_STATUS_LABELS.FAILED)}   ${chalk.gray(duration)}`;
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
function renderSummaryLine(tasks: TaskProgress[], total: number): string {
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

/**
 * 任务进度面板渲染器
 *
 * 职责：协调任务状态管理与终端渲染
 * - TTY 模式：使用 ANSI 转义码实现原地多行刷新
 * - 非 TTY 模式：降级为逐行输出，不使用 ANSI 转义
 */
export class ProgressRenderer {
  /** 所有任务的进度状态 */
  private tasks: TaskProgress[];
  /** 总任务数 */
  private total: number;
  /** 当前 spinner 帧索引 */
  private frameIndex: number;
  /** 定时器引用 */
  private timer: ReturnType<typeof setInterval> | null;
  /** 是否为 TTY 环境 */
  private isTTY: boolean;
  /** 已渲染的行数（用于回退光标） */
  private renderedLineCount: number;
  /** 是否已停止 */
  private stopped: boolean;
  /** 是否存在排队任务（启用汇总行渲染） */
  private hasPendingTasks: boolean;

  /**
   * 创建进度面板渲染器
   * @param {string[]} branches - 分支名列表，顺序对应任务列表
   * @param {boolean} [allRunning=true] - 是否将所有任务初始化为 running 状态，false 时初始化为 pending
   */
  constructor(branches: string[], allRunning: boolean = true) {
    const now = Date.now();
    this.total = branches.length;
    this.frameIndex = 0;
    this.timer = null;
    this.isTTY = !!process.stdout.isTTY;
    this.renderedLineCount = 0;
    this.stopped = false;
    this.hasPendingTasks = !allRunning;

    this.tasks = branches.map((branch, i) => ({
      index: i + 1,
      branch,
      status: allRunning ? 'running' : 'pending',
      startedAt: allRunning ? now : 0,
      finishedAt: null,
      lastActiveAt: allRunning ? now : 0,
      durationMs: null,
      costUsd: null,
    }));
  }

  /**
   * 启动定时渲染循环
   * TTY 模式下每 SPINNER_INTERVAL_MS 毫秒刷新一次面板
   * 非 TTY 模式下输出状态为 running 的任务的启动信息
   */
  start(): void {
    if (this.stopped) return;

    if (!this.isTTY) {
      // 非 TTY 降级：仅输出已为 running 的任务的启动信息
      for (const task of this.tasks) {
        if (task.status === 'running') {
          console.log(MESSAGES.PROGRESS_TASK_STARTED(task.index, this.total, task.branch));
        }
      }
      return;
    }

    // TTY 模式：隐藏光标，启动定时刷新
    process.stdout.write(CURSOR_HIDE);
    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
      this.render();
    }, SPINNER_INTERVAL_MS);

    // 确保定时器不阻止进程退出
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * 更新指定任务的最后活动时间戳
   * 当 child.stderr 有输出时调用，表示任务仍然活跃
   * @param {number} index - 任务索引（从 0 开始）
   */
  updateActivity(index: number): void {
    this.tasks[index].lastActiveAt = Date.now();
  }

  /**
   * 标记指定任务为运行中状态
   * 将 pending 任务标记为 running 并设置启动时间戳
   * @param {number} index - 任务索引（从 0 开始）
   */
  markRunning(index: number): void {
    const task = this.tasks[index];
    const now = Date.now();
    task.status = 'running';
    task.startedAt = now;
    task.lastActiveAt = now;

    if (!this.isTTY) {
      // 非 TTY 降级：输出启动信息
      console.log(MESSAGES.PROGRESS_TASK_STARTED(task.index, this.total, task.branch));
    }
  }

  /**
   * 标记指定任务为完成状态
   * @param {number} index - 任务索引（从 0 开始）
   * @param {number} durationMs - 耗时（毫秒）
   * @param {number} costUsd - 费用（美元）
   */
  markDone(index: number, durationMs: number, costUsd: number): void {
    const task = this.tasks[index];
    task.status = 'done';
    task.finishedAt = Date.now();
    task.durationMs = durationMs;
    task.costUsd = costUsd;

    if (!this.isTTY) {
      // 非 TTY 降级：直接输出完成信息
      const duration = formatDuration(durationMs);
      const cost = `$${costUsd.toFixed(2)}`;
      console.log(MESSAGES.PROGRESS_TASK_DONE(task.index, this.total, task.branch, duration, cost));
    }
  }

  /**
   * 标记指定任务为失败状态
   * @param {number} index - 任务索引（从 0 开始）
   * @param {number} durationMs - 耗时（毫秒）
   */
  markFailed(index: number, durationMs: number): void {
    const task = this.tasks[index];
    task.status = 'failed';
    task.finishedAt = Date.now();
    task.durationMs = durationMs;

    if (!this.isTTY) {
      // 非 TTY 降级：直接输出失败信息
      const duration = formatDuration(durationMs);
      console.log(MESSAGES.PROGRESS_TASK_FAILED(task.index, this.total, task.branch, duration));
    }
  }

  /**
   * 停止渲染循环并恢复光标
   * 在所有任务完成或 SIGINT 中断时调用
   */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.isTTY) {
      // 最后渲染一次，确保最终状态显示正确
      this.render();
      // 恢复光标显示
      process.stdout.write(CURSOR_SHOW);
    }
  }

  /**
   * 执行一次完整的面板渲染
   * 先回退光标到面板起始位置，再逐行输出
   */
  private render(): void {
    const maxBranchWidth = getMaxBranchWidth(this.tasks);
    const spinnerChar = SPINNER_FRAMES[this.frameIndex];
    const lines = this.tasks.map((task) => renderTaskLine(task, this.total, maxBranchWidth, spinnerChar));

    // 存在排队任务时追加汇总行
    if (this.hasPendingTasks) {
      lines.push(renderSummaryLine(this.tasks, this.total));
    }

    // 回退光标到面板起始位置
    if (this.renderedLineCount > 0) {
      process.stdout.write(CURSOR_UP(this.renderedLineCount));
    }

    // 逐行输出，每行末尾清除残留字符
    for (const line of lines) {
      process.stdout.write(`${line}${CLEAR_LINE}\n`);
    }

    this.renderedLineCount = lines.length;
  }
}
