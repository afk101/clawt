/** 自动刷新间隔（毫秒） */
export const PANEL_REFRESH_INTERVAL_MS = 5000;

/** 倒计时更新间隔（毫秒） */
export const PANEL_COUNTDOWN_INTERVAL_MS = 1000;

/** 选中指示器 */
export const SELECTED_INDICATOR = '▶';

/** 未选中占位（与选中指示器等宽） */
export const UNSELECTED_INDICATOR = ' ';

/** 方向键上的字节序列 */
export const KEY_ARROW_UP = '\x1b[A';

/** 方向键下的字节序列 */
export const KEY_ARROW_DOWN = '\x1b[B';

/** Ctrl+C 的字节值 */
export const KEY_CTRL_C = 0x03;

/** 面板快捷键映射 */
export const PANEL_SHORTCUT_KEYS = {
  /** 验证 */
  VALIDATE: 'v',
  /** 合并 */
  MERGE: 'm',
  /** 删除 */
  DELETE: 'd',
  /** 恢复 */
  RESUME: 'r',
  /** 同步 */
  SYNC: 's',
  /** 手动刷新 */
  REFRESH: 'f',
  /** 退出 */
  QUIT: 'q',
} as const;

/** 日期分隔线前缀 */
export const PANEL_DATE_SEPARATOR_PREFIX = '════';

/** 固定占用行数（顶部分隔线 + 快照摘要 + 底部分隔线 + 底栏） */
export const PANEL_FIXED_ROWS = 4;
