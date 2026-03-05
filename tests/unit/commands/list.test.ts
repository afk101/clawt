import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    NO_WORKTREES: '(无 worktree)',
    WORKTREE_STATUS_UNAVAILABLE: '(状态不可用)',
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  getProjectName: vi.fn(),
  getProjectWorktrees: vi.fn(),
  getWorktreeStatus: vi.fn(),
  formatWorktreeStatus: vi.fn(),
  isWorktreeIdle: vi.fn(),
  printInfo: vi.fn(),
}));

import { registerListCommand } from '../../../src/commands/list.js';
import { runPreChecks, getProjectName, getProjectWorktrees, getWorktreeStatus, printInfo } from '../../../src/utils/index.js';

const mockedRunPreChecks = vi.mocked(runPreChecks);
const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedGetWorktreeStatus = vi.mocked(getWorktreeStatus);
const mockedPrintInfo = vi.mocked(printInfo);

beforeEach(() => {
  mockedRunPreChecks.mockReset();
  mockedGetProjectName.mockReset();
  mockedGetProjectWorktrees.mockReset();
  mockedGetWorktreeStatus.mockReset();
  mockedPrintInfo.mockReset();
});

describe('registerListCommand', () => {
  it('注册 list 命令', () => {
    const program = new Command();
    registerListCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'list');
    expect(cmd).toBeDefined();
  });
});

describe('handleList', () => {
  it('无 worktree 时文本输出', () => {
    mockedGetProjectName.mockReturnValue('test-project');
    mockedGetProjectWorktrees.mockReturnValue([]);

    const program = new Command();
    program.exitOverride();
    registerListCommand(program);
    program.parse(['list'], { from: 'user' });

    expect(mockedRunPreChecks).toHaveBeenCalled();
    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('有 worktree 时文本输出', () => {
    mockedGetProjectName.mockReturnValue('test-project');
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetWorktreeStatus.mockReturnValue({
      commitCount: 3, insertions: 10, deletions: 5, hasDirtyFiles: false,
    });

    const program = new Command();
    program.exitOverride();
    registerListCommand(program);
    program.parse(['list'], { from: 'user' });

    expect(mockedGetWorktreeStatus).toHaveBeenCalled();
  });

  it('--json 输出 JSON 格式', () => {
    mockedGetProjectName.mockReturnValue('test-project');
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerListCommand(program);
    program.parse(['list', '--json'], { from: 'user' });

    // 应通过 console.log 输出 JSON
    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.project).toBe('test-project');
    expect(parsed.total).toBe(1);
  });

  it('worktree 状态不可用时显示提示', () => {
    mockedGetProjectName.mockReturnValue('test-project');
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetWorktreeStatus.mockReturnValue(null);

    const program = new Command();
    program.exitOverride();
    registerListCommand(program);
    program.parse(['list'], { from: 'user' });

    expect(mockedGetWorktreeStatus).toHaveBeenCalled();
  });
});
