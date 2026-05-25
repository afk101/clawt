import { createMessages } from '../../utils/i18n.js';

/** sync 命令专属提示消息（双语映射） */
const SYNC_MESSAGES_I18N = {
  /** sync 自动保存未提交变更 */
  SYNC_AUTO_COMMITTED: {
    en: (branch: string) =>
      `Auto-saved uncommitted changes on branch ${branch}`,
    'zh-CN': (branch: string) =>
      `已自动保存 ${branch} 分支的未提交变更`,
  },
  /** sync 开始合并 */
  SYNC_MERGING: {
    en: (targetBranch: string, mainBranch: string) =>
      `Merging ${mainBranch} into ${targetBranch} ...`,
    'zh-CN': (targetBranch: string, mainBranch: string) =>
      `正在将 ${mainBranch} 合并到 ${targetBranch} ...`,
  },
  /** sync 成功 */
  SYNC_SUCCESS: {
    en: (targetBranch: string, mainBranch: string) =>
      `✓ Synced latest code from ${mainBranch} to ${targetBranch}`,
    'zh-CN': (targetBranch: string, mainBranch: string) =>
      `✓ 已将 ${mainBranch} 的最新代码同步到 ${targetBranch}`,
  },
  /** sync 冲突 */
  SYNC_CONFLICT: {
    en: (worktreePath: string) =>
      `Merge conflicts detected. Please resolve them in the target worktree:\n  cd ${worktreePath}\n  After resolving conflicts, run: git add . && git merge --continue\n  Then validate changes with: clawt validate -b <branch>`,
    'zh-CN': (worktreePath: string) =>
      `合并存在冲突，请进入目标 worktree 手动解决：\n  cd ${worktreePath}\n  解决冲突后执行 git add . && git merge --continue\n  clawt validate -b <branch> 验证变更`,
  },
  /** sync 无可用 worktree */
  SYNC_NO_WORKTREES: {
    en: 'No worktrees available. Please create one with: clawt run or clawt create',
    'zh-CN': '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  },
  /** sync 模糊匹配无结果，列出可用分支 */
  SYNC_NO_MATCH: {
    en: (name: string, branches: string[]) =>
      `No branches matching "${name}"\n  Available branches:\n${branches.map((b) => `    - ${b}`).join('\n')}`,
    'zh-CN': (name: string, branches: string[]) =>
      `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  },
  /** sync 交互选择提示 */
  SYNC_SELECT_BRANCH: {
    en: 'Select branches to sync',
    'zh-CN': '请选择要同步的分支',
  },
  /** sync 模糊匹配到多个结果提示 */
  SYNC_MULTIPLE_MATCHES: {
    en: (name: string) => `"${name}" matched multiple branches, please select:`,
    'zh-CN': (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  },
  /** sync 后验证分支已重建提示 */
  SYNC_VALIDATE_BRANCH_REBUILT: {
    en: (validateBranch: string) =>
      `Validation branch ${validateBranch} has been rebuilt`,
    'zh-CN': (validateBranch: string) =>
      `验证分支 ${validateBranch} 已重建`,
  },
} as const;

export const SYNC_MESSAGES = createMessages(SYNC_MESSAGES_I18N);
