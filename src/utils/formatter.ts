import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { createInterface } from 'node:readline';

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
