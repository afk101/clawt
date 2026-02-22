import type { Command } from 'commander';
import type { ChildProcess } from 'node:child_process';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { RunOptions, ClaudeCodeResult, TaskResult, TaskSummary, WorktreeInfo } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  createWorktrees,
  createWorktreesByBranches,
  sanitizeBranchName,
  checkBranchExists,
  spawnProcess,
  killAllChildProcesses,
  cleanupWorktrees,
  getConfigValue,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSeparator,
  printDoubleSeparator,
  confirmAction,
  launchInteractiveClaude,
  ProgressRenderer,
  loadTaskFile,
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

/** executeClaudeTask 的返回结构，包含子进程引用和结果 Promise */
interface ClaudeTaskHandle {
  /** 子进程实例，用于在中断时终止 */
  child: ChildProcess;
  /** 任务结果 Promise */
  promise: Promise<TaskResult>;
}

/**
 * 在指定 worktree 中执行 Claude Code 任务，由于是--output-format json形式，所以这里固定claude code cli的启动命令
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {string} task - 任务描述
 * @returns {ClaudeTaskHandle} 包含子进程引用和结果 Promise
 */
function executeClaudeTask(worktree: WorktreeInfo, task: string): ClaudeTaskHandle {
  const child = spawnProcess(
    'claude',
    ['-p', task, '--output-format', 'json', '--permission-mode', 'bypassPermissions'],
    {
      cwd: worktree.path,
      // stdin 必须设置为 'ignore'，不能用 'pipe'
      // 原因：claude -p 是非交互模式，不需要 stdin 输入。如果 stdin 为 'pipe'，
      // 父进程会创建一个可写流连接到子进程但从不写入也不关闭，
      // claude 检测到 stdin 是管道后会尝试读取输入，导致进程永远卡住
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const promise = new Promise<TaskResult>((resolve) => {
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      let result: ClaudeCodeResult | null = null;
      let success = code === 0;

      try {
        if (stdout.trim()) {
          result = JSON.parse(stdout.trim()) as ClaudeCodeResult;
          success = !result.is_error;
        }
      } catch {
        logger.warn(`解析 Claude Code 输出失败: ${stdout.substring(0, 200)}`);
      }

      resolve({
        task,
        branch: worktree.branch,
        worktreePath: worktree.path,
        success,
        result,
        error: success ? undefined : stderr || '任务执行失败',
      });
    });

    child.on('error', (err) => {
      resolve({
        task,
        branch: worktree.branch,
        worktreePath: worktree.path,
        success: false,
        result: null,
        error: err.message,
      });
    });
  });

  return { child, promise };
}

/**
 * 输出单个任务完成通知
 * 注：引入进度面板后，handleRun 不再直接调用此函数，保留供其他场景使用
 * @param {TaskResult} taskResult - 任务结果
 */
function printTaskNotification(taskResult: TaskResult): void {
  const { success, worktreePath, branch, result } = taskResult;
  const status = success ? '完成' : '失败';
  const icon = success ? '✓' : '✗';
  const durationStr = result ? `${(result.duration_ms / 1000).toFixed(1)}s` : 'N/A';
  const costStr = result ? `$${result.total_cost_usd.toFixed(2)}` : 'N/A';
  const resultStr = success ? 'success' : 'failed';

  if (success) {
    printSuccess(`${icon} [${status}] worktree: ${worktreePath}`);
  } else {
    printError(`${icon} [${status}] worktree: ${worktreePath}`);
  }
  printInfo(`  分支: ${branch}`);
  printInfo(`  耗时: ${durationStr}`);
  printInfo(`  花费: ${costStr}`);
  printInfo(`  结果: ${resultStr}`);
  printSeparator();
}

/**
 * 输出所有任务的汇总信息
 * @param {TaskSummary} summary - 汇总信息
 */
function printTaskSummary(summary: TaskSummary): void {
  printDoubleSeparator();
  printInfo(`全部任务已完成 (${summary.total}/${summary.total})`);
  printInfo(`  成功: ${summary.succeeded}`);
  printInfo(`  失败: ${summary.failed}`);
  printInfo(`  总耗时: ${(summary.totalDurationMs / 1000).toFixed(1)}s`);
  printInfo(`  总花费: $${summary.totalCostUsd.toFixed(2)}`);
  printDoubleSeparator();
}

/**
 * 处理用户中断（Ctrl+C）后的清理流程
 * 根据全局配置决定自动清理或交互式确认
 * @param {WorktreeInfo[]} worktrees - 本次创建的 worktree 列表
 */
