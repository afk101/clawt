/** Braille spinner 帧序列 */
export const SPINNER_FRAMES: readonly string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** spinner 刷新间隔（毫秒） */
export const SPINNER_INTERVAL_MS = 100;

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

/** 活动描述文本的最大字符数 */
export const ACTIVITY_TEXT_MAX_LENGTH = 30;

/** 文本类型活动的前缀 */
export const TEXT_ACTIVITY_PREFIX = '思考中';

/** 结果预览文本的最大字符数 */
export const RESULT_PREVIEW_MAX_LENGTH = 40;

/** 终端宽度的默认值（无法获取时的回退值） */
export const DEFAULT_TERMINAL_COLUMNS = 80;

/** ANSI 转义：禁用终端自动行换行（超出宽度的内容被截断而非折行） */
export const LINE_WRAP_DISABLE = '\x1B[?7l';

/** ANSI 转义：恢复终端自动行换行 */
export const LINE_WRAP_ENABLE = '\x1B[?7h';

/** ANSI 转义：开启同步输出模式（终端缓冲所有输出直到关闭，防止渲染闪烁） */
export const SYNC_OUTPUT_START = '\x1B[?2026h';

/** ANSI 转义：关闭同步输出模式（终端一次性刷新缓冲区内容） */
export const SYNC_OUTPUT_END = '\x1B[?2026l';

/** ANSI 转义：进入备选屏幕缓冲区（同时保存光标位置） */
export const ALT_SCREEN_ENTER = '\x1B[?1049h';

/** ANSI 转义：离开备选屏幕缓冲区（同时恢复光标位置） */
export const ALT_SCREEN_LEAVE = '\x1B[?1049l';

/** ANSI 转义：清除整个屏幕 */
export const CLEAR_SCREEN = '\x1B[2J';

/** ANSI 转义：光标移到屏幕左上角 (1,1) */
export const CURSOR_HOME = '\x1B[H';
