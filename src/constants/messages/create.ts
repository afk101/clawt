/** create 命令专属提示消息 */
export const CREATE_MESSAGES = {
  /** 创建数量参数无效 */
  INVALID_COUNT: (value: string) => `无效的创建数量: "${value}"，请输入正整数`,
  /** 当前不在主工作分支上的警告 */
  CREATE_WARN_NOT_ON_MAIN_BRANCH: (mainBranch: string, currentBranch: string) =>
    `当前不在主工作分支 ${mainBranch} 上（当前: ${currentBranch}）`,
} as const;
