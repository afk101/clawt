/** resume 命令专属提示消息 */
export const RESUME_MESSAGES = {
  /** resume 无可用 worktree */
  RESUME_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** resume 模糊匹配无结果，列出可用分支 */
  RESUME_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** resume 多选交互提示 */
  RESUME_SELECT_BRANCH: '请选择要恢复的分支（空格选择，回车确认）',
  /** resume 模糊匹配到多个结果的多选提示 */
  RESUME_MULTIPLE_MATCHES: (keyword: string) => `"${keyword}" 匹配到多个分支，请选择要恢复的：`,

  /** 批量 resume 确认提示 */
  RESUME_ALL_CONFIRM: (count: number) => `即将在 ${count} 个独立终端 Tab 中恢复 Claude Code 会话，是否继续？`,
  /** 批量 resume 完成提示 */
  RESUME_ALL_SUCCESS: (count: number) => `已在 ${count} 个终端 Tab 中启动 Claude Code 会话`,
  /** 批量 resume 非 macOS 平台提示 */
  RESUME_ALL_PLATFORM_UNSUPPORTED: '批量 resume 目前仅支持 macOS 平台（通过 AppleScript 打开终端 Tab）',
  /** 批量 resume 无匹配分支提示 */
  RESUME_ALL_NO_MATCH: (keyword: string) => `未找到与 "${keyword}" 匹配的分支`,

  /** --prompt 必须配合 -b 指定目标分支 */
  RESUME_PROMPT_REQUIRES_BRANCH: '--prompt 必须配合 -b 指定目标分支',
  /** --prompt 和 -f 不能同时使用 */
  RESUME_PROMPT_FILE_CONFLICT: '--prompt 和 -f 不能同时使用',
  /** 未找到对应 worktree */
  RESUME_WORKTREE_NOT_FOUND: (branch: string, available: string[]) =>
    `未找到分支 "${branch}" 对应的 worktree\n  可用分支：\n${available.map((b) => `    - ${b}`).join('\n')}`,
  /** 追问文件加载完成 */
  RESUME_FOLLOW_UP_FILE_LOADED: (count: number, path: string) => `从 ${path} 加载了 ${count} 个追问任务`,
} as const;
