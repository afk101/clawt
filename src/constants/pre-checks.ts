import type { PreCheckOptions } from '../utils/validation.js';

/** create 命令：主 worktree + HEAD + 切换分支 + 工作区干净 */
export const PRE_CHECK_CREATE: PreCheckOptions = {
  requireMainWorktree: true, requireHead: true,
  ensureOnClawtMainWorkBranch: true, requireCleanWorkingDir: true,
} as const;

/** run 命令正常模式（不含 requireClaudeCode，因为 claudeCode 在 dryRun 分支之后才需要） */
export const PRE_CHECK_RUN: PreCheckOptions = { ...PRE_CHECK_CREATE } as const;

/** run dry-run 模式 */
export const PRE_CHECK_DRY_RUN: PreCheckOptions = { requireMainWorktree: true, requireHead: true } as const;

/** merge 命令 */
export const PRE_CHECK_MERGE: PreCheckOptions = {
  requireMainWorktree: true, requireHead: true,
  ensureOnClawtMainWorkBranch: true,
} as const;

/** sync 命令 */
export const PRE_CHECK_SYNC: PreCheckOptions = {
  requireMainWorktree: true, requireHead: true, requireProjectConfig: true,
  ensureOnClawtMainWorkBranch: true,
} as const;

/** resume 命令 */
export const PRE_CHECK_RESUME: PreCheckOptions = {
  requireMainWorktree: true, requireHead: true, requireClaudeCode: true,
} as const;
