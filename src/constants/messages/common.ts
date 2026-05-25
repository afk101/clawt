import { createMessages } from '../../utils/i18n.js';

/** 通用/共享提示消息（双语映射） */
const COMMON_MESSAGES_I18N = {
  /** 不在主 worktree 根目录 */
  NOT_MAIN_WORKTREE: {
    en: 'Please run clawt in the root directory of the main worktree',
    'zh-CN': '请在主 worktree 的根目录下执行 clawt',
  },
  /** 不在 git 仓库中 */
  NOT_GIT_REPO: {
    en: 'Current directory is not a git repository. Please run git init and make an initial commit, then run clawt init',
    'zh-CN': '当前目录不是 git 仓库，请先执行 git init 并提交后，再执行 clawt init 初始化项目',
  },
  /** Git 未安装 */
  GIT_NOT_INSTALLED: {
    en: 'Git is not installed or not in PATH. Please install Git first',
    'zh-CN': 'Git 未安装或不在 PATH 中，请先安装 Git',
  },
  /** Claude Code CLI 未安装 */
  CLAUDE_NOT_INSTALLED: {
    en: 'Claude Code CLI is not installed. Please install it: npm install -g @anthropic-ai/claude-code',
    'zh-CN': 'Claude Code CLI 未安装，请先安装：npm install -g @anthropic-ai/claude-code',
  },
  /** HEAD 不存在（仓库无任何 commit） */
  HEAD_NOT_FOUND: {
    en: 'No commits exist in this repository. Please create an initial commit first',
    'zh-CN': '当前仓库尚未创建任何提交，请先执行 git commit 创建首次提交后再使用 clawt',
  },
  /** 分支已存在 */
  BRANCH_EXISTS: {
    en: (name: string) => `Branch ${name} already exists, cannot create`,
    'zh-CN': (name: string) => `分支 ${name} 已存在，无法创建`,
  },
  /** 分支名清理后为空 */
  BRANCH_NAME_EMPTY: {
    en: (original: string) =>
      `Branch name "${original}" contains no valid characters, cannot create branch`,
    'zh-CN': (original: string) =>
      `分支名 "${original}" 中不包含合法字符，无法创建分支`,
  },
  /** 分支名被转换 */
  BRANCH_SANITIZED: {
    en: (original: string, sanitized: string) =>
      `Branch name sanitized: ${original} → ${sanitized}`,
    'zh-CN': (original: string, sanitized: string) =>
      `分支名已转换: ${original} → ${sanitized}`,
  },
  /** worktree 创建成功 */
  WORKTREE_CREATED: {
    en: (count: number) => `✓ Created ${count} worktree(s)`,
    'zh-CN': (count: number) => `✓ 已创建 ${count} 个 worktree`,
  },
  /** worktree 移除成功 */
  WORKTREE_REMOVED: {
    en: (path: string) => `✓ Removed worktree: ${path}`,
    'zh-CN': (path: string) => `✓ 已移除 worktree: ${path}`,
  },
  /** 没有 worktree */
  NO_WORKTREES: {
    en: '(No worktrees)',
    'zh-CN': '(无 worktree)',
  },
  /** 目标 worktree 不存在 */
  WORKTREE_NOT_FOUND: {
    en: (name: string) => `Worktree ${name} does not exist`,
    'zh-CN': (name: string) => `worktree ${name} 不存在`,
  },
  /** 主 worktree 有未提交更改 */
  MAIN_WORKTREE_DIRTY: {
    en: 'Main worktree has uncommitted changes. Please resolve first',
    'zh-CN': '主 worktree 有未提交的更改，请先处理',
  },
  /** 目标 worktree 无更改 */
  TARGET_WORKTREE_CLEAN: {
    en: 'No changes on this worktree branch, nothing to validate',
    'zh-CN': '该 worktree 的分支上没有任何更改，无需验证',
  },
  /** 用户取消破坏性操作 */
  DESTRUCTIVE_OP_CANCELLED: {
    en: 'Operation cancelled',
    'zh-CN': '已取消操作',
  },
  /** 请提供提交信息 */
  COMMIT_MESSAGE_REQUIRED: {
    en: 'Please provide a commit message (-m option)',
    'zh-CN': '请提供提交信息（-m 参数）',
  },
  /** 配置文件损坏，已重新生成默认配置 */
  CONFIG_CORRUPTED: {
    en: 'Config file corrupted or unparseable, regenerated default config',
    'zh-CN': '配置文件损坏或无法解析，已重新生成默认配置',
  },
  /** worktree 状态获取失败 */
  WORKTREE_STATUS_UNAVAILABLE: {
    en: '(Status unavailable)',
    'zh-CN': '(状态不可用)',
  },
  /** 分隔线 */
  SEPARATOR: {
    en: '────────────────────────────────────────',
    'zh-CN': '────────────────────────────────────────',
  },
  /** 粗分隔线 */
  DOUBLE_SEPARATOR: {
    en: '════════════════════════════════════════',
    'zh-CN': '════════════════════════════════════════',
  },
  /** 守卫检测：配置的主工作分支已不存在 */
  GUARD_BRANCH_NOT_EXISTS: {
    en: (branchName: string) =>
      `Configured main work branch ${branchName} no longer exists. Please run clawt init to reset`,
    'zh-CN': (branchName: string) =>
      `配置的主工作分支 ${branchName} 已不存在，请执行 clawt init 重新设置主工作分支`,
  },
  /** 守卫检测：当前分支与配置的主工作分支不一致 */
  GUARD_BRANCH_MISMATCH: {
    en: (configuredBranch: string, currentBranch: string) =>
      `Current branch ${currentBranch} does not match configured main work branch ${configuredBranch}. Run clawt init to update`,
    'zh-CN': (configuredBranch: string, currentBranch: string) =>
      `当前分支 ${currentBranch} 与配置的主工作分支 ${configuredBranch} 不一致，如需更新请执行 clawt init`,
  },
  /** Git index 被锁定（index.lock 存在） */
  GIT_INDEX_LOCKED: {
    en: (lockFilePath: string) =>
      `Git index is locked, cannot proceed\n` +
      `  Cause: Lock file exists (possibly from an interrupted git operation)\n` +
      `  Lock file path: ${lockFilePath}\n` +
      `  Fix: Confirm no other git operations are running, then run:\n` +
      `  rm ${lockFilePath}`,
    'zh-CN': (lockFilePath: string) =>
      `Git index 被锁定，无法执行操作\n` +
      `  原因：锁文件已存在（可能是上次 git 操作异常中断残留）\n` +
      `  锁文件路径：${lockFilePath}\n` +
      `  修复方法：确认没有其他 git 操作在进行后，执行以下命令删除锁文件：\n` +
      `  rm ${lockFilePath}`,
  },
  /** Git index.lock 重试中（简短提示） */
  GIT_INDEX_LOCK_RETRYING: {
    en: 'Git index is locked, retrying...',
    'zh-CN': 'Git index 被锁定，正在重试...',
  },
  // --- 从 formatter.ts 迁移 ---
  /** 是否继续？ */
  CONFIRM_CONTINUE: {
    en: 'Continue?',
    'zh-CN': '是否继续？',
  },
  /** 无变更 */
  NO_CHANGES: {
    en: 'No changes',
    'zh-CN': '无变更',
  },
  /** 未提交修改 */
  UNCOMMITTED_CHANGES: {
    en: '(uncommitted changes)',
    'zh-CN': '(未提交修改)',
  },
  /** 提交数 */
  COMMIT_COUNT: {
    en: (n: number) => `${n} commit(s)`,
    'zh-CN': (n: number) => `${n} 个提交`,
  },
  /** 刚刚 */
  JUST_NOW: {
    en: 'just now',
    'zh-CN': '刚刚',
  },
  /** N 分钟前 */
  MINUTES_AGO: {
    en: (n: number) => `${n} min ago`,
    'zh-CN': (n: number) => `${n} 分钟前`,
  },
  /** N 小时前 */
  HOURS_AGO: {
    en: (n: number) => `${n} hr ago`,
    'zh-CN': (n: number) => `${n} 小时前`,
  },
  /** N 天前 */
  DAYS_AGO: {
    en: (n: number) => `${n} day(s) ago`,
    'zh-CN': (n: number) => `${n} 天前`,
  },
  /** N 个月前 */
  MONTHS_AGO: {
    en: (n: number) => `${n} month(s) ago`,
    'zh-CN': (n: number) => `${n} 个月前`,
  },
  /** N 年前 */
  YEARS_AGO: {
    en: (n: number) => `${n} year(s) ago`,
    'zh-CN': (n: number) => `${n} 年前`,
  },
  /** 未知错误 */
  UNKNOWN_ERROR: {
    en: 'Unknown error',
    'zh-CN': '未知错误',
  },
  // --- 从 ui-prompts.ts 迁移 ---
  /** 非交互模式下无法进行分支选择 */
  NON_INTERACTIVE_BRANCH_SELECT: {
    en: 'Cannot select branch in non-interactive mode. Please use -b to specify branch',
    'zh-CN': '非交互模式下无法进行分支选择，请使用 -b 指定分支',
  },
  /** 非交互模式下无法进行分支多选 */
  NON_INTERACTIVE_MULTI_SELECT: {
    en: 'Cannot multi-select branches in non-interactive mode',
    'zh-CN': '非交互模式下无法进行分支多选',
  },
  // --- 从 worktree-matcher.ts 迁移 ---
  /** 今天 */
  TODAY: {
    en: 'Today',
    'zh-CN': '今天',
  },
  /** 昨天 */
  YESTERDAY: {
    en: 'Yesterday',
    'zh-CN': '昨天',
  },
  // --- 从 config-strategy.ts 迁移 ---
  /** （未设置） */
  NOT_SET: {
    en: '(not set)',
    'zh-CN': '(未设置)',
  },
  /** 非交互模式下无法使用交互式配置编辑器 */
  NON_INTERACTIVE_CONFIG_EDITOR: {
    en: 'Cannot use interactive config editor in non-interactive mode. Please use: clawt config set <key> <value>',
    'zh-CN': '非交互模式下无法使用交互式配置编辑器，请使用 clawt config set <key> <value>',
  },
  /** 请输入有效的数字 */
  INVALID_NUMBER_PROMPT: {
    en: 'Please enter a valid number',
    'zh-CN': '请输入有效的数字',
  },
  // --- 从 commands/config.ts 迁移 ---
  /** 当前配置将被覆盖为默认值 */
  CONFIG_RESET_WARNING: {
    en: 'Current configuration will be reset to defaults',
    'zh-CN': '当前配置将被覆盖为默认值',
  },
};

export const COMMON_MESSAGES = createMessages(COMMON_MESSAGES_I18N);
