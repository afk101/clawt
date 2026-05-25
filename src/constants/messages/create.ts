import { createMessages } from '../../utils/i18n.js';

/** create 命令专属提示消息（双语映射） */
const CREATE_MESSAGES_I18N = {
  /** 创建数量参数无效 */
  INVALID_COUNT: {
    en: (value: string) => `Invalid count: "${value}", please enter a positive integer`,
    'zh-CN': (value: string) => `无效的创建数量: "${value}"，请输入正整数`,
  },
  /** 当前不在主工作分支上的警告 */
  CREATE_WARN_NOT_ON_MAIN_BRANCH: {
    en: (mainBranch: string, currentBranch: string) =>
      `Not on main work branch ${mainBranch} (current: ${currentBranch})`,
    'zh-CN': (mainBranch: string, currentBranch: string) =>
      `当前不在主工作分支 ${mainBranch} 上（当前: ${currentBranch}）`,
  },
} as const;

export const CREATE_MESSAGES = createMessages(CREATE_MESSAGES_I18N);
