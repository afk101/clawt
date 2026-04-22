/** status 命令专属提示消息 */
export const STATUS_MESSAGES = {
  /** status 命令标题 */
  STATUS_TITLE: (projectName: string) => `项目状态总览: ${projectName}`,
  /** status 主 worktree 区块标题 */
  STATUS_MAIN_SECTION: '主 Worktree',
  /** status worktrees 区块标题 */
  STATUS_WORKTREES_SECTION: 'Worktree 列表',
  /** status 快照区块标题 */
  STATUS_SNAPSHOTS_SECTION: 'Validate 快照',
  /** status 无 worktree */
  STATUS_NO_WORKTREES: '(无活跃 worktree)',
  /** status 无未清理快照 */
  STATUS_NO_SNAPSHOTS: '(无未清理的快照)',
  /** status 变更状态：已提交 */
  STATUS_CHANGE_COMMITTED: '已提交',
  /** status 变更状态：未提交修改 */
  STATUS_CHANGE_UNCOMMITTED: '未提交修改',
  /** status 变更状态：合并冲突 */
  STATUS_CHANGE_CONFLICT: '合并冲突',
  /** status 变更状态：无变更 */
  STATUS_CHANGE_CLEAN: '无变更',
  /** status 快照对应 worktree 已不存在 */
  STATUS_SNAPSHOT_ORPHANED: (count: number) => `其中 ${count} 个快照对应的 worktree 已不存在`,
  /** status 分支创建时间标签 */
  STATUS_CREATED_AT: (relativeTime: string) => `创建于 ${relativeTime}`,
  /** status 分支无分叉提交时的提示 */
  STATUS_NO_DIVERGED_COMMITS: '尚无分叉提交',
  /** status 上次验证时间标签 */
  STATUS_LAST_VALIDATED: (relativeTime: string) => `上次验证: ${relativeTime}`,
  /** status 未验证警示 */
  STATUS_NOT_VALIDATED: '✗ 未验证',
  /** status 配置的主工作分支（正常状态） */
  STATUS_CONFIGURED_BRANCH: (branchName: string) =>
    `主工作分支: ${branchName}`,
  /** status 配置的主工作分支已不存在 */
  STATUS_CONFIGURED_BRANCH_DELETED: (branchName: string) =>
    `✗ 主工作分支: ${branchName}（已不存在，请执行 clawt init 重新设置）`,
  /** status 当前分支与配置的主工作分支不一致 */
  STATUS_CONFIGURED_BRANCH_MISMATCH: (branchName: string) =>
    `⚠ 主工作分支: ${branchName}（当前分支不一致，如需更新请执行 clawt init）`,
  /** 来源主分支标签 */
  STATUS_SOURCE_BRANCH: (branchName: string) => `来自 ${branchName}`,
} as const;
