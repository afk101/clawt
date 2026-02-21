import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ResumeOptions } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
  resolveTargetWorktree,
} from '../utils/index.js';
import type { WorktreeResolveMessages } from '../utils/index.js';

/** resume 命令的分支解析消息配置 */
const RESUME_RESOLVE_MESSAGES: WorktreeResolveMessages = {
  noWorktrees: MESSAGES.RESUME_NO_WORKTREES,
  selectBranch: MESSAGES.RESUME_SELECT_BRANCH,
  multipleMatches: MESSAGES.RESUME_MULTIPLE_MATCHES,
  noMatch: MESSAGES.RESUME_NO_MATCH,
};

/**
 * 注册 resume 命令：在已有 worktree 中恢复 Claude Code 会话
 * @param {Command} program - Commander 实例
 */
export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('在已有 worktree 中恢复 Claude Code 交互式会话')
    .option('-b, --branch <branchName>', '要恢复的分支名（支持模糊匹配，不传则列出所有分支）')
    .action(async (options: ResumeOptions) => {
      await handleResume(options);
    });
}

/**
 * 执行 resume 命令的核心逻辑
 * 解析目标 worktree 并恢复 Claude Code 会话
 * @param {ResumeOptions} options - 命令选项
 */
async function handleResume(options: ResumeOptions): Promise<void> {
  validateMainWorktree();
  validateClaudeCodeInstalled();

  logger.info(`resume 命令执行，分支: ${options.branch ?? '(未指定)'}`);

  // 解析目标 worktree（精确匹配 / 模糊匹配 / 交互选择）
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, RESUME_RESOLVE_MESSAGES, options.branch);

  // 启动 Claude Code 交互式界面
  launchInteractiveClaude(worktree);
}
