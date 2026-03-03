/** 启用 Bracketed Paste Mode 的 ANSI 转义序列 */
export const ENABLE_BRACKETED_PASTE = '\x1b[?2004h';

/** 禁用 Bracketed Paste Mode 的 ANSI 转义序列 */
export const DISABLE_BRACKETED_PASTE = '\x1b[?2004l';

/**
 * 粘贴检测的时间阈值（毫秒）
 * 粘贴时字符在同一事件循环内批量到达，间隔接近 0ms
 * 手动按键间隔通常 > 50ms
 * 作为 Bracketed Paste Mode 不可用时的降级方案
 */
export const PASTE_THRESHOLD_MS = 10;

/** 配置项 terminalApp 允许的有效值 */
export const VALID_TERMINAL_APPS: readonly string[] = ['auto', 'iterm2', 'terminal'];

/** iTerm2 应用路径，用于 auto 模式检测是否已安装 */
export const ITERM2_APP_PATH = '/Applications/iTerm.app';

