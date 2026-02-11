import type { Command } from 'commander';
import type { ChildProcess } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES, APPEND_SYSTEM_PROMPT } from '../constants/index.js';
import type { RunOptions, ClaudeCodeResult, TaskResult, TaskSummary } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  createWorktrees,
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
} from '../utils/index.js';
import type { WorktreeInfo } from '../types/index.js';

/**
 * 注册 run 命令：批量创建 worktree 并执行 Claude Code 任务
 * @param {Command} program - Commander 实例
 */
export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('批量创建 worktree 并启动 Claude Code 执行任务')
    .requiredOption('-b, --branch <branchName>', '分支名')
    .option('--tasks <task...>', '任务列表（可多次指定），不传则在 worktree 中打开 Claude Code 交互式界面')
    .action(async (options: RunOptions) => {
      await handleRun(options);
    });
}

/**
 * 在指定 worktree 中启动 Claude Code CLI 交互式界面
 * 使用 spawnSync + inherit stdio，让用户直接与 Claude Code 交互
 * @param {WorktreeInfo} worktree - worktree 信息
 */
function launchInteractiveClaude(worktree: WorktreeInfo): void {
  const commandStr = getConfigValue('claudeCodeCommand');
  const parts = commandStr.split(/\s+/).filter(Boolean);
  const cmd = parts[0];
  const args = [
    ...parts.slice(1),
    '--append-system-prompt',
    APPEND_SYSTEM_PROMPT,
  ];

  printInfo(`正在 worktree 中启动 Claude Code 交互式界面...`);
  printInfo(`  分支: ${worktree.branch}`);
  printInfo(`  路径: ${worktree.path}`);
  printInfo(`  指令: ${commandStr}`);
  printInfo('');

  const result = spawnSync(cmd, args, {
    cwd: worktree.path,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new ClawtError(`启动 Claude Code 失败: ${result.error.message}`);
  }

  if (result.status !== null && result.status !== 0) {
    printWarning(`Claude Code 退出码: ${result.status}`);
  }
}

/** executeClaudeTask 的返回结构，包含子进程引用和结果 Promise */
interface ClaudeTaskHandle {
  /** 子进程实例，用于在中断时终止 */
  child: ChildProcess;
  /** 任务结果 Promise */
  promise: Promise<TaskResult>;
}

/**
 * 在指定 worktree 中执行 Claude Code 任务
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
 * 执行 run 命令的核心逻辑
 * 不传 --tasks 时创建单个 worktree 并打开 Claude Code 交互式界面
 * 传 --tasks 时批量创建 worktree 并并行执行任务
 * @param {RunOptions} options - 命令选项
 */
async function handleRun(options: RunOptions): Promise<void> {
  validateMainWorktree();
  validateClaudeCodeInstalled();

  // 未传 --tasks 时，创建单个 worktree 并打开 Claude Code 交互式界面
  if (!options.tasks || options.tasks.length === 0) {
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
  logger.info(`run 命令执行，分支: ${options.branch}，任务数: ${count}`);

  // 创建 worktree
  const worktrees = createWorktrees(options.branch, count);
  printSuccess(MESSAGES.WORKTREE_CREATED(worktrees.length));
  for (const wt of worktrees) {
    printInfo(`  分支: ${wt.branch}  路径: ${wt.path}`);
  }
  printInfo('');

  // 并行执行 Claude Code 任务，每个完成时实时通知
  const startTime = Date.now();
  const handles = worktrees.map((wt, index) => {
    const task = tasks[index];
    logger.info(`启动任务 ${index + 1}: ${task} (worktree: ${wt.path})`);
    return executeClaudeTask(wt, task);
  });

  // 收集所有子进程引用，用于中断时终止
  const childProcesses = handles.map((h) => h.child);

  // 监听 SIGINT（Ctrl+C），终止所有子进程并触发清理流程
  let interrupted = false;
  const sigintHandler = async () => {
    if (interrupted) return;
    interrupted = true;

    printInfo('');
    printWarning(MESSAGES.INTERRUPTED);
    killAllChildProcesses(childProcesses);

    // 等待所有子进程退出后再执行清理
    await Promise.allSettled(handles.map((h) => h.promise));

    await handleInterruptCleanup(worktrees);
    process.exit(1);
  };
  process.on('SIGINT', sigintHandler);

  const taskPromises = handles.map((handle) =>
    handle.promise.then((result) => {
      // 被中断时不再输出通知
      if (!interrupted) {
        printTaskNotification(result);
      }
      return result;
    }),
  );

  const results = await Promise.all(taskPromises);

  // 正常完成，移除 SIGINT 监听器
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
