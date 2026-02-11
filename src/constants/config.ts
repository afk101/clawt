import type { ClawtConfig } from '../types/index.js';

/** Claude Code 系统约束提示，禁止代码执行完成后构建项目验证 */
export const APPEND_SYSTEM_PROMPT =
  'After the code execution is completed, it is prohibited to build the project for verification.';

/** 默认配置 */
export const DEFAULT_CONFIG: ClawtConfig = {
  autoDeleteBranch: false,
  /** 默认 Claude Code CLI 启动指令，用于不传 --tasks 时在 worktree 中打开交互式界面 */
  claudeCodeCommand: 'claude',
  /** 默认不自动执行 git pull 和 git push，需用户手动操作 */
  autoPullPush: false,
};
