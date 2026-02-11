import type { ClawtConfig } from '../types/index.js';

/** 默认配置 */
export const DEFAULT_CONFIG: ClawtConfig = {
  autoDeleteBranch: false,
  /** 默认 Claude Code CLI 启动指令，用于不传 --tasks 时在 worktree 中打开交互式界面 */
  claudeCodeCommand: 'claude',
  /** 默认不自动执行 git pull 和 git push，需用户手动操作 */
  autoPullPush: false,
};
