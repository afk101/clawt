import { createMessages } from '../../utils/i18n.js';

/** remove 命令专属提示消息（双语映射） */
const REMOVE_MESSAGES_I18N = {
  /** remove 无可用 worktree */
  REMOVE_NO_WORKTREES: {
    en: 'No worktrees available, nothing to remove',
    'zh-CN': '当前项目没有可用的 worktree，无需移除',
  },
  /** remove 多选交互提示 */
  REMOVE_SELECT_BRANCH: {
    en: 'Select branches to remove (space to select, enter to confirm)',
    'zh-CN': '请选择要移除的分支（空格选择，回车确认）',
  },
  /** remove 模糊匹配到多个结果提示 */
  REMOVE_MULTIPLE_MATCHES: {
    en: (name: string) => `"${name}" matched multiple branches, please select which to remove (space to select, enter to confirm):`,
    'zh-CN': (name: string) => `"${name}" 匹配到多个分支，请选择要移除的（空格选择，回车确认）：`,
  },
  /** remove 模糊匹配无结果，列出可用分支 */
  REMOVE_NO_MATCH: {
    en: (name: string, branches: string[]) =>
      `No branches matching "${name}"\n  Available branches:\n${branches.map((b) => `    - ${b}`).join('\n')}`,
    'zh-CN': (name: string, branches: string[]) =>
      `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  },
  /** 批量移除部分失败 */
  REMOVE_PARTIAL_FAILURE: {
    en: (failures: Array<{ path: string; error: string }>) =>
      `Failed to remove the following worktrees:\n${failures.map((f) => `  ✗ ${f.path}: ${f.error}`).join('\n')}`,
    'zh-CN': (failures: Array<{ path: string; error: string }>) =>
      `以下 worktree 移除失败：\n${failures.map((f) => `  ✗ ${f.path}: ${f.error}`).join('\n')}`,
  },
  /** 用户选择保留本地分支 */
  REMOVE_BRANCHES_KEPT: {
    en: 'Local branches kept. You can manually delete them later with: git branch -D <branch-name>',
    'zh-CN': '已保留本地分支，可稍后使用 git branch -D <分支名> 手动删除',
  },
  /** 确认删除本地分支和验证分支 */
  REMOVE_CONFIRM_DELETE_BRANCHES: {
    en: 'Also delete the associated local and validation branches?',
    'zh-CN': '是否同时删除对应的本地分支和验证分支？',
  },
  /** 待移除的 worktree 的分支是主 worktree 当前所在分支 */
  REMOVE_BRANCH_IS_CURRENT: {
    en: (branch: string) =>
      `Cannot remove: branch ${branch} is the current branch of the main worktree. Please switch to another branch first`,
    'zh-CN': (branch: string) =>
      `无法移除：分支 ${branch} 是主 worktree 当前所在分支，请先切换到其他分支后再移除`,
  },
  /** 待移除的 worktree 对应的验证分支是主 worktree 当前所在分支 */
  REMOVE_VALIDATE_BRANCH_IS_CURRENT: {
    en: (branch: string, validateBranch: string) =>
      `Cannot remove: the validation branch ${validateBranch} of branch ${branch} is the current branch of the main worktree. Please switch to another branch first`,
    'zh-CN': (branch: string, validateBranch: string) =>
      `无法移除：分支 ${branch} 的验证分支 ${validateBranch} 是主 worktree 当前所在分支，请先切换到其他分支后再移除`,
  },
} as const;

export const REMOVE_MESSAGES = createMessages(REMOVE_MESSAGES_I18N);
