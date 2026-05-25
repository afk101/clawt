import Enquirer from 'enquirer';
import { isNonInteractive } from './interactive.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';

/**
 * 多行交互式输入框
 * 使用 enquirer 的 Input prompt（multiline 模式）实现
 * @param {string} message - 提示信息
 * @returns {Promise<string>} 用户输入的文本内容
 */
export async function multilineInput(message: string): Promise<string> {
  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  const prompt = new Enquirer.Input({
    message,
    multiline: true,
  });

  const result: string = await prompt.run();
  return result;
}

/**
 * 交互式询问提交信息（单行输入）
 * 非交互模式下直接抛出 ClawtError，空输入同样抛错
 * @param {string} promptMessage - 交互式提示信息
 * @param {string} nonInteractiveErrorMessage - 非交互模式下的错误消息
 * @returns {Promise<string>} 用户输入的提交信息
 * @throws {ClawtError} 非交互模式或用户输入为空时抛出
 */
export async function promptCommitMessage(
  promptMessage: string,
  nonInteractiveErrorMessage: string,
): Promise<string> {
  // 非交互模式下无法弹出输入框，直接抛错
  if (isNonInteractive()) {
    throw new ClawtError(nonInteractiveErrorMessage);
  }

  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  const prompt = new Enquirer.Input({
    message: promptMessage,
  });

  const result: string = await prompt.run();

  // 空输入视为无效
  if (!result.trim()) {
    throw new ClawtError(MESSAGES.COMMIT_MESSAGE_NOT_EMPTY);
  }

  return result.trim();
}
