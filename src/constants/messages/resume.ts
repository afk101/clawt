import { createMessages } from '../../utils/i18n.js';

/** resume 命令专属提示消息（双语映射） */
const RESUME_MESSAGES_I18N = {
  /** resume 无可用 worktree */
  RESUME_NO_WORKTREES: {
    en: 'No worktrees available, please create one with clawt run or clawt create first',
    'zh-CN': '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  },
  /** resume 模糊匹配无结果，列出可用分支 */
  RESUME_NO_MATCH: {
    en: (name: string, branches: string[]) =>
      `No branch matching "${name}"\n  Available branches:\n${branches.map((b) => `    - ${b}`).join('\n')}`,
    'zh-CN': (name: string, branches: string[]) =>
      `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  },
  /** resume 多选交互提示 */
  RESUME_SELECT_BRANCH: {
    en: 'Select branches to resume (space to select, enter to confirm)',
    'zh-CN': '请选择要恢复的分支（空格选择，回车确认）',
  },
  /** resume 模糊匹配到多个结果的多选提示 */
  RESUME_MULTIPLE_MATCHES: {
    en: (keyword: string) => `"${keyword}" matched multiple branches, please select which to resume:`,
    'zh-CN': (keyword: string) => `"${keyword}" 匹配到多个分支，请选择要恢复的：`,
  },
  /** 批量 resume 确认提示 */
  RESUME_ALL_CONFIRM: {
    en: (count: number) => `About to resume Claude Code sessions in ${count} terminal tabs, continue?`,
    'zh-CN': (count: number) => `即将在 ${count} 个独立终端 Tab 中恢复 Claude Code 会话，是否继续？`,
  },
  /** 批量 resume 完成提示 */
  RESUME_ALL_SUCCESS: {
    en: (count: number) => `Claude Code sessions started in ${count} terminal tabs`,
    'zh-CN': (count: number) => `已在 ${count} 个终端 Tab 中启动 Claude Code 会话`,
  },
  /** 批量 resume 非 macOS 平台提示 */
  RESUME_ALL_PLATFORM_UNSUPPORTED: {
    en: 'Batch resume is only supported on macOS (via AppleScript to open terminal tabs)',
    'zh-CN': '批量 resume 目前仅支持 macOS 平台（通过 AppleScript 打开终端 Tab）',
  },
  /** 批量 resume 无匹配分支提示 */
  RESUME_ALL_NO_MATCH: {
    en: (keyword: string) => `No branch matching "${keyword}"`,
    'zh-CN': (keyword: string) => `未找到与 "${keyword}" 匹配的分支`,
  },
  /** --prompt 必须配合 -b 指定目标分支 */
  RESUME_PROMPT_REQUIRES_BRANCH: {
    en: '--prompt requires -b to specify the target branch',
    'zh-CN': '--prompt 必须配合 -b 指定目标分支',
  },
  /** --prompt 和 -f 不能同时使用 */
  RESUME_PROMPT_FILE_CONFLICT: {
    en: '--prompt and -f cannot be used together',
    'zh-CN': '--prompt 和 -f 不能同时使用',
  },
  /** 未找到对应 worktree */
  RESUME_WORKTREE_NOT_FOUND: {
    en: (branch: string, available: string[]) =>
      `No worktree found for branch "${branch}"\n  Available branches:\n${available.map((b) => `    - ${b}`).join('\n')}`,
    'zh-CN': (branch: string, available: string[]) =>
      `未找到分支 "${branch}" 对应的 worktree\n  可用分支：\n${available.map((b) => `    - ${b}`).join('\n')}`,
  },
  /** 追问文件加载完成 */
  RESUME_FOLLOW_UP_FILE_LOADED: {
    en: (count: number, path: string) => `Loaded ${count} follow-up task(s) from ${path}`,
    'zh-CN': (count: number, path: string) => `从 ${path} 加载了 ${count} 个追问任务`,
  },
  // --- 从 terminal.ts 迁移 ---
  /** 当前不在 cmux 环境中 */
  NOT_IN_CMUX: {
    en: 'Not currently in a cmux environment, cannot create surface\nPlease run clawt resume from a cmux terminal, or change the terminalApp config',
    'zh-CN': '当前不在 cmux 环境中，无法创建 surface\n请确保在 cmux 终端中执行 clawt resume 命令，或修改 terminalApp 配置',
  },
  /** Terminal.app 辅助功能权限提示 */
  TERMINAL_ACCESSIBILITY_HINT: {
    en: '\nHint: Terminal.app requires Accessibility permission. Grant it in System Settings → Privacy & Security → Accessibility',
    'zh-CN': '\n提示：Terminal.app 需要辅助功能权限，请在「系统设置 → 隐私与安全性 → 辅助功能」中授权终端应用',
  },
  /** 批量 resume 仅支持 macOS */
  BATCH_RESUME_MACOS_ONLY: {
    en: 'Batch resume is only supported on macOS',
    'zh-CN': '批量 resume 目前仅支持 macOS 平台',
  },
  // --- 从 claude.ts 迁移 ---
  /** 正在 worktree 中启动 Claude Code 交互式界面 */
  STARTING_CLAUDE_INTERACTIVE: {
    en: 'Starting Claude Code interactive session in worktree...',
    'zh-CN': '正在 worktree 中启动 Claude Code 交互式界面...',
  },
  /** 分支标签 */
  BRANCH_LABEL: {
    en: 'Branch:',
    'zh-CN': '分支:',
  },
  /** 路径标签（resume 专用，与 run 中的 PATH_LABEL 区分） */
  PATH_LABEL_RESUME: {
    en: 'Path:',
    'zh-CN': '路径:',
  },
  /** 指令标签 */
  COMMAND_LABEL: {
    en: 'Command:',
    'zh-CN': '指令:',
  },
  /** 模式标签 */
  MODE_LABEL: {
    en: 'Mode:',
    'zh-CN': '模式:',
  },
  /** 继续上次对话 */
  CONTINUE_SESSION: {
    en: 'Continue previous session',
    'zh-CN': '继续上次对话',
  },
  /** 新对话 */
  NEW_SESSION: {
    en: 'New session',
    'zh-CN': '新对话',
  },
  /** 启动 Claude Code 失败 */
  CLAUDE_START_FAILED: {
    en: (message: string) => `Failed to start Claude Code: ${message}`,
    'zh-CN': (message: string) => `启动 Claude Code 失败: ${message}`,
  },
};

export const RESUME_MESSAGES = createMessages(RESUME_MESSAGES_I18N);
