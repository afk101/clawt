import { createMessages } from '../../utils/i18n.js';

/** reset 命令专属提示消息（双语映射） */
const RESET_MESSAGES_I18N = {
  /** reset 成功 */
  RESET_SUCCESS: {
    en: '✓ Main worktree working directory and staging area have been reset',
    'zh-CN': '✓ 主 worktree 工作区和暂存区已重置',
  },
  /** reset 时工作区和暂存区已干净 */
  RESET_ALREADY_CLEAN: {
    en: 'Main worktree working directory and staging area are already clean, no reset needed',
    'zh-CN': '主 worktree 工作区和暂存区已是干净状态，无需重置',
  },
} as const;

export const RESET_MESSAGES = createMessages(RESET_MESSAGES_I18N);
