import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { RunOptions, WorktreeInfo } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  createWorktrees,
  createWorktreesByBranches,
  sanitizeBranchName,
  checkBranchExists,
  getConfigValue,
  printSuccess,
  launchInteractiveClaude,
  loadTaskFile,
  executeBatchTasks,
} from '../utils/index.js';

/**
 * 注册 run 命令：批量创建 worktree 并执行 Claude Code 任务
 * @param {Command} program - Commander 实例
 */
export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('批量创建 worktree 并启动 Claude Code 执行任务')
    .option('-b, --branch <branchName>', '分支名')
    .option('--tasks <task...>', '任务列表（可多次指定），不传则在 worktree 中打开 Claude Code 交互式界面')
    .option('-c, --concurrency <n>', '最大并发数，0 表示不限制')
    .option('-f, --file <path>', '从任务文件读取任务列表（与 --tasks 互斥）')
    .action(async (options: RunOptions) => {
      await handleRun(options);
    });
}

/**
 * 解析并发数参数
 * 优先级：命令行参数 > 全局配置 > 默认值 0
 * @param {string | undefined} optionValue - 命令行传入的并发数字符串
 * @param {number} configValue - 全局配置中的默认并发数
 * @returns {number} 解析后的并发数，0 表示不限制
 */
function parseConcurrency(optionValue: string | undefined, configValue: number): number {
  if (optionValue === undefined) {
    return configValue;
  }

  const parsed = parseInt(optionValue, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new ClawtError(MESSAGES.CONCURRENCY_INVALID);
  }
  return parsed;
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

  // 解析并发数
  const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));

  logger.info(`run 命令（文件模式）执行，任务数: ${entries.length}，并发数: ${concurrency || '不限制'}`);

  await executeBatchTasks(worktrees, tasks, concurrency);
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
  validateMainWorktree();
  validateClaudeCodeInstalled();

  // 互斥校验：--file 和 --tasks 不能同时使用
  if (options.file && options.tasks) {
    throw new ClawtError(MESSAGES.FILE_AND_TASKS_CONFLICT);
  }

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
    printSuccess(MESSAGES.WORKTREE_CREATED(1));

    launchInteractiveClaude(worktree);
    return;
  }

  const tasks = options.tasks.map((t) => t.trim()).filter(Boolean);

  if (tasks.length === 0) {
    throw new ClawtError('任务列表不能为空');
  }

  const count = tasks.length;

  // 解析并发数：命令行参数 > 全局配置 > 默认值 0
  const concurrency = parseConcurrency(options.concurrency, getConfigValue('maxConcurrency'));

  logger.info(`run 命令执行，分支: ${options.branch}，任务数: ${count}，并发数: ${concurrency || '不限制'}`);

  // 创建 worktree
  const worktrees = createWorktrees(options.branch, count);

  await executeBatchTasks(worktrees, tasks, concurrency);
}
