import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ResumeOptions } from '../types/index.js';
import type { WorktreeInfo } from '../types/index.js';
import { PRE_CHECK_RESUME } from '../constants/index.js';
import {
  runPreChecks,
  getProjectWorktrees,
  launchInteractiveClaude,
  launchInteractiveClaudeInNewTerminal,
  hasClaudeSessionHistory,
  resolveTargetWorktrees,
  promptGroupedMultiSelectBranches,
  findExactMatch,
  printInfo,
  printSuccess,
  printWarning,
  confirmAction,
  getConfigValue,
  parseConcurrency,
  loadTaskFile,
  executeBatchTasks,
  loadSessionId,
  persistSessionIds,
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
    .option('--prompt <content>', '非交互式追问（需配合 -b 指定分支）')
    .option('-f, --file <path>', '从任务文件批量追问（通过 branch 名匹配已有 worktree）')
    .option('-c, --concurrency <n>', '批量追问最大并发数，0 表示不限制')
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
  await runPreChecks(PRE_CHECK_RESUME);

  // 非交互式追问逻辑分支
  if (options.prompt && options.file) {
    throw new ClawtError(MESSAGES.RESUME_PROMPT_FILE_CONFLICT);
  }

  if (options.prompt) {
    if (!options.branch) {
      throw new ClawtError(MESSAGES.RESUME_PROMPT_REQUIRES_BRANCH);
    }
    const worktrees = getProjectWorktrees();
    const worktree = resolveWorktreeByBranch(options.branch, worktrees);
    return handleNonInteractiveSingleResume(worktree, options.prompt);
  }

  if (options.file) {
    return handleNonInteractiveBatchResume(options.file, options);
  }

  // 原有交互式逻辑
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
 * 精确匹配分支对应的 worktree
 * 找不到时抛出包含可用分支列表的错误
 * @param {string} branch - 目标分支名
 * @param {WorktreeInfo[]} worktrees - 可用的 worktree 列表
 * @returns {WorktreeInfo} 匹配的 worktree
 * @throws {ClawtError} 未找到匹配分支时抛出
 */
function resolveWorktreeByBranch(branch: string, worktrees: WorktreeInfo[]): WorktreeInfo {
  const match = findExactMatch(worktrees, branch);
  if (!match) {
    const available = worktrees.map((wt) => wt.branch);
    throw new ClawtError(MESSAGES.RESUME_WORKTREE_NOT_FOUND(branch, available));
  }
  return match;
}

/**
 * 非交互式单分支追问
 * 读取历史 session_id，调用 executeBatchTasks 执行追问，并更新 session_id
 * @param {WorktreeInfo} worktree - 目标 worktree
 * @param {string} prompt - 追问内容
 */
async function handleNonInteractiveSingleResume(worktree: WorktreeInfo, prompt: string): Promise<void> {
  const sessionId = loadSessionId(worktree.branch);

  if (sessionId) {
    printInfo(MESSAGES.RESUME_SESSION_LOADED(worktree.branch));
  } else {
    printWarning(MESSAGES.RESUME_NO_SESSION_WARNING(worktree.branch));
  }

  const sessionIds = [sessionId ?? undefined] as string[];
  const results = await executeBatchTasks([worktree], [prompt], 0, sessionIds);
  persistSessionIds(results);
}

/**
 * 非交互式批量追问
 * 从任务文件解析追问内容，按 branch 名精确匹配已有 worktree，批量执行
 * @param {string} filePath - 追问任务文件路径
 * @param {ResumeOptions} options - 命令选项（含并发数配置）
 */
async function handleNonInteractiveBatchResume(filePath: string, options: ResumeOptions): Promise<void> {
  // 解析追问文件，branch 为必填字段
  const entries = loadTaskFile(filePath, { branchRequired: true });
  printSuccess(MESSAGES.RESUME_FOLLOW_UP_FILE_LOADED(entries.length, filePath));

  // 获取所有已有 worktree
  const allWorktrees = getProjectWorktrees();

  // 按 branch 名精确匹配 worktree，构建执行参数
  const worktrees: WorktreeInfo[] = [];
  const tasks: string[] = [];
  const sessionIds: string[] = [];

  for (const entry of entries) {
    const worktree = resolveWorktreeByBranch(entry.branch!, allWorktrees);
    worktrees.push(worktree);
    tasks.push(entry.task);

    const sessionId = loadSessionId(worktree.branch);
    sessionIds.push(sessionId ?? (undefined as unknown as string));
  }

  // 解析并发数
  const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));

  logger.info(`resume 命令（批量追问模式）执行，任务数: ${entries.length}，并发数: ${concurrency || '不限制'}`);

  const results = await executeBatchTasks(worktrees, tasks, concurrency, sessionIds);
  persistSessionIds(results);
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
