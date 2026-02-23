import { describe, it, expect, vi } from 'vitest';

// mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { execSync, execFileSync, spawn } from 'node:child_process';
import { execCommand, execCommandWithInput, spawnProcess, killAllChildProcesses, parseParallelCommands } from '../../../src/utils/shell.js';

const mockedExecSync = vi.mocked(execSync);
const mockedExecFileSync = vi.mocked(execFileSync);
const mockedSpawn = vi.mocked(spawn);

describe('execCommand', () => {
  it('返回 trim 后的字符串', () => {
    mockedExecSync.mockReturnValue('  result  \n');
    expect(execCommand('git status')).toBe('result');
  });

  it('传递 cwd 选项', () => {
    mockedExecSync.mockReturnValue('ok');
    execCommand('git log', { cwd: '/some/path' });
    expect(mockedExecSync).toHaveBeenCalledWith('git log', expect.objectContaining({
      cwd: '/some/path',
    }));
  });

  it('命令失败时抛出异常', () => {
    mockedExecSync.mockImplementation(() => { throw new Error('command failed'); });
    expect(() => execCommand('invalid-cmd')).toThrow('command failed');
  });

  it('不传 cwd 时使用 undefined', () => {
    mockedExecSync.mockReturnValue('ok');
    execCommand('git status');
    expect(mockedExecSync).toHaveBeenCalledWith('git status', expect.objectContaining({
      cwd: undefined,
    }));
  });
});

describe('execCommandWithInput', () => {
  it('正确传递 input 和 args', () => {
    mockedExecFileSync.mockReturnValue('applied');
    const input = Buffer.from('patch content');
    execCommandWithInput('git', ['apply', '--cached'], { input, cwd: '/repo' });
    expect(mockedExecFileSync).toHaveBeenCalledWith('git', ['apply', '--cached'], expect.objectContaining({
      input,
      cwd: '/repo',
    }));
  });

  it('返回 trim 后的字符串', () => {
    mockedExecFileSync.mockReturnValue('  result  \n');
    const result = execCommandWithInput('git', ['apply'], { input: Buffer.from('data') });
    expect(result).toBe('result');
  });
});

describe('spawnProcess', () => {
  it('调用 spawn 并返回结果', () => {
    const fakeChild = { pid: 123 };
    mockedSpawn.mockReturnValue(fakeChild as any);
    const result = spawnProcess('claude', ['--help'], { cwd: '/repo' });
    expect(result).toBe(fakeChild);
    expect(mockedSpawn).toHaveBeenCalledWith('claude', ['--help'], expect.objectContaining({
      cwd: '/repo',
    }));
  });

  it('默认 stdio 为 pipe', () => {
    mockedSpawn.mockReturnValue({ pid: 1 } as any);
    spawnProcess('cmd', []);
    expect(mockedSpawn).toHaveBeenCalledWith('cmd', [], expect.objectContaining({
      stdio: ['pipe', 'pipe', 'pipe'],
    }));
  });
});

describe('killAllChildProcesses', () => {
  it('终止未 killed 的进程', () => {
    const child1 = { killed: false, kill: vi.fn() };
    const child2 = { killed: false, kill: vi.fn() };
    killAllChildProcesses([child1, child2] as any);
    expect(child1.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child2.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('跳过已 killed 的进程', () => {
    const child1 = { killed: true, kill: vi.fn() };
    const child2 = { killed: false, kill: vi.fn() };
    killAllChildProcesses([child1, child2] as any);
    expect(child1.kill).not.toHaveBeenCalled();
    expect(child2.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('空数组时不报错', () => {
    expect(() => killAllChildProcesses([])).not.toThrow();
  });
});

describe('parseParallelCommands', () => {
  it('单个命令返回包含该命令的数组', () => {
    expect(parseParallelCommands('pnpm test')).toEqual(['pnpm test']);
  });

  it('使用 & 分隔的多个命令被正确拆分', () => {
    expect(parseParallelCommands('pnpm test & pnpm build')).toEqual(['pnpm test', 'pnpm build']);
  });

  it('&& 不会被拆分，保持为单条命令', () => {
    expect(parseParallelCommands('pnpm lint && pnpm test')).toEqual(['pnpm lint && pnpm test']);
  });

  it('混合场景：&& 和 & 同时存在', () => {
    expect(parseParallelCommands('pnpm lint && pnpm test & pnpm build')).toEqual([
      'pnpm lint && pnpm test',
      'pnpm build',
    ]);
  });

  it('多个 & 分隔的命令', () => {
    expect(parseParallelCommands('cmd1 & cmd2 & cmd3')).toEqual(['cmd1', 'cmd2', 'cmd3']);
  });

  it('空字符串返回空数组', () => {
    expect(parseParallelCommands('')).toEqual([]);
  });

  it('去除命令首尾空白', () => {
    expect(parseParallelCommands('  pnpm test  &  pnpm build  ')).toEqual(['pnpm test', 'pnpm build']);
  });

  it('多个 && 不拆分', () => {
    expect(parseParallelCommands('cmd1 && cmd2 && cmd3')).toEqual(['cmd1 && cmd2 && cmd3']);
  });

  it('尾部 & 后无内容时过滤空字符串', () => {
    expect(parseParallelCommands('pnpm test & ')).toEqual(['pnpm test']);
  });
});
