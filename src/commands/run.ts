import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { RunOptions, ClaudeCodeResult, TaskResult, TaskSummary } from '../types/index.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  createWorktrees,
  spawnProcess,
  printSuccess,
  printError,
  printInfo,
  printSeparator,
  printDoubleSeparator,
  multilineInput,
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
    .option('--tasks <task...>', '任务列表（可多次指定），不传则进入交互式输入')
    .action(async (options: RunOptions) => {
      await handleRun(options);
    });
}

/**
 * 通过交互式输入框获取单个任务（支持粘贴多行文本）
 * @returns {Promise<string>} 用户输入的任务描述
 */
async function promptTask(): Promise<string> {
  const task = await multilineInput('请输入任务描述（Enter 确认，Shift/Alt+Enter 换行）:');

  const trimmed = task.trim();
  if (!trimmed) {
    throw new ClawtError('任务描述不能为空');
  }

  return trimmed;
}

/**
 * 在指定 worktree 中执行 Claude Code 任务
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {string} task - 任务描述
 * @returns {Promise<TaskResult>} 任务执行结果
 */
function executeClaudeTask(worktree: WorktreeInfo, task: string): Promise<TaskResult> {
  return new Promise((resolve) => {
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
 * 执行 run 命令的核心逻辑
 * @param {RunOptions} options - 命令选项
 */
async function handleRun(options: RunOptions): Promise<void> {
  validateMainWorktree();
  validateClaudeCodeInstalled();

  let tasks: string[];

  // 未传 --tasks 时，进入交互式输入
  if (!options.tasks || options.tasks.length === 0) {
    const task = await promptTask();
    tasks = [task];
  } else {
    tasks = options.tasks.map((t) => t.trim()).filter(Boolean);
  }

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
  const taskPromises = worktrees.map((wt, index) => {
    const task = tasks[index];
    logger.info(`启动任务 ${index + 1}: ${task} (worktree: ${wt.path})`);
    return executeClaudeTask(wt, task).then((result) => {
      // 实时输出完成通知
      printTaskNotification(result);
      return result;
    });
  });

  const results = await Promise.all(taskPromises);
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
