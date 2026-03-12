/** postCreate hook 相关提示消息 */
export const POST_CREATE_MESSAGES = {
  /** hook 执行跳过（--no-post-create） */
  HOOK_SKIPPED: '已跳过 postCreate hook（--no-post-create）',
  /** 无 hook 配置 */
  HOOK_NOT_CONFIGURED: '未配置 postCreate hook，跳过',
  /** hook 来源提示 */
  HOOK_SOURCE_INFO: (source: string) => `postCreate hook 来源: ${source}`,
  /** hook 开始执行 */
  HOOK_EXECUTING: (branch: string, command: string) =>
    `[${branch}] 正在执行 postCreate hook: ${command}`,
  /** hook 执行成功 */
  HOOK_SUCCESS: (branch: string) => `[${branch}] postCreate hook 执行成功`,
  /** hook 执行失败 */
  HOOK_FAILED: (branch: string, error: string) =>
    `[${branch}] postCreate hook 执行失败: ${error}`,
  /** hook 执行汇总 */
  HOOK_SUMMARY: (succeeded: number, failed: number) =>
    `postCreate hook 执行完成: ${succeeded} 成功, ${failed} 失败`,
  /** hook 后台执行中提示 */
  HOOK_BACKGROUND_START: (count: number, command: string) =>
    `postCreate hook 正在后台执行 (${count} 个 worktree): ${command}`,
  /** postCreate.sh 自动添加执行权限 */
  POST_CREATE_SCRIPT_AUTO_CHMOD: (path: string) =>
    `${path} 不可执行，已自动添加执行权限`,
  /** postCreate.sh 不可执行（自动 chmod 失败时降级提示） */
  POST_CREATE_SCRIPT_NOT_EXECUTABLE: (path: string) =>
    `检测到 ${path} 但不可执行，自动添加权限失败，请手动执行 chmod +x ${path}`,
} as const;
