import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ResumeOptions } from '../types/index.js';
import type { WorktreeInfo } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
  launchInteractiveClaudeInNewTerminal,
  hasClaudeSessionHistory,
  resolveTargetWorktrees,
  promptGroupedMultiSelectBranches,
  printInfo,
  printSuccess,
  confirmAction,
  getConfigValue,
} from '../utils/index.js';
import type { WorktreeMultiResolveMessages } from '../utils/index.js';

/** resume 命令的多选分支解析消息配置 */
const RESUME_RESOLVE_MESSAGES: WorktreeMultiResolveMessages = {
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
    .description('在已有 worktree 中恢复 Claude Code 会话（支持多选批量恢复）')
    .option('-b, --branch <branchName>', '要恢复的分支名（支持模糊匹配，不传则列出所有分支）')
    .action(async (options: ResumeOptions) => {
      await handleResume(options);
    });
}

/**
 * 执行 resume 命令的核心逻辑
 * 统一走多选交互，根据选中数量自动分发：选 1 个在当前终端恢复，选多个在独立终端 Tab 中批量恢复
 * @param {ResumeOptions} options - 命令选项
 */
async function handleResume(options: ResumeOptions): Promise<void> {
  validateMainWorktree();
  validateClaudeCodeInstalled();

  logger.info(`resume 命令执行，分支过滤: ${options.branch ?? '(无)'}`);
  const worktrees = getProjectWorktrees();

  // 未指定 -b 且有多个 worktree 时，默认使用按日期分组的多选交互
  let targetWorktrees: WorktreeInfo[];
  if (!options.branch && worktrees.length > 1) {
    targetWorktrees = await promptGroupedMultiSelectBranches(worktrees, RESUME_RESOLVE_MESSAGES.selectBranch);
  } else {
    targetWorktrees = await resolveTargetWorktrees(worktrees, RESUME_RESOLVE_MESSAGES, options.branch);
  }

  // 用户未选择任何分支时直接退出
  if (targetWorktrees.length === 0) {
    return;
  }

  if (targetWorktrees.length === 1) {
    // 选中 1 个 → 根据 resumeInPlace 配置决定打开方式
    const inPlace = getConfigValue('resumeInPlace');
    if (inPlace) {
      // 就地在当前终端恢复
      launchInteractiveClaude(targetWorktrees[0], { autoContinue: true });
    } else {
      // 默认通过 terminalApp 在新 Tab 中恢复
      const hasPreviousSession = hasClaudeSessionHistory(targetWorktrees[0].path);
      launchInteractiveClaudeInNewTerminal(targetWorktrees[0], hasPreviousSession);
    }
  } else {
    // 选中多个 → 逐个在新终端 Tab 中启动（不受 resumeInPlace 影响）
    await handleBatchResume(targetWorktrees);
  }
}

/**
 * 输出即将恢复的分支列表（含会话状态：继续/新对话）
 * @param {WorktreeInfo[]} worktrees - 待恢复的 worktree 列表
 * @param {Map<string, boolean>} sessionMap - worktree 路径 → 是否存在历史会话的映射
 */
function printBatchResumePreview(worktrees: WorktreeInfo[], sessionMap: Map<string, boolean>): void {
  printInfo('即将恢复的分支：');
  for (const wt of worktrees) {
    const modeLabel = sessionMap.get(wt.path) ? '继续上次对话' : '新对话';
    printInfo(`  - ${wt.branch} (${modeLabel})`);
  }
  printInfo('');
}

/**
 * 批量计算 worktree 的会话历史状态
 * 一次性遍历所有 worktree，避免后续流程中重复调用 hasClaudeSessionHistory 产生多余 I/O
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @returns {Map<string, boolean>} worktree 路径 → 是否存在历史会话的映射
 */
function buildSessionMap(worktrees: WorktreeInfo[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const wt of worktrees) {
    map.set(wt.path, hasClaudeSessionHistory(wt.path));
  }
  return map;
}

/**
 * 批量恢复多个 worktree 的 Claude Code 会话
 * 逐个在新终端 Tab 中启动
 * @param {WorktreeInfo[]} worktrees - 待恢复的 worktree 列表
 */
async function handleBatchResume(worktrees: WorktreeInfo[]): Promise<void> {
  // 一次性计算所有 worktree 的会话状态，后续传递使用避免重复 I/O
  const sessionMap = buildSessionMap(worktrees);

  // 输出即将恢复的分支列表
  printBatchResumePreview(worktrees, sessionMap);

  // 确认操作
  const confirmed = await confirmAction(MESSAGES.RESUME_ALL_CONFIRM(worktrees.length));
  if (!confirmed) {
    return;
  }

  // 逐个在新终端 Tab 中启动 Claude Code
  for (const wt of worktrees) {
    launchInteractiveClaudeInNewTerminal(wt, sessionMap.get(wt.path) ?? false);
  }

  printSuccess(MESSAGES.RESUME_ALL_SUCCESS(worktrees.length));
}
