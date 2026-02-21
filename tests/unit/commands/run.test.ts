import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { EventEmitter, Readable } from 'node:stream';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/errors/index.js', () => ({
  ClawtError: class ClawtError extends Error {
    exitCode: number;
    constructor(message: string, exitCode = 1) {
      super(message);
      this.exitCode = exitCode;
    }
  },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    BRANCH_EXISTS_USE_RESUME: (name: string) => `分支 ${name} 已存在，请使用 resume 恢复`,
    WORKTREE_CREATED: (count: number) => `✓ 已创建 ${count} 个 worktree`,
    INTERRUPTED: '已中断',
    INTERRUPT_AUTO_CLEANED: (count: number) => `已清理 ${count} 个 worktree`,
    INTERRUPT_CONFIRM_CLEANUP: '是否清理已创建的 worktree？',
    INTERRUPT_CLEANED: (count: number) => `已清理 ${count} 个 worktree`,
    INTERRUPT_KEPT: '已保留 worktree',
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  validateClaudeCodeInstalled: vi.fn(),
  createWorktrees: vi.fn(),
  sanitizeBranchName: vi.fn(),
  checkBranchExists: vi.fn(),
  spawnProcess: vi.fn(),
  killAllChildProcesses: vi.fn(),
  cleanupWorktrees: vi.fn(),
  getConfigValue: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printInfo: vi.fn(),
  printSeparator: vi.fn(),
  printDoubleSeparator: vi.fn(),
  confirmAction: vi.fn(),
  launchInteractiveClaude: vi.fn(),
}));

import { registerRunCommand } from '../../../src/commands/run.js';
import {
  createWorktrees,
  sanitizeBranchName,
  checkBranchExists,
  spawnProcess,
  printSuccess,
  launchInteractiveClaude,
} from '../../../src/utils/index.js';

const mockedCreateWorktrees = vi.mocked(createWorktrees);
const mockedSanitizeBranchName = vi.mocked(sanitizeBranchName);
const mockedCheckBranchExists = vi.mocked(checkBranchExists);
const mockedSpawnProcess = vi.mocked(spawnProcess);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedLaunchInteractiveClaude = vi.mocked(launchInteractiveClaude);

/**
 * 创建模拟子进程
 * @param {string} stdout - 子进程标准输出内容
 * @param {number} exitCode - 退出码
 * @returns {object} 模拟的子进程对象
 */
function createMockChildProcess(stdout: string, exitCode: number) {
  const child = new EventEmitter() as any;
  const stdoutStream = new Readable({ read() {} });
  const stderrStream = new Readable({ read() {} });
  child.stdout = stdoutStream;
  child.stderr = stderrStream;
  child.pid = 12345;

  // 延迟触发 close 事件
  setTimeout(() => {
    stdoutStream.push(stdout);
    stdoutStream.push(null);
    stderrStream.push(null);
    child.emit('close', exitCode);
  }, 10);

  return child;
}

beforeEach(() => {
  mockedCreateWorktrees.mockReset();
  mockedSanitizeBranchName.mockReset();
  mockedCheckBranchExists.mockReset();
  mockedSpawnProcess.mockReset();
  mockedPrintSuccess.mockReset();
  mockedLaunchInteractiveClaude.mockReset();
});

describe('registerRunCommand', () => {
  it('注册 run 命令', () => {
    const program = new Command();
    registerRunCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'run');
    expect(cmd).toBeDefined();
  });
});

describe('handleRun', () => {
  it('未传 --tasks 时创建单个 worktree 并打开交互式界面', async () => {
    mockedSanitizeBranchName.mockReturnValue('feature');
    mockedCheckBranchExists.mockReturnValue(false);
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedCreateWorktrees.mockReturnValue([worktree]);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feature'], { from: 'user' });

    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feature', 1);
    expect(mockedLaunchInteractiveClaude).toHaveBeenCalledWith(worktree);
  });

  it('分支已存在时提示使用 resume', async () => {
    mockedSanitizeBranchName.mockReturnValue('feature');
    mockedCheckBranchExists.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);

    await expect(
      program.parseAsync(['run', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('传 --tasks 时创建对应数量 worktree 并并行执行', async () => {
    const worktrees = [
      { path: '/path/feat-1', branch: 'feat-1' },
      { path: '/path/feat-2', branch: 'feat-2' },
    ];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', 'task2'], { from: 'user' });

    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feat', 2);
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(2);
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('任务执行失败时在通知中报告', async () => {
    const worktrees = [{ path: '/path/feat-1', branch: 'feat-1' }];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: true,
      duration_ms: 1000,
      total_cost_usd: 0.01,
    });
    mockedSpawnProcess.mockReturnValueOnce(createMockChildProcess(jsonOutput, 1));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'fail-task'], { from: 'user' });

    // 应输出汇总（含失败信息）
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(1);
  });

  it('子进程发生错误时返回失败结果', async () => {
    const worktrees = [{ path: '/path/feat-1', branch: 'feat-1' }];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    // 创建会触发 error 事件的子进程
    const child = new EventEmitter() as any;
    child.stdout = new Readable({ read() {} });
    child.stderr = new Readable({ read() {} });
    child.pid = 12345;
    setTimeout(() => {
      child.emit('error', new Error('spawn error'));
    }, 10);
    mockedSpawnProcess.mockReturnValueOnce(child);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1'], { from: 'user' });

    expect(mockedSpawnProcess).toHaveBeenCalledTimes(1);
  });
});
