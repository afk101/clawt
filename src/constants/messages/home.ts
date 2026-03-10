/** home 命令专属提示消息 */
export const HOME_MESSAGES = {
  /** 已在主工作分支上 */
  HOME_ALREADY_ON_MAIN: (branch: string) => `已在主工作分支 ${branch} 上，无需切换`,
  /** 切换成功 */
  HOME_SWITCH_SUCCESS: (from: string, to: string) => `✓ 已从 ${from} 切换到主工作分支 ${to}`,
  /** 当前在子 worktree，提示用户手动 cd 到主 worktree */
  HOME_NOT_IN_MAIN_WORKTREE: (mainPath: string) => `当前不在主 worktree，请先切换到主 worktree：\n\n  cd ${mainPath}`,
} as const;
