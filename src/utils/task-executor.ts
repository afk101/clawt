import type { ChildProcess } from 'node:child_process';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ClaudeCodeResult, TaskResult, TaskSummary, WorktreeInfo } from '../types/index.js';
import { spawnProcess, killAllChildProcesses } from './shell.js';
import { cleanupWorktrees } from './worktree.js';
import { getConfigValue } from './config.js';
import { APPEND_SYSTEM_PROMPT } from '../constants/index.js';
import { printSuccess, printWarning, printInfo, printDoubleSeparator, confirmAction } from './formatter.js';
import { ProgressRenderer } from './progress.js';
import { createLineBuffer, parseStreamLine, parseStreamEvent, truncateText } from './stream-parser.js';
import { RESULT_PREVIEW_MAX_LENGTH } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';

/** executeClaudeTask 的返回结构，包含子进程引用和结果 Promise */
interface ClaudeTaskHandle {
  /** 子进程实例，用于在中断时终止 */
  child: ChildProcess;
  /** 任务结果 Promise */
  promise: Promise<TaskResult>;
}

/**
 * 活动更新回调函数类型
 * @param {string} activityText - 活动描述文本
 */
type ActivityCallback = (activityText: string) => void;

/**
 * 在指定 worktree 中执行 Claude Code 任务，使用 stream-json 格式获取实时事件
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {string} task - 任务描述
 * @param {ActivityCallback} [onActivity] - 活动更新回调（可选）
 * @param {boolean} [continueSession] - 是否继续该 worktree 目录下最新的会话
 * @returns {ClaudeTaskHandle} 包含子进程引用和结果 Promise
 */
