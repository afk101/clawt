import type { Command } from 'commander';
import Enquirer from 'enquirer';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ResumeOptions, WorktreeInfo } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
} from '../utils/index.js';

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
 * 在 worktree 列表中精确匹配分支名
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string} branchName - 目标分支名
 * @returns {WorktreeInfo | undefined} 匹配的 worktree，未找到返回 undefined
 */
function findExactMatch(worktrees: WorktreeInfo[], branchName: string): WorktreeInfo | undefined {
  return worktrees.find((wt) => wt.branch === branchName);
}

/**
 * 在 worktree 列表中进行模糊匹配（子串匹配，大小写不敏感）
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string} keyword - 匹配关键词
 * @returns {WorktreeInfo[]} 匹配到的 worktree 列表
 */
function findFuzzyMatches(worktrees: WorktreeInfo[], keyword: string): WorktreeInfo[] {
  const lowerKeyword = keyword.toLowerCase();
  return worktrees.filter((wt) => wt.branch.toLowerCase().includes(lowerKeyword));
}

/**
 * 通过交互式列表让用户从 worktree 列表中选择一个分支
 * @param {WorktreeInfo[]} worktrees - 可供选择的 worktree 列表
 * @param {string} message - 选择提示信息
 * @returns {Promise<WorktreeInfo>} 用户选择的 worktree
 */
async function promptSelectBranch(worktrees: WorktreeInfo[], message: string): Promise<WorktreeInfo> {
  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const selectedBranch: string = await new Enquirer.Select({
    message,
    choices: worktrees.map((wt) => ({
      name: wt.branch,
      message: wt.branch,
    })),
  }).run();

  return worktrees.find((wt) => wt.branch === selectedBranch)!;
}

/**
 * 根据用户输入解析目标 worktree
 * 匹配策略：精确匹配 → 模糊匹配（唯一直接使用，多个交互选择） → 无匹配报错
 * 不传分支名时列出所有可用分支供选择
 * @param {string} [branchName] - 用户输入的分支名（可选）
 * @returns {Promise<WorktreeInfo>} 解析后的目标 worktree
 * @throws {ClawtError} 无可用 worktree 或无匹配结果时抛出
 */
async function resolveTargetWorktree(branchName?: string): Promise<WorktreeInfo> {
  const worktrees = getProjectWorktrees();

  // 无可用 worktree，直接报错
  if (worktrees.length === 0) {
    throw new ClawtError(MESSAGES.RESUME_NO_WORKTREES);
  }

  // 未传 -b 参数：列出所有分支供选择
  if (!branchName) {
    // 只有一个 worktree 时直接使用，无需选择
    if (worktrees.length === 1) {
      return worktrees[0];
    }
    return promptSelectBranch(worktrees, MESSAGES.RESUME_SELECT_BRANCH);
  }

  // 1. 精确匹配优先
  const exactMatch = findExactMatch(worktrees, branchName);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. 模糊匹配
  const fuzzyMatches = findFuzzyMatches(worktrees, branchName);

  // 2a. 唯一匹配，直接使用
  if (fuzzyMatches.length === 1) {
    return fuzzyMatches[0];
  }

  // 2b. 多个匹配，交互选择
  if (fuzzyMatches.length > 1) {
    return promptSelectBranch(fuzzyMatches, MESSAGES.RESUME_MULTIPLE_MATCHES(branchName));
  }

  // 3. 无匹配，抛出错误并列出所有可用分支
  const allBranches = worktrees.map((wt) => wt.branch);
  throw new ClawtError(MESSAGES.RESUME_NO_MATCH(branchName, allBranches));
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
  const worktree = await resolveTargetWorktree(options.branch);

  // 启动 Claude Code 交互式界面
  launchInteractiveClaude(worktree);
}
