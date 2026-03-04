/** home 命令专属提示消息 */
export const HOME_MESSAGES = {
  /** 已在主工作分支上 */
  HOME_ALREADY_ON_MAIN: (branch: string) => `已在主工作分支 ${branch} 上，无需切换`,
  /** 切换成功 */
  HOME_SWITCH_SUCCESS: (from: string, to: string) => `✓ 已从 ${from} 切换到主工作分支 ${to}`,
} as const;
