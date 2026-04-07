import { execSync, execFileSync, spawn, spawnSync, type ChildProcess, type SpawnSyncReturns, type StdioOptions } from 'node:child_process';
import { logger } from '../logger/index.js';
import { EXEC_MAX_BUFFER } from '../constants/git.js';
import { CLAUDE_CODE_ENTRYPOINT_VALUE } from '../constants/index.js';
import { throwIfGitIndexLockError } from './git-lock.js';

/**
 * 获取移除了 CLAUDECODE 嵌套会话标记的环境变量副本，并注入 CLAUDE_CODE_ENTRYPOINT 标识
 * 仅用于 claude -p 等非交互式子进程：
 * - 移除 CLAUDECODE：避免被 Claude Code 误判为嵌套会话而拒绝启动
 * - 注入 CLAUDE_CODE_ENTRYPOINT="cli"：使 claude -p 会话支持 --continue 恢复
 * 不适用于交互式启动 Claude Code（如 clawt resume），交互式场景应保留原始环境变量
 * @returns {NodeJS.ProcessEnv} 移除 CLAUDECODE 并注入 CLAUDE_CODE_ENTRYPOINT 后的环境变量
 */
export function getEnvWithoutNestedSessionFlag(): NodeJS.ProcessEnv {
  const { CLAUDECODE: _, ...env } = process.env;
  return { ...env, CLAUDE_CODE_ENTRYPOINT: CLAUDE_CODE_ENTRYPOINT_VALUE };
}

/** 并行命令执行的单个结果 */
export interface ParallelCommandResult {
  /** 执行的命令字符串 */
  command: string;
  /** 进程退出码 */
  exitCode: number;
  /** 进程启动失败时的错误信息 */
  error?: string;
}

/** 带 stderr 捕获的命令执行结果 */
export interface CommandResultWithStderr {
  /** 进程退出码 */
  exitCode: number;
  /** 进程启动失败时的错误信息 */
  error?: string;
  /** 捕获的 stderr 输出内容 */
  stderr: string;
}

/** 带 stderr 捕获的并行命令执行结果 */
export interface ParallelCommandResultWithStderr extends ParallelCommandResult {
  /** 捕获的 stderr 输出内容 */
  stderr: string;
}

/**
 * 同步执行 shell 命令并返回 stdout
 * @param {string} command - 要执行的命令
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {string} 命令的标准输出（已 trim）
 * @throws {ClawtError} 检测到 index.lock 错误时抛出中文友好提示
 * @throws {Error} 其他命令执行失败时抛出
 */
