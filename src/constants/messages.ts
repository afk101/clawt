/** 提示消息模板 */
export const MESSAGES = {
  /** 不在主 worktree 根目录 */
  NOT_MAIN_WORKTREE: '请在主 worktree 的根目录下执行 clawt',
  /** Git 未安装 */
  GIT_NOT_INSTALLED: 'Git 未安装或不在 PATH 中，请先安装 Git',
  /** Claude Code CLI 未安装 */
  CLAUDE_NOT_INSTALLED: 'Claude Code CLI 未安装，请先安装：npm install -g @anthropic-ai/claude-code',
  /** 分支已存在 */
  BRANCH_EXISTS: (name: string) => `分支 ${name} 已存在，无法创建`,
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
  /** stash 已变更 */
  STASH_CHANGED: 'git stash list 已变更，请重新执行',
  /** validate 成功 */
  VALIDATE_SUCCESS: (branch: string) =>
    `✓ 已将分支 ${branch} 的变更应用到主 worktree\n  可以开始验证了`,
  /** merge 成功 */
  MERGE_SUCCESS: (branch: string, message: string) =>
    `✓ 分支 ${branch} 已成功合并到当前分支\n  提交信息: ${message}\n  已推送到远程仓库`,
  /** merge 成功（无提交信息，目标 worktree 已提交过） */
  MERGE_SUCCESS_NO_MESSAGE: (branch: string) =>
    `✓ 分支 ${branch} 已成功合并到当前分支\n  已推送到远程仓库`,
  /** merge 冲突 */
  MERGE_CONFLICT: '合并存在冲突，请手动处理',
  /** merge 后清理 worktree 和分支成功 */
  WORKTREE_CLEANED: (branch: string) => `✓ 已清理 worktree 和分支: ${branch}`,
  /** 请提供提交信息 */
  COMMIT_MESSAGE_REQUIRED: '请提供提交信息（-m 参数）',
  /** 目标 worktree 有未提交修改但未指定 -m */
  TARGET_WORKTREE_DIRTY_NO_MESSAGE: '目标 worktree 有未提交的修改，请通过 -m 参数提供提交信息',
  /** 目标 worktree 既干净又无本地提交 */
  TARGET_WORKTREE_NO_CHANGES: '目标 worktree 没有任何可合并的变更（工作区干净且无本地提交）',
  /** 检测到用户中断 */
  INTERRUPTED: '检测到退出指令，已停止 Claude Code 任务',
  /** 中断后自动清理完成 */
  INTERRUPT_AUTO_CLEANED: (count: number) => `✓ 已自动清理 ${count} 个 worktree 和对应分支`,
  /** 中断后手动确认清理 */
  INTERRUPT_CONFIRM_CLEANUP: '是否移除刚刚创建的 worktree 和对应分支？',
  /** 中断后清理完成 */
  INTERRUPT_CLEANED: (count: number) => `✓ 已清理 ${count} 个 worktree 和对应分支`,
  /** 中断后保留 worktree */
  INTERRUPT_KEPT: '已保留 worktree，可稍后使用 clawt remove 手动清理',
  /** 分隔线 */
  SEPARATOR: '────────────────────────────────────────',
  /** 粗分隔线 */
  DOUBLE_SEPARATOR: '════════════════════════════════════════',
} as const;
