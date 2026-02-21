/** status 命令专属提示消息 */
export const STATUS_MESSAGES = {
  /** status 命令标题 */
  STATUS_TITLE: (projectName: string) => `项目状态总览: ${projectName}`,
  /** status 主 worktree 区块标题 */
  STATUS_MAIN_SECTION: '主 Worktree',
  /** status worktrees 区块标题 */
  STATUS_WORKTREES_SECTION: 'Worktree 列表',
  /** status 快照区块标题 */
  STATUS_SNAPSHOTS_SECTION: '未清理的 Validate 快照',
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
  STATUS_SNAPSHOT_ORPHANED: '(对应 worktree 已不存在)',
} as const;
