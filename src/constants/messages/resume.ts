/** resume 命令专属提示消息 */
export const RESUME_MESSAGES = {
  /** resume 无可用 worktree */
  RESUME_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** resume 模糊匹配无结果，列出可用分支 */
  RESUME_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** resume 交互选择提示 */
  RESUME_SELECT_BRANCH: '请选择要恢复的分支',
  /** resume 模糊匹配到多个结果提示 */
  RESUME_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
} as const;
