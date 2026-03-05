import { createInterface } from 'node:readline';
import {
  CURSOR_HIDE,
  CURSOR_SHOW,
  LINE_WRAP_DISABLE,
  LINE_WRAP_ENABLE,
  SYNC_OUTPUT_START,
  SYNC_OUTPUT_END,
  ALT_SCREEN_ENTER,
  ALT_SCREEN_LEAVE,
  CLEAR_SCREEN,
  CURSOR_HOME,
  DEFAULT_TERMINAL_COLUMNS,
  PANEL_REFRESH_INTERVAL_MS,
  PANEL_COUNTDOWN_INTERVAL_MS,
  KEY_ARROW_UP,
  KEY_ARROW_DOWN,
  KEY_CTRL_C,
  PANEL_SHORTCUT_KEYS,
} from '../constants/index.js';
import { PANEL_NOT_TTY, PANEL_PRESS_ENTER_TO_RETURN } from '../constants/messages/index.js';
import { runCommandInherited } from './shell.js';
import { buildPanelFrame, buildGroupedWorktreeLines, buildDisplayOrder, calculateVisibleRows } from './interactive-panel-render.js';
import { truncateToTerminalWidth } from './progress-render.js';
import type { StatusResult } from '../types/index.js';

/**
 * 交互式状态面板
 *
 * 提供实时刷新的 TUI 面板，支持键盘导航和快捷键操作。
 * 参照 ProgressRenderer 的生命周期模式实现。
 */
export class InteractivePanel {
  /** 当前状态数据 */
  private statusResult: StatusResult | null;
  /** 当前选中的显示位置索引（对应 displayOrder 数组的下标） */
  private selectedDisplayIndex: number;
  /** 显示顺序到原始索引的映射（按日期分组后的排列顺序） */
  private displayOrder: number[];
  /** 滚动偏移（基于行数） */
  private scrollOffset: number;
  /** 数据刷新定时器引用 */
  private refreshTimer: ReturnType<typeof setInterval> | null;
  /** 倒计时定时器引用 */
  private countdownTimer: ReturnType<typeof setInterval> | null;
  /** 刷新倒计时剩余秒数 */
  private refreshCountdown: number;
  /** 是否已停止 */
  private stopped: boolean;
  /** 是否为 TTY 环境 */
  private isTTY: boolean;
  /** resize 事件处理器引用 */
  private resizeHandler: (() => void) | null;
  /** exit 兜底处理器 */
  private exitHandler: (() => void) | null;
  /** stdin 数据处理器引用（用于清理） */
  private stdinDataHandler: ((data: Buffer) => void) | null;
  /** 操作锁（防止操作期间响应按键） */
  private isOperating: boolean;
  /** Promise resolve 函数（stop 时调用以完成 start 返回的 Promise） */
  private resolveStart: (() => void) | null;
  /** 数据收集函数引用 */
  private collectStatusFn: () => StatusResult;

  /**
   * 创建交互式面板
   * @param {() => StatusResult} collectStatusFn - 数据收集函数
   */
  constructor(collectStatusFn: () => StatusResult) {
    this.statusResult = null;
    this.selectedDisplayIndex = 0;
    this.displayOrder = [];
    this.scrollOffset = 0;
    this.refreshTimer = null;
    this.countdownTimer = null;
    this.refreshCountdown = PANEL_REFRESH_INTERVAL_MS / 1000;
    this.stopped = false;
    this.isTTY = !!process.stdout.isTTY;
    this.resizeHandler = null;
    this.exitHandler = null;
    this.stdinDataHandler = null;
    this.isOperating = false;
    this.resolveStart = null;
    this.collectStatusFn = collectStatusFn;
  }

