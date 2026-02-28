/** remove 命令专属提示消息 */
export const REMOVE_MESSAGES = {
  /** remove 无可用 worktree */
  REMOVE_NO_WORKTREES: '当前项目没有可用的 worktree，无需移除',
  /** remove 多选交互提示 */
  REMOVE_SELECT_BRANCH: '请选择要移除的分支（空格选择，回车确认）',
  /** remove 模糊匹配到多个结果提示 */
  REMOVE_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择要移除的（空格选择，回车确认）：`,
  /** remove 模糊匹配无结果，列出可用分支 */
  REMOVE_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** 批量移除部分失败 */
  REMOVE_PARTIAL_FAILURE: (failures: Array<{ path: string; error: string }>) =>
    `以下 worktree 移除失败：\n${failures.map((f) => `  ✗ ${f.path}: ${f.error}`).join('\n')}`,
  /** 用户选择保留本地分支 */
  REMOVE_BRANCHES_KEPT: '已保留本地分支，可稍后使用 git branch -D <分支名> 手动删除',
  /** 确认删除本地分支和验证分支 */
  REMOVE_CONFIRM_DELETE_BRANCHES: '是否同时删除对应的本地分支和验证分支？',
} as const;
