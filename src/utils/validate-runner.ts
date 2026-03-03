import { MESSAGES } from '../constants/index.js';
import {
  printInfo,
  printSuccess,
  printError,
  printSeparator,
  runCommandInherited,
  parseParallelCommands,
  runParallelCommands,
} from './index.js';
import type { ParallelCommandResult } from './index.js';

/**
 * 执行单个命令（同步方式，保持原有行为不变）
 * @param {string} command - 要执行的命令字符串
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
function executeSingleCommand(command: string, mainWorktreePath: string): void {
  printInfo(MESSAGES.VALIDATE_RUN_START(command));
  printSeparator();

  const result = runCommandInherited(command, { cwd: mainWorktreePath });

  printSeparator();

  if (result.error) {
    // 进程启动失败（如命令不存在）
    printError(MESSAGES.VALIDATE_RUN_ERROR(command, result.error.message));
    return;
  }

  const exitCode = result.status ?? 1;
  if (exitCode === 0) {
    printSuccess(MESSAGES.VALIDATE_RUN_SUCCESS(command));
  } else {
    printError(MESSAGES.VALIDATE_RUN_FAILED(command, exitCode));
  }
}

/**
 * 汇总输出并行命令的执行结果
 * @param {ParallelCommandResult[]} results - 各命令的执行结果数组
 */
function reportParallelResults(results: ParallelCommandResult[]): void {
  printSeparator();

  const successCount = results.filter((r) => r.exitCode === 0 && !r.error).length;
  const failedCount = results.length - successCount;

  for (const result of results) {
    if (result.error) {
      printError(MESSAGES.VALIDATE_PARALLEL_CMD_ERROR(result.command, result.error));
    } else if (result.exitCode === 0) {
      printSuccess(MESSAGES.VALIDATE_PARALLEL_CMD_SUCCESS(result.command));
    } else {
      printError(MESSAGES.VALIDATE_PARALLEL_CMD_FAILED(result.command, result.exitCode));
    }
  }

  if (failedCount === 0) {
    printSuccess(MESSAGES.VALIDATE_PARALLEL_RUN_ALL_SUCCESS(results.length));
  } else {
    printError(MESSAGES.VALIDATE_PARALLEL_RUN_SUMMARY(successCount, failedCount));
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

  const results = await runParallelCommands(commands, { cwd: mainWorktreePath });

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
    // 单命令（包括含 && 的串行命令），走原有同步路径
    executeSingleCommand(commands[0] || command, mainWorktreePath);
  } else {
    // 多命令，并行执行
    await executeParallelCommands(commands, mainWorktreePath);
  }
}
