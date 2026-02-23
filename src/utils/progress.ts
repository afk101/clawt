import {
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
  CURSOR_HIDE,
  CURSOR_SHOW,
  DEFAULT_TERMINAL_COLUMNS,
  LINE_WRAP_DISABLE,
  LINE_WRAP_ENABLE,
  SYNC_OUTPUT_START,
  SYNC_OUTPUT_END,
  ALT_SCREEN_ENTER,
  ALT_SCREEN_LEAVE,
  CLEAR_SCREEN,
  CURSOR_HOME,
  MESSAGES,
} from '../constants/index.js';
import { formatDuration } from './formatter.js';
import type { TaskProgress } from './progress-render.js';
import { getMaxPathWidth, renderTaskLine, renderSummaryLine, truncateToTerminalWidth } from './progress-render.js';

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
  /** resize 事件处理器引用（用于 stop 时移除监听） */
  private resizeHandler: (() => void) | null;
  /** 是否已停止 */
  private stopped: boolean;
  /** exit 兜底处理器（确保异常退出时终端状态被恢复） */
  private exitHandler: (() => void) | null;
  /** 是否存在排队任务（启用汇总行渲染） */
  private hasPendingTasks: boolean;

  /**
   * 创建进度面板渲染器
   * @param {string[]} branches - 分支名列表，顺序对应任务列表
   * @param {string[]} paths - worktree 路径列表，完成/失败后显示
   * @param {boolean} [allRunning=true] - 是否将所有任务初始化为 running 状态，false 时初始化为 pending
   */
  constructor(branches: string[], paths: string[], allRunning: boolean = true) {
    const now = Date.now();
    this.total = branches.length;
    this.frameIndex = 0;
    this.timer = null;
    this.isTTY = !!process.stdout.isTTY;
    this.resizeHandler = null;
    this.stopped = false;
    this.exitHandler = null;
    this.hasPendingTasks = !allRunning;

    this.tasks = branches.map((branch, i) => ({
      index: i + 1,
      branch,
      path: paths[i],
      status: allRunning ? 'running' : 'pending',
      startedAt: allRunning ? now : 0,
      finishedAt: null,
      lastActiveAt: allRunning ? now : 0,
      durationMs: null,
      costUsd: null,
      activity: null,
      resultPreview: null,
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
          console.log(MESSAGES.PROGRESS_TASK_STARTED(task.index, this.total, task.branch, task.path));
        }
      }
      return;
    }

    // TTY 模式：进入备选屏幕缓冲区，隐藏光标，禁用终端自动行换行
    process.stdout.write(ALT_SCREEN_ENTER);
    process.stdout.write(CURSOR_HIDE);
    process.stdout.write(LINE_WRAP_DISABLE);
    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
      this.render();
    }, SPINNER_INTERVAL_MS);

    // 确保定时器不阻止进程退出
    if (this.timer.unref) {
      this.timer.unref();
    }

    // 监听终端宽度变化，立即触发重绘
    this.resizeHandler = () => {
      if (!this.stopped) {
        this.render();
      }
    };
    process.stdout.on('resize', this.resizeHandler);

    // 注册 exit 兜底，确保异常退出时终端状态被恢复
    this.exitHandler = () => {
      process.stdout.write(LINE_WRAP_ENABLE);
      process.stdout.write(CURSOR_SHOW);
      process.stdout.write(ALT_SCREEN_LEAVE);
    };
    process.on('exit', this.exitHandler);
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
   * 更新指定任务的活动描述文本
   * 同时更新 lastActiveAt 时间戳
   * @param {number} index - 任务索引（从 0 开始）
   * @param {string} text - 活动描述文本
   */
  updateActivityText(index: number, text: string): void {
    const task = this.tasks[index];
    task.activity = text;
    task.lastActiveAt = Date.now();
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
      console.log(MESSAGES.PROGRESS_TASK_STARTED(task.index, this.total, task.branch, task.path));
    }
  }

  /**
   * 标记指定任务为完成状态
   * @param {number} index - 任务索引（从 0 开始）
   * @param {number} durationMs - 耗时（毫秒）
   * @param {number} costUsd - 费用（美元）
   * @param {string} [resultPreview] - 结果预览文本（可选）
   */
  markDone(index: number, durationMs: number, costUsd: number, resultPreview?: string): void {
    const task = this.tasks[index];
    task.status = 'done';
    task.finishedAt = Date.now();
    task.durationMs = durationMs;
    task.costUsd = costUsd;
    task.resultPreview = resultPreview ?? null;

    if (!this.isTTY) {
      // 非 TTY 降级：直接输出完成信息
      const duration = formatDuration(durationMs);
      const cost = `$${costUsd.toFixed(2)}`;
      console.log(MESSAGES.PROGRESS_TASK_DONE(task.index, this.total, task.branch, duration, cost, task.resultPreview ?? task.path));
    }
  }

  /**
   * 标记指定任务为失败状态
   * @param {number} index - 任务索引（从 0 开始）
   * @param {number} durationMs - 耗时（毫秒）
   * @param {string} [resultPreview] - 结果预览文本（可选）
   */
  markFailed(index: number, durationMs: number, resultPreview?: string): void {
    const task = this.tasks[index];
    task.status = 'failed';
    task.finishedAt = Date.now();
    task.durationMs = durationMs;
    task.resultPreview = resultPreview ?? null;

    if (!this.isTTY) {
      // 非 TTY 降级：直接输出失败信息
      const duration = formatDuration(durationMs);
      console.log(MESSAGES.PROGRESS_TASK_FAILED(task.index, this.total, task.branch, duration, task.resultPreview ?? task.path));
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

    // 移除终端 resize 监听
    if (this.resizeHandler) {
      process.stdout.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.isTTY) {
      // 最后在备选屏幕渲染一次，确保最终状态显示正确
      this.render();
      // 恢复终端自动行换行
      process.stdout.write(LINE_WRAP_ENABLE);
      // 恢复光标显示
      process.stdout.write(CURSOR_SHOW);
      // 退出备选屏幕缓冲区，恢复主屏幕内容
      process.stdout.write(ALT_SCREEN_LEAVE);

      // 在主屏幕上输出最终面板状态（备选屏幕内容不保留，需要重新输出）
      const cols = process.stdout.columns || DEFAULT_TERMINAL_COLUMNS;
      const finalLines = this.buildLines(cols);
      for (const line of finalLines) {
        process.stdout.write(`${line}\n`);
      }
    }

    // 移除 exit 兜底
    if (this.exitHandler) {
      process.removeListener('exit', this.exitHandler);
      this.exitHandler = null;
    }
  }

  /**
   * 构建当前帧的面板行内容
   * @param {number} cols - 终端列数
   * @returns {string[]} 截断后的面板行数组
   */
  private buildLines(cols: number): string[] {
    const maxPathWidth = getMaxPathWidth(this.tasks);
    const spinnerChar = SPINNER_FRAMES[this.frameIndex];
    const lines = this.tasks.map((task) => renderTaskLine(task, this.total, maxPathWidth, spinnerChar));

    // 存在排队任务时追加汇总行
    if (this.hasPendingTasks) {
      lines.push(renderSummaryLine(this.tasks, this.total));
    }

    return lines.map((line) => truncateToTerminalWidth(line, cols));
  }

  /**
   * 执行一次完整的面板渲染
   * 在备选屏幕缓冲区中，每次清屏+归位后完全重绘
   * 无需计算 CURSOR_UP 回退量，不受终端 reflow 影响
   * 使用 Synchronized Output 防止多行写入时的闪烁
   */
  private render(): void {
    const cols = process.stdout.columns || DEFAULT_TERMINAL_COLUMNS;
    const lines = this.buildLines(cols);

    // 开启同步输出（终端缓冲输出，关闭时一次性刷新，防止闪烁）
    process.stdout.write(SYNC_OUTPUT_START);

    // 备选屏幕无滚动缓冲区，直接清屏+归位即可，无需计算回退量
    process.stdout.write(CLEAR_SCREEN);
    process.stdout.write(CURSOR_HOME);

    // 逐行输出，按终端宽度截断
    for (const line of lines) {
      process.stdout.write(`${line}\n`);
    }

    // 关闭同步输出
    process.stdout.write(SYNC_OUTPUT_END);
  }
}
