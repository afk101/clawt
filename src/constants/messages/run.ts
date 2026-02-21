/** run 命令专属提示消息 */
export const RUN_MESSAGES = {
  /** 分支已存在时提示使用 resume */
  BRANCH_EXISTS_USE_RESUME: (name: string) =>
    `分支 ${name} 已存在，请使用 clawt resume -b ${name} 恢复会话`,
  /** 检测到用户中断 */
  INTERRUPTED: '检测到退出指令，已停止 Claude Code 任务',
  /** 中断后自动清理完成 */
  INTERRUPT_AUTO_CLEANED: (count: number) => `✓ 已自动清理 ${count} 个 worktree 和对应分支`,
  /** 中断后手动确认清理 */
  INTERRUPT_CONFIRM_CLEANUP: '是否移除刚刚创建的 worktree 和对应分支？',
  /** 中断后清理完成 */
  INTERRUPT_CLEANED: (count: number) => `✓ 已清理 ${count} 个 worktree 和对应分支`,
  /** 中断后保留 worktree */
  INTERRUPT_KEPT: '已保留 worktree，可稍后使用 clawt remove 手动清理',
} as const;
