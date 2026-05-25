import { createMessages } from '../../utils/i18n.js';

/** home 命令专属提示消息（双语映射） */
const HOME_MESSAGES_I18N = {
  /** 已在主工作分支上 */
  HOME_ALREADY_ON_MAIN: {
    en: (branch: string) => `Already on main work branch ${branch}, no switch needed`,
    'zh-CN': (branch: string) => `已在主工作分支 ${branch} 上，无需切换`,
  },
  /** 切换成功 */
  HOME_SWITCH_SUCCESS: {
    en: (from: string, to: string) => `✓ Switched from ${from} to main work branch ${to}`,
    'zh-CN': (from: string, to: string) => `✓ 已从 ${from} 切换到主工作分支 ${to}`,
  },
  /** 当前在子 worktree，提示用户手动 cd 到主 worktree */
  HOME_NOT_IN_MAIN_WORKTREE: {
    en: (mainPath: string) => `Not in main worktree. Please switch to main worktree:\n\n  cd ${mainPath}`,
    'zh-CN': (mainPath: string) => `当前不在主 worktree，请先切换到主 worktree：\n\n  cd ${mainPath}`,
  },
};

export const HOME_MESSAGES = createMessages(HOME_MESSAGES_I18N);