async function handleInterruptCleanup(worktrees: WorktreeInfo[]): Promise<void> {
  const autoDelete = getConfigValue('autoDeleteBranch');

  if (autoDelete) {
    // 全局配置了自动删除，直接清理
    cleanupWorktrees(worktrees);
    printSuccess(MESSAGES.INTERRUPT_AUTO_CLEANED(worktrees.length));
    return;
  }

  // 交互式确认是否清理
  const shouldClean = await confirmAction(MESSAGES.INTERRUPT_CONFIRM_CLEANUP);

  if (shouldClean) {
    cleanupWorktrees(worktrees);
    printSuccess(MESSAGES.INTERRUPT_CLEANED(worktrees.length));
  } else {
    printInfo(MESSAGES.INTERRUPT_KEPT);
  }
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
 * 更新进度面板中指定任务的完成/失败状态
 * @param {ProgressRenderer} renderer - 进度面板渲染器
 * @param {number} index - 任务索引（从 0 开始）
 * @param {TaskResult} result - 任务执行结果
 * @param {number} startTime - 任务批次启动时间戳
 */
function updateRendererStatus(renderer: ProgressRenderer, index: number, result: TaskResult, startTime: number): void {
  if (result.success) {
    renderer.markDone(
      index,
      result.result?.duration_ms ?? (Date.now() - startTime),
      result.result?.total_cost_usd ?? 0,
    );
  } else {
    renderer.markFailed(
      index,
      result.result?.duration_ms ?? (Date.now() - startTime),
    );
  }
}

/**
 * 以并发限制模式执行任务队列
 * 维护活跃任务池，某个任务完成后立即启动队列中下一个
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string[]} tasks - 任务描述列表
 * @param {number} concurrency - 最大并发数
 * @param {ProgressRenderer} renderer - 进度面板渲染器
 * @param {number} startTime - 任务批次启动时间戳
 * @param {() => boolean} isInterrupted - 检查是否已中断的函数
 * @param {ChildProcess[]} childProcesses - 共享子进程数组，执行过程中动态追加
 * @returns {Promise<TaskResult[]>} 所有任务结果
 */
async function executeWithConcurrency(
  worktrees: WorktreeInfo[],
  tasks: string[],
  concurrency: number,
  renderer: ProgressRenderer,
  startTime: number,
  isInterrupted: () => boolean,
  childProcesses: ChildProcess[],
): Promise<TaskResult[]> {
  const total = tasks.length;
  const results: TaskResult[] = new Array(total);
  let nextIndex = 0;
  let completedCount = 0;

  return new Promise((resolve) => {
    /**
     * 启动下一个排队中的任务
     * 从队列中取出任务并启动执行，完成时递归调用自身
     */
    function launchNext(): void {
      if (nextIndex >= total || isInterrupted()) return;

      const index = nextIndex;
      nextIndex++;

      const wt = worktrees[index];
      const task = tasks[index];
      logger.info(`启动任务 ${index + 1}: ${task} (worktree: ${wt.path})`);

      // 标记为运行中
      renderer.markRunning(index);

      const handle = executeClaudeTask(wt, task);
      childProcesses.push(handle.child);

      // 监听 stderr 输出，更新任务活动时间戳
      handle.child.stderr?.on('data', () => {
        renderer.updateActivity(index);
      });

      handle.promise.then((result) => {
        results[index] = result;
        completedCount++;

        // 被中断时不再更新面板
        if (!isInterrupted()) {
          updateRendererStatus(renderer, index, result, startTime);
        }

        // 启动下一个排队任务
        launchNext();

        // 所有任务完成时 resolve
        if (completedCount === total) {
          resolve(results);
        }
      });
    }

    // 初始启动 concurrency 个任务
    const initialBatch = Math.min(concurrency, total);
    for (let i = 0; i < initialBatch; i++) {
      launchNext();
    }
  });
}

/**
 * 以全量并行模式执行所有任务
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string[]} tasks - 任务描述列表
 * @param {ProgressRenderer} renderer - 进度面板渲染器
 * @param {number} startTime - 任务批次启动时间戳
 * @param {() => boolean} isInterrupted - 检查是否已中断的函数
 * @param {ChildProcess[]} childProcesses - 共享子进程数组，启动时追加
 * @returns {Promise<TaskResult[]>} 所有任务结果
 */
async function executeAllParallel(
  worktrees: WorktreeInfo[],
  tasks: string[],
  renderer: ProgressRenderer,
  startTime: number,
  isInterrupted: () => boolean,
  childProcesses: ChildProcess[],
): Promise<TaskResult[]> {
  const handles = worktrees.map((wt, index) => {
    const task = tasks[index];
    logger.info(`启动任务 ${index + 1}: ${task} (worktree: ${wt.path})`);
    const handle = executeClaudeTask(wt, task);
    childProcesses.push(handle.child);

    // 监听 stderr 输出，更新任务活动时间戳
    handle.child.stderr?.on('data', () => {
      renderer.updateActivity(index);
    });

    return handle;
  });

  const results = await Promise.all(
    handles.map((handle, index) =>
      handle.promise.then((result) => {
        // 被中断时不再更新面板
        if (!isInterrupted()) {
          updateRendererStatus(renderer, index, result, startTime);
        }
        return result;
      }),
    ),
  );

  return results;
}

/**
 * 批量任务执行的公共逻辑
 * 负责进度面板、SIGINT 处理、并发控制、汇总输出
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string[]} tasks - 任务描述列表
 * @param {number} concurrency - 最大并发数，0 表示不限制
 */
async function executeBatchTasks(
  worktrees: WorktreeInfo[],
  tasks: string[],
  concurrency: number,
): Promise<void> {
  const count = tasks.length;

  // 有并发限制时输出提示
  if (concurrency > 0) {
    printInfo(MESSAGES.CONCURRENCY_INFO(concurrency, count));
    printInfo('');
  }

  // 实例化进度面板渲染器
  const startTime = Date.now();
  const branches = worktrees.map((wt) => wt.branch);
  // 有并发限制时任务初始化为 pending 状态，否则初始化为 running
  const allRunning = concurrency === 0;
  const renderer = new ProgressRenderer(branches, allRunning);

  // 启动进度面板渲染
  renderer.start();

  // 共享中断状态标志和子进程引用数组
  let interrupted = false;
  const isInterrupted = () => interrupted;
  const childProcesses: ChildProcess[] = [];

  // 监听 SIGINT（Ctrl+C），终止所有子进程并触发清理流程
  const sigintHandler = async () => {
    if (interrupted) return;
    interrupted = true;

    // 停止进度面板渲染
    renderer.stop();

    printInfo('');
    printWarning(MESSAGES.INTERRUPTED);
    killAllChildProcesses(childProcesses);

    // 等待所有已启动的子进程退出后再执行清理
    await Promise.allSettled(childProcesses.map((cp) =>
      new Promise<void>((resolve) => {
        if (cp.exitCode !== null) {
          resolve();
        } else {
          cp.on('close', () => resolve());
        }
      }),
    ));

    await handleInterruptCleanup(worktrees);
    process.exit(1);
  };
  process.on('SIGINT', sigintHandler);

  // 根据并发限制选择执行模式
  const results = concurrency > 0
    ? await executeWithConcurrency(worktrees, tasks, concurrency, renderer, startTime, isInterrupted, childProcesses)
    : await executeAllParallel(worktrees, tasks, renderer, startTime, isInterrupted, childProcesses);

  // 正常完成，停止进度面板并移除 SIGINT 监听器
  renderer.stop();
  process.removeListener('SIGINT', sigintHandler);

  // 被中断时不输出汇总（已在 sigintHandler 中处理退出）
  if (interrupted) return;

  const totalDurationMs = Date.now() - startTime;

  // 汇总
  const summary: TaskSummary = {
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    totalDurationMs,
    totalCostUsd: results.reduce((sum, r) => sum + (r.result?.total_cost_usd ?? 0), 0),
  };

  printTaskSummary(summary);
}

/**
 * 处理从任务文件执行的逻辑
 * @param {RunOptions} options - 命令选项（包含 file 字段）
 */
async function handleRunFromFile(options: RunOptions): Promise<void> {
  // 加载并解析任务文件
  const entries = loadTaskFile(options.file!);
  printSuccess(MESSAGES.TASK_FILE_LOADED(entries.length, options.file!));

  const tasks = entries.map((e) => e.task);

  let worktrees: WorktreeInfo[];

  if (options.branch) {
    // 有 -b 参数：忽略文件中的分支名，用 -b 自动编号
    worktrees = createWorktrees(options.branch, entries.length);
  } else {
    // 无 -b 参数：使用文件中每个任务的独立分支名
    const branches = entries.map((e) => sanitizeBranchName(e.branch));
    worktrees = createWorktreesByBranches(branches);
  }

  printSuccess(MESSAGES.WORKTREE_CREATED(worktrees.length));
  for (const wt of worktrees) {
    printInfo(`  分支: ${wt.branch}  路径: ${wt.path}`);
  }
  printInfo('');

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
  printSuccess(MESSAGES.WORKTREE_CREATED(worktrees.length));
  for (const wt of worktrees) {
    printInfo(`  分支: ${wt.branch}  路径: ${wt.path}`);
  }
  printInfo('');

  await executeBatchTasks(worktrees, tasks, concurrency);
}
