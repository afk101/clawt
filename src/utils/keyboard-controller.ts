/**
 * 键盘事件控制器
 * 负责终端键盘事件的绑定与解除
 */
export class KeyboardController {
  /** stdin 数据处理器引用（用于清理） */
  private stdinDataHandler: ((data: Buffer) => void) | null = null;
  /** 按键回调函数 */
  private onKeypress: (data: Buffer) => void;

  /**
   * 创建键盘事件控制器
   * @param {(data: Buffer) => void} onKeypress - 按键回调函数
   */
  constructor(onKeypress: (data: Buffer) => void) {
    this.onKeypress = onKeypress;
  }

  /**
   * 启动键盘监听
   * 将 stdin 设为 raw 模式以捕获每个按键
   */
  start(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    this.stdinDataHandler = (data: Buffer) => {
      this.onKeypress(data);
    };
    process.stdin.on('data', this.stdinDataHandler);
  }

  /**
   * 停止键盘监听，恢复 stdin 状态
   */
  stop(): void {
    if (this.stdinDataHandler) {
      process.stdin.removeListener('data', this.stdinDataHandler);
      this.stdinDataHandler = null;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }
}
