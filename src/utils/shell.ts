import { execSync, execFileSync, spawn, type ChildProcess, type StdioOptions } from 'node:child_process';
import { logger } from '../logger/index.js';

/**
 * 同步执行 shell 命令并返回 stdout
 * @param {string} command - 要执行的命令
 * @param {object} options - 可选配置
 * @param {string} options.cwd - 工作目录
 * @returns {string} 命令的标准输出（已 trim）
 * @throws {Error} 命令执行失败时抛出
 */
export function execCommand(command: string, options?: { cwd?: string }): string {
  logger.debug(`执行命令: ${command}${options?.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  const result = execSync(command, {
    cwd: options?.cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.trim();
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
 * @throws {Error} 命令执行失败时抛出
 */
export function execCommandWithInput(command: string, args: string[], options: { input: Buffer; cwd?: string }): string {
  logger.debug(`执行命令(stdin): ${command} ${args.join(' ')}${options.cwd ? ` (cwd: ${options.cwd})` : ''}`);
  const result = execFileSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.trim();
}
