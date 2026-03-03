import { COMMON_MESSAGES } from './common.js';
import { RUN_MESSAGES } from './run.js';
import { CREATE_MESSAGES } from './create.js';
import { MERGE_MESSAGES } from './merge.js';
import { VALIDATE_MESSAGES } from './validate.js';
import { SYNC_MESSAGES } from './sync.js';
import { RESUME_MESSAGES } from './resume.js';
import { REMOVE_MESSAGES } from './remove.js';
import { RESET_MESSAGES } from './reset.js';
import { CONFIG_CMD_MESSAGES, CONFIG_ALIAS_DISABLED_HINT } from './config.js';
import { STATUS_MESSAGES } from './status.js';
import { ALIAS_MESSAGES } from './alias.js';
import { PROJECTS_MESSAGES } from './projects.js';
import { COMPLETION_MESSAGES } from './completion.js';
import { UPDATE_MESSAGES, UPDATE_COMMANDS } from './update.js';
import { INIT_MESSAGES } from './init.js';
import { COVER_VALIDATE_MESSAGES } from './cover-validate.js';
import { PANEL_FOOTER_SHORTCUTS, PANEL_FOOTER_COUNTDOWN, PANEL_OVERFLOW_DOWN_HINT, PANEL_OVERFLOW_UP_HINT, PANEL_SNAPSHOT_SUMMARY, PANEL_NO_WORKTREES as PANEL_NO_WORKTREES_MSG, PANEL_PRESS_ENTER_TO_RETURN, PANEL_NOT_TTY, PANEL_TITLE } from './interactive-panel.js';

export { CONFIG_ALIAS_DISABLED_HINT };
export { UPDATE_MESSAGES, UPDATE_COMMANDS };
export { PANEL_FOOTER_SHORTCUTS, PANEL_FOOTER_COUNTDOWN, PANEL_OVERFLOW_DOWN_HINT, PANEL_OVERFLOW_UP_HINT, PANEL_SNAPSHOT_SUMMARY, PANEL_NO_WORKTREES_MSG, PANEL_PRESS_ENTER_TO_RETURN, PANEL_NOT_TTY, PANEL_TITLE };

/**
 * 提示消息模板
 * 合并所有子模块的消息，保持扁平结构以兼容现有的 MESSAGES.XXX 访问方式
 */
export const MESSAGES = {
  ...COMMON_MESSAGES,
  ...RUN_MESSAGES,
  ...CREATE_MESSAGES,
  ...MERGE_MESSAGES,
  ...VALIDATE_MESSAGES,
  ...SYNC_MESSAGES,
  ...RESUME_MESSAGES,
  ...REMOVE_MESSAGES,
  ...RESET_MESSAGES,
  ...CONFIG_CMD_MESSAGES,
  ...STATUS_MESSAGES,
  ...ALIAS_MESSAGES,
  ...PROJECTS_MESSAGES,
  ...COMPLETION_MESSAGES,
  ...INIT_MESSAGES,
  ...COVER_VALIDATE_MESSAGES,
} as const;