export function execCommand(command: string, options?: { cwd?: string }): string {
  logger.debug(`执行命令: ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  try {
    const result = execSync(command, {
      cwd: options?.cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: EXEC_MAX_BUFFER,
    });
    return result.trim();
  } catch (error) {
    throwIfGitIndexLockError(error, options?.cwd);
    throw error;
  }
}

/**
 * 以子进程方式异步执行命令
 * @param {string} command - 要执行的命令
 * @param {string[]} args - 命令参数
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @param {StdioOptions} options.stdio - stdio 配置，默认 ['pipe', 'pipe', 'pipe']
 * @returns {ChildProcess} 子进程实例
 */
export function spawnProcess(
  command: string,
  args: string[],
  options?: { cwd?: string; stdio?: StdioOptions },
): ChildProcess {
  logger.debug(`启动子进程: ${command} ${args.join(' ')}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  return spawn(command, args, {
    cwd: options?.cwd,
    stdio: options?.stdio ?? ['pipe', 'pipe', 'pipe'],
    env: getEnvWithoutNestedSessionFlag(),
  });
}

/**
 * 终止所有正在运行的子进程
 * @param {ChildProcess[]} children - 子进程列表
 */
export function killAllChildProcesses(children: ChildProcess[]): void {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

/**
 * 同步执行命令，通过 stdin 传入数据
 * @param {string} command - 要执行的命令
 * @param {string[]} args - 命令参数
 * @param {object} options - 配置
 * @param {Buffer} options.input - 通过 stdin 传入的数据（Buffer 格式，保留二进制完整性）
 * @param {string} [options.cwd] - 工作目录
 * @returns {string} 命令的标准输出（已 trim）
 * @throws {ClawtError} 检测到 index.lock 错误时抛出中文友好提示
 * @throws {Error} 其他命令执行失败时抛出
 */
export function execCommandWithInput(command: string, args: string[], options: { input: Buffer; cwd?: string }): string {
  logger.debug(`执行命令(stdin): ${command} ${args.join(' ')}${options.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  try {
    const result = execFileSync(command, args, {
      cwd: options.cwd,
      input: options.input,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: EXEC_MAX_BUFFER,
    });
    return result.trim();
  } catch (error) {
    throwIfGitIndexLockError(error, options.cwd);
    throw error;
  }
}

/**
 * 同步执行命令，继承父进程的 stdio（实时输出到终端）
 * 使用 shell 模式以支持管道、重定向等 shell 语法
 * @param {string} command - 要执行的命令字符串
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {SpawnSyncReturns<Buffer>} spawnSync 的返回结果
 */
export function runCommandInherited(
  command: string,
  options?: { cwd?: string },
): SpawnSyncReturns<Buffer> {
  logger.debug(`执行命令(inherit): ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  return spawnSync(command, {
    cwd: options?.cwd,
    stdio: 'inherit',
    shell: true,
  });
}

/**
 * 解析命令字符串中的并行分隔符 `&`，将其拆分为多个独立命令
 * `&&` 不会被拆分（属于 shell 的串行逻辑与操作符）
 * @param {string} commandString - 命令字符串
 * @returns {string[]} 拆分后的命令数组
 */
export function parseParallelCommands(commandString: string): string[] {
  // 将 && 临时替换为占位符，避免被 & 分割逻辑误拆
  const placeholder = '\x00AND\x00';
  const escaped = commandString.replace(/&&/g, placeholder);

  // 按单个 & 分割
  const parts = escaped.split('&');

  // 还原占位符为 &&，并去除首尾空白
  return parts
    .map((part) => part.replace(new RegExp(placeholder, 'g'), '&&').trim())
    .filter((part) => part.length > 0);
}

/**
 * 并行执行多个命令，等待全部完成后返回结果
 * 每个命令通过 spawn 以 shell 模式启动，stdio 继承父进程（实时输出到终端）
 * @param {string[]} commands - 要并行执行的命令数组
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {Promise<ParallelCommandResult[]>} 各命令的执行结果
 */
export function runParallelCommands(
  commands: string[],
  options?: { cwd?: string },
): Promise<ParallelCommandResult[]> {
  const promises = commands.map((command) => {
    return new Promise<ParallelCommandResult>((resolve) => {
      logger.debug(`并行启动命令: ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);

      const child = spawn(command, {
        cwd: options?.cwd,
        stdio: 'inherit',
        shell: true,
      });

      child.on('error', (err) => {
        resolve({ command, exitCode: 1, error: err.message });
      });

      child.on('close', (code) => {
        resolve({ command, exitCode: code ?? 1 });
      });
    });
  });

  return Promise.all(promises);
}

/**
 * 以 shell 模式启动子进程，捕获 stderr 同时实时回显到终端
 * stdout 直接继承父进程（实时输出），stderr 通过 pipe 捕获并同步回显
 * @param {string} command - 要执行的命令字符串
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {Promise<{ exitCode: number, error?: string, stderr: string }>} 退出码、错误信息和 stderr 内容
 */
function spawnWithStderrCapture(
  command: string,
  options?: { cwd?: string },
): Promise<{ exitCode: number; error?: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: options?.cwd,
      stdio: ['inherit', 'inherit', 'pipe'],
      shell: true,
    });

    const stderrChunks: Buffer[] = [];

    child.stderr?.on('data', (chunk: Buffer) => {
      // 实时回显到终端
      process.stderr.write(chunk);
      // 累积到 buffer
      stderrChunks.push(chunk);
    });

    child.on('error', (err) => {
      resolve({
        exitCode: 1,
        error: err.message,
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      });
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      });
    });
  });
}

/**
 * 异步执行命令，捕获 stderr 同时实时回显到终端
 * @param {string} command - 要执行的命令字符串
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {Promise<CommandResultWithStderr>} 包含退出码和 stderr 内容的结果
 */
export function runCommandWithStderrCapture(
  command: string,
  options?: { cwd?: string },
): Promise<CommandResultWithStderr> {
  logger.debug(`执行命令(stderr捕获): ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  return spawnWithStderrCapture(command, options);
}

/**
 * 并行执行多个命令，捕获每个命令的 stderr 同时实时回显到终端
 * @param {string[]} commands - 要并行执行的命令数组
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {Promise<ParallelCommandResultWithStderr[]>} 各命令的执行结果（含 stderr）
 */
export function runParallelCommandsWithStderrCapture(
  commands: string[],
  options?: { cwd?: string },
): Promise<ParallelCommandResultWithStderr[]> {
  const promises = commands.map(async (command): Promise<ParallelCommandResultWithStderr> => {
    logger.debug(`并行启动命令(stderr捕获): ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);
    const result = await spawnWithStderrCapture(command, options);
    return { command, ...result };
  });

  return Promise.all(promises);
}
