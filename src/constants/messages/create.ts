/** create 命令专属提示消息 */
export const CREATE_MESSAGES = {
  /** 创建数量参数无效 */
  INVALID_COUNT: (value: string) => `无效的创建数量: "${value}"，请输入正整数`,
} as const;
