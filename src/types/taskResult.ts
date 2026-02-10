import type { ClaudeCodeResult } from './claudeCode.js';

/** 单个任务的执行结果 */
export interface TaskResult {
  /** 任务描述 */
  task: string;
  /** 分支名 */
  branch: string;
  /** worktree 路径 */
  worktreePath: string;
  /** 是否成功 */
  success: boolean;
  /** Claude Code 的输出结果 */
  result: ClaudeCodeResult | null;
  /** 错误信息（失败时） */
  error?: string;
}

/** 所有任务的汇总信息 */
export interface TaskSummary {
  /** 总任务数 */
  total: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 总耗时（毫秒） */
  totalDurationMs: number;
  /** 总花费（美元） */
  totalCostUsd: number;
}
