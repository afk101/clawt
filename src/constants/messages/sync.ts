/** sync 命令专属提示消息 */
export const SYNC_MESSAGES = {
  /** sync 自动保存未提交变更 */
  SYNC_AUTO_COMMITTED: (branch: string) =>
    `已自动保存 ${branch} 分支的未提交变更`,
  /** sync 开始合并 */
  SYNC_MERGING: (targetBranch: string, mainBranch: string) =>
    `正在将 ${mainBranch} 合并到 ${targetBranch} ...`,
  /** sync 成功 */
  SYNC_SUCCESS: (targetBranch: string, mainBranch: string) =>
    `✓ 已将 ${mainBranch} 的最新代码同步到 ${targetBranch}`,
  /** sync 冲突 */
  SYNC_CONFLICT: (worktreePath: string) =>
    `合并存在冲突，请进入目标 worktree 手动解决：\n  cd ${worktreePath}\n  解决冲突后执行 git add . && git merge --continue\n  clawt validate -b <branch> 验证变更`,
  /** sync 无可用 worktree */
  SYNC_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** sync 模糊匹配无结果，列出可用分支 */
  SYNC_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** sync 交互选择提示 */
  SYNC_SELECT_BRANCH: '请选择要同步的分支',
  /** sync 模糊匹配到多个结果提示 */
  SYNC_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
} as const;
