import { createMessages } from '../../utils/i18n.js';

/** status 命令专属提示消息（双语映射） */
const STATUS_MESSAGES_I18N = {
  /** status 命令标题 */
  STATUS_TITLE: {
    en: (projectName: string) => `Project Status Overview: ${projectName}`,
    'zh-CN': (projectName: string) => `项目状态总览: ${projectName}`,
  },
  /** status 主 worktree 区块标题 */
  STATUS_MAIN_SECTION: {
    en: 'Main Worktree',
    'zh-CN': '主 Worktree',
  },
  /** status worktrees 区块标题 */
  STATUS_WORKTREES_SECTION: {
    en: 'Worktrees',
    'zh-CN': 'Worktree 列表',
  },
  /** status 快照区块标题 */
  STATUS_SNAPSHOTS_SECTION: {
    en: 'Validate Snapshots',
    'zh-CN': 'Validate 快照',
  },
  /** status 无 worktree */
  STATUS_NO_WORKTREES: {
    en: '(No active worktrees)',
    'zh-CN': '(无活跃 worktree)',
  },
  /** status 无未清理快照 */
  STATUS_NO_SNAPSHOTS: {
    en: '(No pending snapshots)',
    'zh-CN': '(无未清理的快照)',
  },
  /** status 变更状态：已提交 */
  STATUS_CHANGE_COMMITTED: {
    en: 'Committed',
    'zh-CN': '已提交',
  },
  /** status 变更状态：未提交修改 */
  STATUS_CHANGE_UNCOMMITTED: {
    en: 'Uncommitted changes',
    'zh-CN': '未提交修改',
  },
  /** status 变更状态：合并冲突 */
  STATUS_CHANGE_CONFLICT: {
    en: 'Merge conflict',
    'zh-CN': '合并冲突',
  },
  /** status 变更状态：无变更 */
  STATUS_CHANGE_CLEAN: {
    en: 'No changes',
    'zh-CN': '无变更',
  },
  /** status 快照对应 worktree 已不存在 */
  STATUS_SNAPSHOT_ORPHANED: {
    en: (count: number) => `${count} snapshot(s) reference worktrees that no longer exist`,
    'zh-CN': (count: number) => `其中 ${count} 个快照对应的 worktree 已不存在`,
  },
  /** status 分支创建时间标签 */
  STATUS_CREATED_AT: {
    en: (relativeTime: string) => `Created ${relativeTime}`,
    'zh-CN': (relativeTime: string) => `创建于 ${relativeTime}`,
  },
  /** status 分支无分叉提交时的提示 */
  STATUS_NO_DIVERGED_COMMITS: {
    en: 'No diverged commits yet',
    'zh-CN': '尚无分叉提交',
  },
  /** status 上次验证时间标签 */
  STATUS_LAST_VALIDATED: {
    en: (relativeTime: string) => `Last validated: ${relativeTime}`,
    'zh-CN': (relativeTime: string) => `上次验证: ${relativeTime}`,
  },
  /** status 未验证警示 */
  STATUS_NOT_VALIDATED: {
    en: '✗ Not validated',
    'zh-CN': '✗ 未验证',
  },
  /** status 配置的主工作分支（正常状态） */
  STATUS_CONFIGURED_BRANCH: {
    en: (branchName: string) =>
      `Main work branch: ${branchName}`,
    'zh-CN': (branchName: string) =>
      `主工作分支: ${branchName}`,
  },
  /** status 配置的主工作分支已不存在 */
  STATUS_CONFIGURED_BRANCH_DELETED: {
    en: (branchName: string) =>
      `✗ Main work branch: ${branchName} (no longer exists, run clawt init to reset)`,
    'zh-CN': (branchName: string) =>
      `✗ 主工作分支: ${branchName}（已不存在，请执行 clawt init 重新设置）`,
  },
  /** status 当前分支与配置的主工作分支不一致 */
  STATUS_CONFIGURED_BRANCH_MISMATCH: {
    en: (branchName: string) =>
      `⚠ Main work branch: ${branchName} (current branch mismatch, run clawt init to update)`,
    'zh-CN': (branchName: string) =>
      `⚠ 主工作分支: ${branchName}（当前分支不一致，如需更新请执行 clawt init）`,
  },
} as const;

export const STATUS_MESSAGES = createMessages(STATUS_MESSAGES_I18N);
