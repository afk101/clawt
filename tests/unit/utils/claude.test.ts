import { describe, it, expect, vi } from 'vitest';

// mock logger（避免测试时写日志文件）
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock node:child_process
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

// mock config
vi.mock('../../../src/utils/config.js', () => ({
  getConfigValue: vi.fn(),
}));

// mock formatter
vi.mock('../../../src/utils/formatter.js', () => ({
  printInfo: vi.fn(),
  printWarning: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { launchInteractiveClaude } from '../../../src/utils/claude.js';
import { getConfigValue } from '../../../src/utils/config.js';
import { printInfo, printWarning } from '../../../src/utils/formatter.js';
import { ClawtError } from '../../../src/errors/index.js';
import { createWorktreeInfo } from '../../helpers/fixtures.js';

const mockedSpawnSync = vi.mocked(spawnSync);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintWarning = vi.mocked(printWarning);

describe('launchInteractiveClaude', () => {
  const worktree = createWorktreeInfo({
    path: '/tmp/test-worktree',
    branch: 'feature-test',
  });

  it('正常启动 Claude Code（退出码为 0）', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedGetConfigValue).toHaveBeenCalledWith('claudeCodeCommand');
    expect(mockedSpawnSync).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--append-system-prompt']),
      expect.objectContaining({
        cwd: '/tmp/test-worktree',
        stdio: 'inherit',
      }),
    );
  });

  it('输出分支和路径信息', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('feature-test'));
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('/tmp/test-worktree'));
  });

  it('支持带参数的命令（如 npx claude）', () => {
    mockedGetConfigValue.mockReturnValue('npx claude');
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedSpawnSync).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['claude', '--append-system-prompt']),
      expect.any(Object),
    );
  });

  it('spawnSync 返回 error 时抛出 ClawtError', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedSpawnSync.mockReturnValue({
      status: null,
      error: new Error('命令未找到'),
      stdout: '',
      stderr: '',
      pid: 0,
      output: [],
      signal: null,
    });

    expect(() => launchInteractiveClaude(worktree)).toThrow(ClawtError);
    expect(() => launchInteractiveClaude(worktree)).toThrow('启动 Claude Code 失败');
  });

  it('非零退出码时调用 printWarning', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedSpawnSync.mockReturnValue({
      status: 1,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintWarning).toHaveBeenCalledWith(expect.stringContaining('退出码: 1'));
  });

  it('退出码为 null 时不调用 printWarning', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedSpawnSync.mockReturnValue({
      status: null,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintWarning).not.toHaveBeenCalled();
  });

  it('退出码为 0 时不调用 printWarning', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintWarning).not.toHaveBeenCalled();
  });
});
