import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { RunOptions, WorktreeInfo } from '../types/index.js';
import { PRE_CHECK_DRY_RUN, PRE_CHECK_RUN } from '../constants/index.js';
import {
  runPreChecks,
  validateClaudeCodeInstalled,
  createWorktrees,
  createWorktreesByBranches,
  sanitizeBranchName,
  generateBranchNames,
  checkBranchExists,
  getConfigValue,
  parseConcurrency,
  printSuccess,
  launchInteractiveClaude,
  loadTaskFile,
  parseTasksFromOptions,
  executeBatchTasks,
  printDryRunPreview,
  runPostCreateHooks,
} from '../utils/index.js';

/**
 * 注册 run 命令：批量创建 worktree + 启动 Claude Code 执行任务（支持任务文件）
 * @param {Command} program - Commander 实例
 */
export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('批量创建 worktree + 启动 Claude Code 执行任务（支持任务文件）')
    .option('-b, --branch <branchName>', '分支名')
    .option('--tasks <task...>', '任务列表（可多次指定），不传则在 worktree 中打开 Claude Code 交互式界面')
    .option('-c, --concurrency <n>', '最大并发数，0 表示不限制')
    .option('-f, --file <path>', '从任务文件读取任务列表（与 --tasks 互斥）')
    .option('--dry-run', '预览模式，仅展示任务计划不实际执行')
    .option('--post-create', '执行 postCreate hook（默认开启，--no-post-create 跳过）', true)
    .action(async (options: RunOptions) => {
      await handleRun(options);
    });
}

/**
 * 从任务文件解析出分支名列表
 * 有 -b 参数时使用自动编号，否则使用文件中每个任务块的独立分支名
 * @param {RunOptions} options - 命令选项
 * @param {number} entryCount - 任务条目数量
 * @param {Array<{branch?: string}>} entries - 解析出的任务条目（含可选分支名）
 * @returns {string[]} 分支名列表
 */
function resolveBranchNamesFromFile(
  options: RunOptions,
  entryCount: number,
  entries: Array<{ branch?: string }>,
): string[] {
  if (options.branch) {
    // 有 -b 参数：忽略文件中的分支名，用 -b 自动编号
    const sanitized = sanitizeBranchName(options.branch);
    return generateBranchNames(sanitized, entryCount);
  }
  // 无 -b 参数：使用文件中每个任务的独立分支名
  return entries.map((e) => sanitizeBranchName(e.branch!));
}

/**
 * 处理从任务文件执行的逻辑
 * @param {RunOptions} options - 命令选项（包含 file 字段）
 */
async function handleRunFromFile(options: RunOptions): Promise<void> {
  // 有 -b 参数时，文件中的分支名为可选
  const branchRequired = !options.branch;
  // 加载并解析任务文件
  const entries = loadTaskFile(options.file!, { branchRequired });
  printSuccess(MESSAGES.TASK_FILE_LOADED(entries.length, options.file!));

  const tasks = entries.map((e) => e.task);

  let worktrees: WorktreeInfo[];

  if (options.branch) {
    // 有 -b 参数：忽略文件中的分支名，用 -b 自动编号
    worktrees = createWorktrees(options.branch, entries.length);
  } else {
    // 无 -b 参数：使用文件中每个任务的独立分支名
    const branches = entries.map((e) => sanitizeBranchName(e.branch!));
    worktrees = createWorktreesByBranches(branches);
  }

  // 执行 postCreate hook（后台异步，不阻塞）
  runPostCreateHooks(worktrees, !options.postCreate);

  // 解析并发数
  const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));

  logger.info(`run 命令（文件模式）执行，任务数: ${entries.length}，并发数: ${concurrency || '不限制'}`);

  await executeBatchTasks(worktrees, tasks, concurrency);
}

/**
 * 处理 dry-run 模式下从任务文件读取的逻辑
 * @param {RunOptions} options - 命令选项（包含 file 字段）
 */
function handleDryRunFromFile(options: RunOptions): void {
  const branchRequired = !options.branch;
  const entries = loadTaskFile(options.file!, { branchRequired });
  printSuccess(MESSAGES.TASK_FILE_LOADED(entries.length, options.file!));

  const tasks = entries.map((e) => e.task);
  const branchNames = resolveBranchNamesFromFile(options, entries.length, entries);
  const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));

  printDryRunPreview(branchNames, tasks, concurrency);
}

/**
 * 执行 run 命令的核心逻辑
 * 支持三种模式：
 * 1. -f 任务文件模式
 * 2. --tasks 命令行任务模式
 * 3. 无任务参数时打开交互式界面
 * @param {RunOptions} options - 命令选项
 */
async function handleRun(options: RunOptions): Promise<void> {
  const preChecks = options.dryRun ? PRE_CHECK_DRY_RUN : PRE_CHECK_RUN;
  await runPreChecks(preChecks);

  // 互斥校验：--file 和 --tasks 不能同时使用
  if (options.file && options.tasks) {
    throw new ClawtError(MESSAGES.FILE_AND_TASKS_CONFLICT);
  }

  // dry-run 模式：仅解析和展示任务计划，不实际创建 worktree 或启动 Claude Code
  if (options.dryRun) {
    // dry-run 不需要校验 Claude Code 是否安装
    if (options.file) {
      return handleDryRunFromFile(options);
    }

    if (!options.branch) {
      throw new ClawtError(MESSAGES.BRANCH_OR_FILE_REQUIRED);
    }

    const sanitized = sanitizeBranchName(options.branch);

    if (!options.tasks || options.tasks.length === 0) {
      // 交互式模式 dry-run：展示单个 worktree 信息
      printDryRunPreview([sanitized], [], 0);
      return;
    }

    const tasks = parseTasksFromOptions(options.tasks);
    const branchNames = generateBranchNames(sanitized, tasks.length);
    const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));
    printDryRunPreview(branchNames, tasks, concurrency);
    return;
  }

  // 正常执行模式需要校验 Claude Code
  validateClaudeCodeInstalled();

  // --file 模式
  if (options.file) {
    return handleRunFromFile(options);
  }

  // 非 --file 模式必须指定 -b
  if (!options.branch) {
    throw new ClawtError(MESSAGES.BRANCH_OR_FILE_REQUIRED);
  }

  // 未传 --tasks 时，创建单个 worktree 并打开 Claude Code 交互式界面
  if (!options.tasks || options.tasks.length === 0) {
    // 分支已存在时，提示用户使用 resume 恢复会话
    const sanitized = sanitizeBranchName(options.branch);
    if (checkBranchExists(sanitized)) {
      throw new ClawtError(MESSAGES.BRANCH_EXISTS_USE_RESUME(sanitized));
    }

    const worktrees = createWorktrees(options.branch, 1);
    const worktree = worktrees[0];

    // 执行 postCreate hook（后台异步，不阻塞）
    runPostCreateHooks(worktrees, !options.postCreate);

    printSuccess(MESSAGES.WORKTREE_CREATED(1));

    launchInteractiveClaude(worktree);
    return;
  }

  const tasks = parseTasksFromOptions(options.tasks);
  const count = tasks.length;

  // 解析并发数：命令行参数 > 全局配置 > 默认值 0
  const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));

  logger.info(`run 命令执行，分支: ${options.branch}，任务数: ${count}，并发数: ${concurrency || '不限制'}`);

  // 创建 worktree
  const worktrees = createWorktrees(options.branch, count);

  // 执行 postCreate hook（后台异步，不阻塞）
  runPostCreateHooks(worktrees, !options.postCreate);

  await executeBatchTasks(worktrees, tasks, concurrency);
}
