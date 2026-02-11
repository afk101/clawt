import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { createInterface } from 'node:readline';
import type { WorktreeStatus } from '../types/index.js';

/**
 * 输出成功信息
 * @param {string} message - 消息内容
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(message));
}

/**
 * 输出错误信息
 * @param {string} message - 消息内容
 */
export function printError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

/**
 * 输出警告信息
 * @param {string} message - 消息内容
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * 输出普通信息
 * @param {string} message - 消息内容
 */
export function printInfo(message: string): void {
  console.log(message);
}

/**
 * 输出分隔线
 */
export function printSeparator(): void {
  console.log(MESSAGES.SEPARATOR);
}

/**
 * 输出粗分隔线
 */
export function printDoubleSeparator(): void {
  console.log(MESSAGES.DOUBLE_SEPARATOR);
}

/**
 * 简易 yes/no 确认（非交互式场景使用）
 * @param {string} question - 确认问题
 * @returns {Promise<boolean>} 用户是否确认
 */
export function confirmAction(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * 将 WorktreeStatus 格式化为带颜色的字符串
 * @param {WorktreeStatus} status - worktree 变更统计信息
 * @returns {string} 格式化后的状态字符串
 */
export function formatWorktreeStatus(status: WorktreeStatus): string {
  const parts: string[] = [];

  // 提交数（黄色）
  parts.push(chalk.yellow(`${status.commitCount} 个提交`));

  // 变更统计
  if (status.insertions === 0 && status.deletions === 0) {
    parts.push('无变更');
  } else {
    const diffParts: string[] = [];
    diffParts.push(chalk.green(`+${status.insertions}`));
    diffParts.push(chalk.red(`-${status.deletions}`));
    parts.push(diffParts.join(' '));
  }

  // 未提交修改提示（灰色）
  if (status.hasDirtyFiles) {
    parts.push(chalk.gray('(未提交修改)'));
  }

  return parts.join('   ');
}