function executeClaudeTask(worktree: WorktreeInfo, task: string, onActivity?: ActivityCallback, continueSession?: boolean): ClaudeTaskHandle {
  // 使用统一的系统提示常量
  const systemPrompt = APPEND_SYSTEM_PROMPT;

  // 旧版使用 --output-format json，现改为 stream-json --verbose 以支持实时活动信息
  const args = ['-p', task, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions', '--append-system-prompt', systemPrompt];

  // 追问模式：追加 --continue 继续该目录下最新会话
  if (continueSession) {
    args.push('--continue');
  }

  const child = spawnProcess(
    'claude',
    args,
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
    let stderr = '';
    let finalResult: ClaudeCodeResult | null = null;
    const lineBuffer = createLineBuffer();

    child.stdout?.on('data', (data: Buffer) => {
      const lines = lineBuffer.push(data.toString());
      for (const line of lines) {
        const event = parseStreamLine(line);
        if (!event) continue;

        const parsed = parseStreamEvent(event);
        if (!parsed) continue;

        if (parsed.kind === 'result') {
          // 最终结果事件
          finalResult = parsed.result ?? null;
        } else if (parsed.activityText && onActivity) {
          // 活动事件，回调通知
          onActivity(parsed.activityText);
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // 处理缓冲区中可能残留的最后一行
      const remaining = lineBuffer.flush();
      if (remaining) {
        const event = parseStreamLine(remaining);
        if (event) {
          const parsed = parseStreamEvent(event);
          if (parsed?.kind === 'result') {
            finalResult = parsed.result ?? null;
          }
        }
      }

      let success = code === 0;
      if (finalResult) {
        success = !finalResult.is_error;
      }

      resolve({
        task,
        branch: worktree.branch,
        worktreePath: worktree.path,
        success,
        result: finalResult,
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
 * 更新进度面板中指定任务的完成/失败状态
 * @param {ProgressRenderer} renderer - 进度面板渲染器
 * @param {number} index - 任务索引（从 0 开始）
 * @param {TaskResult} result - 任务执行结果
 * @param {number} startTime - 任务批次启动时间戳
 */
function updateRendererStatus(renderer: ProgressRenderer, index: number, result: TaskResult, startTime: number): void {
  // 从 ClaudeCodeResult.result 中提取结果预览文本
  // 先清理换行符和多余空白（结果文本可能包含多行），再截断到最大长度
  const rawResultText = result.result?.result;
  const resultPreview = rawResultText
    ? truncateText(rawResultText.replace(/[\n\r\t]+/g, ' ').trim(), RESULT_PREVIEW_MAX_LENGTH)
    : undefined;

  if (result.success) {
    renderer.markDone(
      index,
      result.result?.duration_ms ?? (Date.now() - startTime),
      result.result?.total_cost_usd ?? 0,
      resultPreview,
    );
  } else {
    renderer.markFailed(
      index,
      result.result?.duration_ms ?? (Date.now() - startTime),
      resultPreview,
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
 * @param {boolean[]} [continueFlags] - 按索引对应每个任务是否继续已有会话（追问模式，追加 --continue）
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
  continueFlags?: boolean[],
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

      const handle = executeClaudeTask(wt, task, (activityText) => {
        renderer.updateActivityText(index, activityText);
      }, continueFlags?.[index]);
      childProcesses.push(handle.child);

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
 * @param {boolean[]} [continueFlags] - 按索引对应每个任务是否继续已有会话（追问模式，追加 --continue）
 * @returns {Promise<TaskResult[]>} 所有任务结果
 */
async function executeAllParallel(
  worktrees: WorktreeInfo[],
  tasks: string[],
  renderer: ProgressRenderer,
  startTime: number,
  isInterrupted: () => boolean,
  childProcesses: ChildProcess[],
  continueFlags?: boolean[],
): Promise<TaskResult[]> {
  const handles = worktrees.map((wt, index) => {
    const task = tasks[index];
    logger.info(`启动任务 ${index + 1}: ${task} (worktree: ${wt.path})`);
    const handle = executeClaudeTask(wt, task, (activityText) => {
      renderer.updateActivityText(index, activityText);
    }, continueFlags?.[index]);
    childProcesses.push(handle.child);

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
 * @param {boolean[]} [continueFlags] - 按索引对应每个任务是否继续已有会话（追问模式，追加 --continue）
 * @returns {Promise<TaskResult[]>} 所有任务的执行结果
 * @throws {ClawtError} continueFlags 长度与任务数不一致时抛出
 */
export async function executeBatchTasks(
  worktrees: WorktreeInfo[],
  tasks: string[],
  concurrency: number,
  continueFlags?: boolean[],
): Promise<TaskResult[]> {
  const count = tasks.length;

  // 校验 continueFlags 长度与 worktrees 一致，防止调用方传入不匹配的数组
  if (continueFlags && continueFlags.length !== count) {
    throw new ClawtError(
      `continueFlags 长度 (${continueFlags.length}) 与任务数 (${count}) 不一致`,
    );
  }

  // 有并发限制时输出提示
  if (concurrency > 0) {
    printInfo(MESSAGES.CONCURRENCY_INFO(concurrency, count));
    printInfo('');
  }

  // 实例化进度面板渲染器
  const startTime = Date.now();
  const branches = worktrees.map((wt) => wt.branch);
  const paths = worktrees.map((wt) => wt.path);
  // 有并发限制时任务初始化为 pending 状态，否则初始化为 running
  const allRunning = concurrency === 0;
  const renderer = new ProgressRenderer(branches, paths, allRunning);

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
    ? await executeWithConcurrency(worktrees, tasks, concurrency, renderer, startTime, isInterrupted, childProcesses, continueFlags)
    : await executeAllParallel(worktrees, tasks, renderer, startTime, isInterrupted, childProcesses, continueFlags);

  // 正常完成，停止进度面板并移除 SIGINT 监听器
  renderer.stop();
  process.removeListener('SIGINT', sigintHandler);

  // 被中断时不输出汇总（已在 sigintHandler 中处理退出）
  if (interrupted) return [];

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

  return results;
}
