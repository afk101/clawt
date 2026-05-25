import { MESSAGES } from '../constants/index.js';
import {
  printInfo,
  printSuccess,
  printError,
  printWarning,
  printSeparator,
  parseParallelCommands,
} from './index.js';
import { runCommandWithStderrCapture, runParallelCommandsWithStderrCapture } from './shell.js';
import type { ParallelCommandResultWithStderr } from './shell.js';
import { copyToClipboard } from './clipboard.js';

/**
 * 处理命令执行失败后的剪贴板复制逻辑
 * 将格式化的错误信息复制到系统剪贴板，并输出操作结果提示
 * @param {string} clipboardContent - 要复制到剪贴板的完整错误信息
 */
function handleErrorClipboard(clipboardContent: string): void {
  const success = copyToClipboard(clipboardContent);
  if (success) {
    printInfo(MESSAGES.VALIDATE_RUN_ERROR_COPIED);
  } else {
    printWarning(MESSAGES.VALIDATE_RUN_ERROR_COPY_FAILED);
  }
}

/**
 * 构建单命令失败时的剪贴板内容
 * @param {string} command - 失败的命令
 * @param {string} stderr - 捕获的 stderr 内容
 * @param {number} exitCode - 进程退出码
 * @returns {string} 格式化后的剪贴板内容
 */
function buildSingleErrorClipboard(command: string, stderr: string, exitCode: number): string {
  if (stderr.trim()) {
    return MESSAGES.VALIDATE_CLIPBOARD_SINGLE_ERROR(command, stderr.trim());
  }
  return MESSAGES.COMMAND_EXEC_ERROR(command, exitCode);
}

/**
 * 执行单个命令（异步方式，捕获 stderr 并在失败时复制到剪贴板）
 * @param {string} command - 要执行的命令字符串
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function executeSingleCommand(command: string, mainWorktreePath: string): Promise<void> {
  printInfo(MESSAGES.VALIDATE_RUN_START(command));
  printSeparator();

  const result = await runCommandWithStderrCapture(command, { cwd: mainWorktreePath });

  printSeparator();

  if (result.error) {
    // 进程启动失败（如命令不存在）
    printError(MESSAGES.VALIDATE_RUN_ERROR(command, result.error));
    const clipboardContent = MESSAGES.VALIDATE_CLIPBOARD_SINGLE_ERROR(command, result.error);
    handleErrorClipboard(clipboardContent);
    return;
  }

  if (result.exitCode === 0) {
    printSuccess(MESSAGES.VALIDATE_RUN_SUCCESS(command));
  } else {
    printError(MESSAGES.VALIDATE_RUN_FAILED(command, result.exitCode));
    const clipboardContent = buildSingleErrorClipboard(command, result.stderr, result.exitCode);
    handleErrorClipboard(clipboardContent);
  }
}

/**
 * 汇总输出并行命令的执行结果，并将失败命令的错误信息复制到剪贴板
 * @param {ParallelCommandResultWithStderr[]} results - 各命令的执行结果数组
 */
function reportParallelResults(results: ParallelCommandResultWithStderr[]): void {
  printSeparator();

  const successCount = results.filter((r) => r.exitCode === 0 && !r.error).length;
  const failedCount = results.length - successCount;
  const errorClipboardParts: string[] = [];

  for (const result of results) {
    if (result.error) {
      printError(MESSAGES.VALIDATE_PARALLEL_CMD_ERROR(result.command, result.error));
      // 收集错误信息用于剪贴板
      errorClipboardParts.push(
        MESSAGES.VALIDATE_CLIPBOARD_PARALLEL_ERROR(result.command, result.error),
      );
    } else if (result.exitCode === 0) {
      printSuccess(MESSAGES.VALIDATE_PARALLEL_CMD_SUCCESS(result.command));
    } else {
      printError(MESSAGES.VALIDATE_PARALLEL_CMD_FAILED(result.command, result.exitCode));
      // 收集错误信息用于剪贴板
      const errorContent = result.stderr.trim()
        ? result.stderr.trim()
        : MESSAGES.EXIT_CODE_LABEL(result.exitCode);
      errorClipboardParts.push(
        MESSAGES.VALIDATE_CLIPBOARD_PARALLEL_ERROR(result.command, errorContent),
      );
    }
  }

  if (failedCount === 0) {
    printSuccess(MESSAGES.VALIDATE_PARALLEL_RUN_ALL_SUCCESS(results.length));
  } else {
    printError(MESSAGES.VALIDATE_PARALLEL_RUN_SUMMARY(successCount, failedCount));
    // 将所有失败命令的错误信息拼接后一次性复制到剪贴板
    const clipboardContent = errorClipboardParts.join(MESSAGES.VALIDATE_CLIPBOARD_SEPARATOR);
    handleErrorClipboard(clipboardContent);
  }
}

/**
 * 并行执行多个命令并汇总结果
 * @param {string[]} commands - 要并行执行的命令数组
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function executeParallelCommands(commands: string[], mainWorktreePath: string): Promise<void> {
  printInfo(MESSAGES.VALIDATE_PARALLEL_RUN_START(commands.length));

  for (let i = 0; i < commands.length; i++) {
    printInfo(MESSAGES.VALIDATE_PARALLEL_CMD_START(i + 1, commands.length, commands[i]));
  }

  printSeparator();

  const results = await runParallelCommandsWithStderrCapture(commands, { cwd: mainWorktreePath });

  reportParallelResults(results);
}

/**
 * 在主 worktree 中执行用户指定的命令
 * 根据命令字符串中的 & 分隔符决定是单命令执行还是并行执行
 * 命令执行失败不影响 validate 本身的结果，仅输出提示
 * @param {string} command - 要执行的命令字符串
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
export async function executeRunCommand(command: string, mainWorktreePath: string): Promise<void> {
  printInfo('');

  const commands = parseParallelCommands(command);

  if (commands.length <= 1) {
    // 单命令（包括含 && 的串行命令），走异步路径并捕获 stderr
    await executeSingleCommand(commands[0] || command, mainWorktreePath);
  } else {
    // 多命令，并行执行
    await executeParallelCommands(commands, mainWorktreePath);
  }
}
