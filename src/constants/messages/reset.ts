/** reset 命令专属提示消息 */
export const RESET_MESSAGES = {
  /** reset 成功 */
  RESET_SUCCESS: '✓ 主 worktree 工作区和暂存区已重置',
  /** reset 时工作区和暂存区已干净 */
  RESET_ALREADY_CLEAN: '主 worktree 工作区和暂存区已是干净状态，无需重置',
} as const;
