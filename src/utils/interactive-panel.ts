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
import { buildPanelFrame, renderFooter } from './interactive-panel-render.js';
import { truncateToTerminalWidth } from './progress-render.js';
import type { StatusResult } from '../types/index.js';
import { KeyboardController } from './keyboard-controller.js';
import { PanelStateManager } from './interactive-panel-state.js';

/**
 * 交互式状态面板
 *
 * 提供实时刷新的 TUI 面板，支持键盘导航和快捷键操作。
 * 参照 ProgressRenderer 的生命周期模式实现。
 */
export class InteractivePanel {
  /** 状态管理器 */
  private stateManager: PanelStateManager;
  /** 键盘控制器 */
  private keyboardController: KeyboardController;
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
  /** 操作锁（防止操作期间响应按键） */
  private isOperating: boolean;
  /** 刷新锁（防止异步刷新期间触发重复刷新） */
  private isRefreshing: boolean;
  /** Promise resolve 函数（stop 时调用以完成 start 返回的 Promise） */
  private resolveStart: (() => void) | null;
  /** 数据收集函数引用（异步，支持并行收集 worktree 数据） */
  private collectStatusFn: () => Promise<StatusResult>;
  /** 上一帧的总行数，用于 footer-only 渲染时定位最后一行 */
  private lastFrameLineCount: number = 0;

  /**
   * 创建交互式面板
   * @param {() => Promise<StatusResult>} collectStatusFn - 异步数据收集函数
   */
  constructor(collectStatusFn: () => Promise<StatusResult>) {
    this.stateManager = new PanelStateManager();
    this.keyboardController = new KeyboardController(this.handleKeypress.bind(this));
    this.refreshTimer = null;
    this.countdownTimer = null;
    this.refreshCountdown = PANEL_REFRESH_INTERVAL_MS / 1000;
    this.stopped = false;
    this.isTTY = !!process.stdout.isTTY;
    this.resizeHandler = null;
    this.exitHandler = null;
    this.isOperating = false;
    this.isRefreshing = false;
    this.resolveStart = null;
    this.collectStatusFn = collectStatusFn;
  }

