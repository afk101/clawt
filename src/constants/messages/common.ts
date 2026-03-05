/** 通用/共享提示消息 */
export const COMMON_MESSAGES = {
  /** 不在主 worktree 根目录 */
  NOT_MAIN_WORKTREE: '请在主 worktree 的根目录下执行 clawt',
  /** Git 未安装 */
  GIT_NOT_INSTALLED: 'Git 未安装或不在 PATH 中，请先安装 Git',
  /** Claude Code CLI 未安装 */
  CLAUDE_NOT_INSTALLED: 'Claude Code CLI 未安装，请先安装：npm install -g @anthropic-ai/claude-code',
  /** HEAD 不存在（仓库无任何 commit） */
  HEAD_NOT_FOUND: '当前仓库尚未创建任何提交，请先执行 git commit 创建首次提交后再使用 clawt',
  /** 分支已存在 */
  BRANCH_EXISTS: (name: string) => `分支 ${name} 已存在，无法创建`,
  /** 分支名清理后为空 */
  BRANCH_NAME_EMPTY: (original: string) =>
    `分支名 "${original}" 中不包含合法字符，无法创建分支`,
  /** 分支名被转换 */
  BRANCH_SANITIZED: (original: string, sanitized: string) =>
    `分支名已转换: ${original} → ${sanitized}`,
  /** worktree 创建成功 */
  WORKTREE_CREATED: (count: number) => `✓ 已创建 ${count} 个 worktree`,
  /** worktree 移除成功 */
  WORKTREE_REMOVED: (path: string) => `✓ 已移除 worktree: ${path}`,
  /** 没有 worktree */
  NO_WORKTREES: '(无 worktree)',
  /** 目标 worktree 不存在 */
  WORKTREE_NOT_FOUND: (name: string) => `worktree ${name} 不存在`,
  /** 主 worktree 有未提交更改 */
  MAIN_WORKTREE_DIRTY: '主 worktree 有未提交的更改，请先处理',
  /** 目标 worktree 无更改 */
  TARGET_WORKTREE_CLEAN: '该 worktree 的分支上没有任何更改，无需验证',
  /** 用户取消破坏性操作 */
  DESTRUCTIVE_OP_CANCELLED: '已取消操作',
  /** 请提供提交信息 */
  COMMIT_MESSAGE_REQUIRED: '请提供提交信息（-m 参数）',
  /** 配置文件损坏，已重新生成默认配置 */
  CONFIG_CORRUPTED: '配置文件损坏或无法解析，已重新生成默认配置',
  /** worktree 状态获取失败 */
  WORKTREE_STATUS_UNAVAILABLE: '(状态不可用)',
  /** 分隔线 */
  SEPARATOR: '────────────────────────────────────────',
  /** 粗分隔线 */
  DOUBLE_SEPARATOR: '════════════════════════════════════════',
  /** 守卫检测：配置的主工作分支已不存在 */
  GUARD_BRANCH_NOT_EXISTS: (branchName: string) =>
    `配置的主工作分支 ${branchName} 已不存在，请执行 clawt init 重新设置主工作分支`,
  /** 守卫检测：当前分支与配置的主工作分支不一致 */
  GUARD_BRANCH_MISMATCH: (configuredBranch: string, currentBranch: string) =>
    `当前分支 ${currentBranch} 与配置的主工作分支 ${configuredBranch} 不一致，如需更新请执行 clawt init`,
} as const;