  /**
   * 启动交互式面板
   * 非 TTY 时打印提示并退出
   * @returns {Promise<void>} 面板关闭时 resolve
   */
  start(): Promise<void> {
    // 非 TTY 降级
    if (!this.isTTY) {
      console.log(PANEL_NOT_TTY);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.resolveStart = resolve;

      // 收集初始数据
      this.statusResult = this.collectStatusFn();
      this.displayOrder = buildDisplayOrder(this.statusResult.worktrees);

      // 初始化终端
      this.initTerminal();

      // 启动键盘监听
      this.startKeyboardListener();

      // 启动自动刷新
      this.startAutoRefresh();

      // 首次渲染
      this.render();
    });
  }

  /**
   * 停止面板，恢复终端状态
   */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    // 停止定时器
    this.clearTimers();

    // 停止键盘监听
    this.stopKeyboardListener();

    // 恢复终端
    this.restoreTerminal();

    // 移除 resize 监听
    if (this.resizeHandler) {
      process.stdout.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // 移除 exit 兜底
    if (this.exitHandler) {
      process.removeListener('exit', this.exitHandler);
      this.exitHandler = null;
    }

    // 完成 Promise
    if (this.resolveStart) {
      this.resolveStart();
      this.resolveStart = null;
    }
  }

  /**
   * 初始化终端：进入备选屏幕、隐藏光标、禁用行换行
   */
  private initTerminal(): void {
    process.stdout.write(ALT_SCREEN_ENTER);
    process.stdout.write(CURSOR_HIDE);
    process.stdout.write(LINE_WRAP_DISABLE);

    // 监听终端宽度变化，立即触发重绘
    this.resizeHandler = () => {
      if (!this.stopped && !this.isOperating) {
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
   * 恢复终端：启用行换行、显示光标、退出备选屏幕
   */
  private restoreTerminal(): void {
    process.stdout.write(LINE_WRAP_ENABLE);
    process.stdout.write(CURSOR_SHOW);
    process.stdout.write(ALT_SCREEN_LEAVE);
  }

  /**
   * 启动键盘监听
   * 将 stdin 设为 raw 模式以捕获每个按键
   */
  private startKeyboardListener(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    this.stdinDataHandler = (data: Buffer) => {
      this.handleKeypress(data);
    };
    process.stdin.on('data', this.stdinDataHandler);
  }

  /**
   * 停止键盘监听，恢复 stdin 状态
   */
  private stopKeyboardListener(): void {
    if (this.stdinDataHandler) {
      process.stdin.removeListener('data', this.stdinDataHandler);
      this.stdinDataHandler = null;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }

  /**
   * 处理键盘输入
   * @param {Buffer} data - 按键数据
   */
  private handleKeypress(data: Buffer): void {
    // 操作锁期间不响应按键
    if (this.isOperating) return;

    const str = data.toString();

    // Ctrl+C
    if (data[0] === KEY_CTRL_C) {
      this.stop();
      return;
    }

    // 方向键上
    if (str === KEY_ARROW_UP) {
      this.navigateUp();
      return;
    }

    // 方向键下
    if (str === KEY_ARROW_DOWN) {
      this.navigateDown();
      return;
    }

    // 单字符快捷键
    const key = str.toLowerCase();

    if (key === PANEL_SHORTCUT_KEYS.QUIT) {
      this.stop();
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.REFRESH) {
      this.refreshData();
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.VALIDATE) {
      this.executeOperation(() => this.handleValidate());
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.MERGE) {
      this.executeOperation(() => this.handleMerge());
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.DELETE) {
      this.executeOperation(() => this.handleDelete());
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.RESUME) {
      this.executeOperation(() => this.handleResume());
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.SYNC) {
      this.executeOperation(() => this.handleSync());
      return;
    }

    if (key === PANEL_SHORTCUT_KEYS.COVER) {
      this.executeOperation(() => this.handleCover());
      return;
    }
  }

  /**
   * 向上导航，选中显示顺序中的上一个 worktree
   */
  private navigateUp(): void {
    if (!this.statusResult || this.displayOrder.length === 0) return;

    if (this.selectedDisplayIndex > 0) {
      this.selectedDisplayIndex--;
      this.adjustScrollForSelection();
      this.render();
    }
  }

  /**
   * 向下导航，选中显示顺序中的下一个 worktree
   */
  private navigateDown(): void {
    if (!this.statusResult || this.displayOrder.length === 0) return;

    if (this.selectedDisplayIndex < this.displayOrder.length - 1) {
      this.selectedDisplayIndex++;
      this.adjustScrollForSelection();
      this.render();
    }
  }

  /**
   * 获取当前选中的原始 worktree 索引
   * @returns {number} 原始 worktrees 数组中的索引
   */
  private getSelectedOriginalIndex(): number {
    return this.displayOrder[this.selectedDisplayIndex];
  }

  /**
   * 调整滚动偏移以确保选中项在可见区域内
   */
  private adjustScrollForSelection(): void {
    if (!this.statusResult || this.displayOrder.length === 0) return;

    const originalIndex = this.getSelectedOriginalIndex();
    const rows = process.stdout.rows || 24;
    const visibleRows = calculateVisibleRows(rows);
    const panelLines = buildGroupedWorktreeLines(this.statusResult.worktrees, originalIndex);

    // 找到选中 worktree 对应的第一行和最后一行
    let firstLine = -1;
    let lastLine = -1;
    for (let i = 0; i < panelLines.length; i++) {
      if (panelLines[i].worktreeIndex === originalIndex) {
        if (firstLine === -1) firstLine = i;
        lastLine = i;
      }
    }

    if (firstLine === -1) return;

    // 向前查找该 worktree 所属日期分组的分隔线行，滚动时一并显示
    let groupStart = firstLine;
    while (groupStart > 0 && panelLines[groupStart - 1].type === 'separator') {
      groupStart--;
    }

    // 如果选中项（含日期分隔线）在可见区域之上，向上滚动
    if (groupStart < this.scrollOffset) {
      this.scrollOffset = groupStart;
    }

    // 如果选中项的最后一行在可见区域之下，向下滚动
    if (lastLine >= this.scrollOffset + visibleRows) {
      this.scrollOffset = lastLine - visibleRows + 1;
    }

    // 终端极小时向下滚动可能把日期分组标题推出屏幕，优先保证分组标题可见
    if (this.scrollOffset > groupStart) {
      this.scrollOffset = groupStart;
    }
  }

  /**
   * 启动自动刷新：数据刷新定时器 + 倒计时定时器
   */
  private startAutoRefresh(): void {
    this.refreshCountdown = PANEL_REFRESH_INTERVAL_MS / 1000;

    // 数据刷新定时器
    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, PANEL_REFRESH_INTERVAL_MS);

    // 倒计时定时器（每秒更新显示）
    this.countdownTimer = setInterval(() => {
      if (this.refreshCountdown > 0) {
        this.refreshCountdown--;
      }
      this.render();
    }, PANEL_COUNTDOWN_INTERVAL_MS);

    // 确保定时器不阻止进程退出
    if (this.refreshTimer.unref) this.refreshTimer.unref();
    if (this.countdownTimer.unref) this.countdownTimer.unref();
  }

  /**
   * 清除所有定时器
   */
  private clearTimers(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  /**
   * 刷新数据：记录当前选中分支 → 重新收集 → 恢复选中位置 → 重置倒计时 → 重绘
   */
  private refreshData(): void {
    if (this.stopped || this.isOperating) return;

    // 记录当前选中分支名
    const originalIndex = this.displayOrder[this.selectedDisplayIndex];
    const previousBranch = this.statusResult?.worktrees[originalIndex]?.branch;

    // 重新收集数据
    this.statusResult = this.collectStatusFn();
    this.displayOrder = buildDisplayOrder(this.statusResult.worktrees);

    // 恢复选中位置
    this.restoreSelection(previousBranch);

    // 重置倒计时
    this.refreshCountdown = PANEL_REFRESH_INTERVAL_MS / 1000;

    this.render();
  }

  /**
   * 按分支名恢复选中位置（基于显示顺序）
   * @param {string | undefined} previousBranch - 之前选中的分支名
   */
  private restoreSelection(previousBranch: string | undefined): void {
    if (!this.statusResult || !previousBranch || this.displayOrder.length === 0) {
      this.selectedDisplayIndex = 0;
      return;
    }

    // 在显示顺序中查找之前选中的分支
    const newDisplayIndex = this.displayOrder.findIndex(
      (origIdx) => this.statusResult!.worktrees[origIdx]?.branch === previousBranch,
    );
    if (newDisplayIndex >= 0) {
      this.selectedDisplayIndex = newDisplayIndex;
    } else {
      // 分支已不存在，调整到安全范围
      this.selectedDisplayIndex = Math.min(this.selectedDisplayIndex, Math.max(0, this.displayOrder.length - 1));
    }

    this.adjustScrollForSelection();
  }

  /**
   * 渲染一帧面板内容
   * 使用同步输出防止闪烁
   */
  private render(): void {
    if (this.stopped || this.isOperating || !this.statusResult) return;

    const cols = process.stdout.columns || DEFAULT_TERMINAL_COLUMNS;
    const rows = process.stdout.rows || 24;

    const frameLines = buildPanelFrame(
      this.statusResult,
      this.getSelectedOriginalIndex(),
      this.scrollOffset,
      rows,
      cols,
      this.refreshCountdown,
    );

    // 同步输出开始
    process.stdout.write(SYNC_OUTPUT_START);
    process.stdout.write(CLEAR_SCREEN);
    process.stdout.write(CURSOR_HOME);

    // 最后一行不输出换行符，避免终端滚动导致标题行被推出屏幕
    for (let i = 0; i < frameLines.length; i++) {
      const suffix = i < frameLines.length - 1 ? '\n' : '';
      process.stdout.write(`${truncateToTerminalWidth(frameLines[i], cols)}${suffix}`);
    }

    // 同步输出结束
    process.stdout.write(SYNC_OUTPUT_END);
  }

  /**
   * 执行操作：暂停面板 → 恢复终端 → 执行命令 → 等待回车 → 恢复面板
   * @param {() => void} action - 要执行的操作
   */
  private async executeOperation(action: () => void): Promise<void> {
    if (!this.statusResult || this.displayOrder.length === 0) return;

    this.isOperating = true;

    // 暂停定时器
    this.clearTimers();

    // 恢复终端以便子命令输出
    this.restoreTerminal();

    // 恢复 stdin 以便子命令交互
    this.stopKeyboardListener();

    // 执行操作
    action();

    // 输出返回提示
    console.log(PANEL_PRESS_ENTER_TO_RETURN);

    // 等待用户按回车
    await this.waitForEnter();

    // 重新进入面板模式
    this.initTerminal();
    this.startKeyboardListener();

    this.isOperating = false;

    // 刷新数据并重新启动自动刷新
    this.refreshData();
    this.startAutoRefresh();

    // 渲染
    this.render();
  }

  /**
   * 获取当前选中的分支名
   * @returns {string} 当前选中的分支名
   */
  private getSelectedBranch(): string {
    const originalIndex = this.getSelectedOriginalIndex();
    return this.statusResult!.worktrees[originalIndex].branch;
  }

  /**
   * 执行验证操作
   */
  private handleValidate(): void {
    const branch = this.getSelectedBranch();
    runCommandInherited(`clawt validate -b ${branch}`);
  }

  /**
   * 执行合并操作
   */
  private handleMerge(): void {
    const branch = this.getSelectedBranch();
    runCommandInherited(`clawt merge -b ${branch}`);
  }

  /**
   * 执行删除操作
   */
  private handleDelete(): void {
    const branch = this.getSelectedBranch();
    runCommandInherited(`clawt remove -b ${branch}`);
  }

  /**
   * 执行恢复操作
   */
  private handleResume(): void {
    const branch = this.getSelectedBranch();
    runCommandInherited(`clawt resume -b ${branch}`);
  }

  /**
   * 执行同步操作
   */
  private handleSync(): void {
    const branch = this.getSelectedBranch();
    runCommandInherited(`clawt sync -b ${branch}`);
  }

  /**
   * 执行覆盖操作
   * cover 命令从主 worktree 当前所在的验证分支名自动推导目标分支
   */
  private handleCover(): void {
    runCommandInherited('clawt cover');
  }

  /**
   * 等待用户按回车键
   * @returns {Promise<void>} 用户按回车时 resolve
   */
  private waitForEnter(): Promise<void> {
    return new Promise<void>((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.once('line', () => {
        rl.close();
        resolve();
      });
    });
  }
}