  /**
   * 启动交互式面板
   * 非 TTY 时打印提示并退出
   * @returns {Promise<void>} 面板关闭时 resolve
   */
  async start(): Promise<void> {
    // 非 TTY 降级
    if (!this.isTTY) {
      console.log(PANEL_NOT_TTY);
      return;
    }

    // 异步收集初始数据（在创建 Promise 之前完成，避免 async executor 反模式）
    this.stateManager.updateData(await this.collectStatusFn());

    return new Promise<void>((resolve) => {
      this.resolveStart = resolve;

      // 初始化终端
      this.initTerminal();

      // 启动键盘监听
      this.keyboardController.start();

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
    this.keyboardController.stop();

    // 恢复终端
    this.restoreTerminal();

    this.removeTerminalListeners();

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
    // 确保不会重复注册监听器
    this.removeTerminalListeners();

    process.stdout.write(ALT_SCREEN_ENTER);
    process.stdout.write(CURSOR_HIDE);
    process.stdout.write(LINE_WRAP_DISABLE);

    // 监听终端宽度变化，立即触发重绘
    this.resizeHandler = () => {
      if (!this.stopped && !this.isOperating) {
        // 在调整大小时也调整滚动
        this.stateManager.adjustScrollForSelection();
        this.render();
      }
    };
    process.stdout.on('resize', this.resizeHandler);

    // 注册 exit 兜底，确保异常退出时终端状态被恢复
    this.exitHandler = () => this.restoreTerminal();
    process.on('exit', this.exitHandler);
  }

  /**
   * 移除终端事件监听器（resize 和 exit）
   */
  private removeTerminalListeners(): void {
    if (this.resizeHandler) {
      process.stdout.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.exitHandler) {
      process.removeListener('exit', this.exitHandler);
      this.exitHandler = null;
    }
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
      if (this.stateManager.navigateUp()) {
        this.render();
      }
      return;
    }

    // 方向键下
    if (str === KEY_ARROW_DOWN) {
      if (this.stateManager.navigateDown()) {
        this.render();
      }
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
   * 启动自动刷新：数据刷新定时器 + 倒计时定时器
   */
  private startAutoRefresh(): void {
    this.refreshCountdown = PANEL_REFRESH_INTERVAL_MS / 1000;

    // 数据刷新定时器
    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, PANEL_REFRESH_INTERVAL_MS);

    // 倒计时定时器（每秒仅更新 footer 行，不触发全量重绘）
    this.countdownTimer = setInterval(() => {
      if (this.refreshCountdown > 0) {
        this.refreshCountdown--;
      }
      this.renderFooterOnly();
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
   * 刷新数据：记录当前选中分支 → 异步重新收集 → 恢复选中位置 → 重置倒计时 → 重绘
   * 使用 isRefreshing 锁防止异步刷新期间触发重复刷新
   */
  private async refreshData(): Promise<void> {
    if (this.stopped || this.isOperating || this.isRefreshing) return;

    this.isRefreshing = true;
    try {
      // 记录当前选中分支名
      const previousBranch = this.stateManager.getSelectedBranch();

      // 异步重新收集数据并更新状态
      this.stateManager.updateData(await this.collectStatusFn(), previousBranch || undefined);

      // 在重绘前必须确保滚动状态正常
      this.stateManager.adjustScrollForSelection();

      // 重置倒计时
      this.refreshCountdown = PANEL_REFRESH_INTERVAL_MS / 1000;

      this.render();
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 渲染一帧面板内容
   * 使用同步输出防止闪烁，复用缓存的 panelLines 避免重复 groupWorktreesByDate 计算
   */
  private render(): void {
    const statusResult = this.stateManager.getStatusResult();
    if (this.stopped || this.isOperating || !statusResult) return;

    const cols = process.stdout.columns || DEFAULT_TERMINAL_COLUMNS;
    const rows = process.stdout.rows || 24;

    const frameLines = buildPanelFrame(
      statusResult,
      this.stateManager.getSelectedOriginalIndex(),
      this.stateManager.getScrollOffset(),
      rows,
      cols,
      this.refreshCountdown,
      this.stateManager.getCachedPanelLines(),
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

    // 记录帧行数，供 renderFooterOnly 定位最后一行
    this.lastFrameLineCount = frameLines.length;

    // 同步输出结束
    process.stdout.write(SYNC_OUTPUT_END);
  }

  /**
   * 仅更新 footer 行（倒计时文本）
   * 使用 ANSI 光标定位直接覆写最后一行，避免全量重绘
   */
  private renderFooterOnly(): void {
    if (this.stopped || this.isOperating || this.lastFrameLineCount === 0) return;

    const cols = process.stdout.columns || DEFAULT_TERMINAL_COLUMNS;
    const footerText = renderFooter(this.refreshCountdown);
    const truncated = truncateToTerminalWidth(footerText, cols);

    // 使用 ANSI 转义序列定位到最后一行并覆写
    // \x1b[<row>;1H 移动光标到第 <row> 行第 1 列
    // \x1b[2K 清除当前行
    process.stdout.write(SYNC_OUTPUT_START);
    process.stdout.write(`\x1b[${this.lastFrameLineCount};1H`);
    process.stdout.write('\x1b[2K');
    process.stdout.write(truncated);
    process.stdout.write(SYNC_OUTPUT_END);
  }

  /**
   * 执行操作：暂停面板 → 恢复终端 → 执行命令 → 等待回车 → 恢复面板
   * @param {() => void} action - 要执行的操作
   */
  private async executeOperation(action: () => void): Promise<void> {
    const statusResult = this.stateManager.getStatusResult();
    if (!statusResult || this.stateManager.getSelectedOriginalIndex() === -1) return;

    this.isOperating = true;

    // 暂停定时器
    this.clearTimers();

    // 恢复终端以便子命令输出
    this.restoreTerminal();
    // 移除旧的终端事件监听器，避免 initTerminal() 重复注册导致泄漏
    this.removeTerminalListeners();

    // 恢复 stdin 以便子命令交互
    this.keyboardController.stop();

    // 执行操作
    action();

    // 输出返回提示
    console.log(PANEL_PRESS_ENTER_TO_RETURN);

    // 等待用户按回车
    await this.waitForEnter();

    // 重新进入面板模式
    this.initTerminal();
    this.keyboardController.start();

    this.isOperating = false;

    // 立即用旧数据渲染一帧，消除备选屏幕进入后的白屏
    this.render();

    // 异步刷新数据并重新启动自动刷新
    await this.refreshData();
    this.startAutoRefresh();

    this.render();
  }

  /**
   * 执行验证操作
   */
  private handleValidate(): void {
    const branch = this.stateManager.getSelectedBranch();
    if (branch) runCommandInherited(`clawt validate -b ${branch}`);
  }

  /**
   * 执行合并操作
   */
  private handleMerge(): void {
    const branch = this.stateManager.getSelectedBranch();
    if (branch) runCommandInherited(`clawt merge -b ${branch}`);
  }

  /**
   * 执行删除操作
   */
  private handleDelete(): void {
    const branch = this.stateManager.getSelectedBranch();
    if (branch) runCommandInherited(`clawt remove -b ${branch}`);
  }

  /**
   * 执行恢复操作
   */
  private handleResume(): void {
    const branch = this.stateManager.getSelectedBranch();
    if (branch) runCommandInherited(`clawt resume -b ${branch}`);
  }

  /**
   * 执行同步操作
   */
  private handleSync(): void {
    const branch = this.stateManager.getSelectedBranch();
    if (branch) runCommandInherited(`clawt sync -b ${branch}`);
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
