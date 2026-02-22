/** Braille spinner 帧序列 */
export const SPINNER_FRAMES: readonly string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** spinner 刷新间隔（毫秒） */
export const SPINNER_INTERVAL_MS = 100;

/** ANSI 转义：光标上移 n 行 */
export const CURSOR_UP = (n: number): string => `\x1B[${n}A`;

/** ANSI 转义：清除从光标到行尾 */
export const CLEAR_LINE = '\x1B[0K';

/** ANSI 转义：隐藏光标 */
export const CURSOR_HIDE = '\x1B[?25l';

/** ANSI 转义：显示光标 */
export const CURSOR_SHOW = '\x1B[?25h';

/** 任务状态图标 */
export const TASK_STATUS_ICONS = {
  /** 排队中 */
  PENDING: '◦',
  /** 完成 */
  DONE: '✓',
  /** 失败 */
  FAILED: '✗',
} as const;

/** 任务状态标签 */
export const TASK_STATUS_LABELS = {
  /** 排队中 */
  PENDING: '排队中',
  /** 运行中 */
  RUNNING: '运行中',
  /** 完成 */
  DONE: '完成',
  /** 失败 */
  FAILED: '失败',
} as const;
