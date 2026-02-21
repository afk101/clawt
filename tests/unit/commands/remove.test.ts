import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

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
    NO_WORKTREES: '(无 worktree)',
    WORKTREE_NOT_FOUND: (name: string) => `worktree ${name} 不存在`,
    WORKTREE_REMOVED: (path: string) => `✓ 已移除 worktree: ${path}`,
    REMOVE_PARTIAL_FAILURE: (failures: Array<{ path: string; error: string }>) => `${failures.length} 个移除失败`,
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  getProjectName: vi.fn(),
  getProjectWorktreeDir: vi.fn(),
  getProjectWorktrees: vi.fn(),
  removeWorktreeByPath: vi.fn(),
  deleteBranch: vi.fn(),
  getConfigValue: vi.fn(),
  gitWorktreePrune: vi.fn(),
  removeEmptyDir: vi.fn(),
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  confirmAction: vi.fn(),
  removeSnapshot: vi.fn(),
  removeProjectSnapshots: vi.fn(),
}));

import { registerRemoveCommand } from '../../../src/commands/remove.js';
import {
  validateMainWorktree,
  getProjectName,
  getProjectWorktrees,
  removeWorktreeByPath,
  deleteBranch,
  getConfigValue,
  confirmAction,
  removeSnapshot,
  removeProjectSnapshots,
  printSuccess,
  printError,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedRemoveWorktreeByPath = vi.mocked(removeWorktreeByPath);
const mockedDeleteBranch = vi.mocked(deleteBranch);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedConfirmAction = vi.mocked(confirmAction);
const mockedRemoveSnapshot = vi.mocked(removeSnapshot);
const mockedRemoveProjectSnapshots = vi.mocked(removeProjectSnapshots);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintError = vi.mocked(printError);

beforeEach(() => {
  vi.mocked(validateMainWorktree).mockReset();
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetProjectWorktrees.mockReset();
  mockedRemoveWorktreeByPath.mockReset();
  mockedDeleteBranch.mockReset();
  mockedGetConfigValue.mockReset();
  mockedConfirmAction.mockReset();
  mockedRemoveSnapshot.mockReset();
  mockedRemoveProjectSnapshots.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintError.mockReset();
});

describe('registerRemoveCommand', () => {
  it('注册 remove 命令', () => {
    const program = new Command();
    registerRemoveCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'remove');
    expect(cmd).toBeDefined();
  });
});

describe('handleRemove', () => {
  it('--all 移除所有 worktree（autoDeleteBranch=true）', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove', '--all'], { from: 'user' });

    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(2);
    expect(mockedDeleteBranch).toHaveBeenCalledTimes(2);
    expect(mockedRemoveProjectSnapshots).toHaveBeenCalledWith('test-project');
  });

  it('-b 指定分支名精确移除', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
      { path: '/path/other', branch: 'other' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove', '-b', 'feature'], { from: 'user' });

    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(1);
    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledWith('/path/feature');
  });

  it('-b 匹配分支前缀（feature 匹配 feature-1、feature-2）', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
      { path: '/path/other', branch: 'other' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove', '-b', 'feature'], { from: 'user' });

    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(2);
  });

  it('autoDeleteBranch=false 时询问用户是否删除分支', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetConfigValue.mockReturnValue(false);
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove', '-b', 'feature'], { from: 'user' });

    expect(mockedConfirmAction).toHaveBeenCalled();
    // 用户拒绝删除分支
    expect(mockedDeleteBranch).not.toHaveBeenCalled();
  });

  it('未指定 --all 或 -b 时抛出错误', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('-b 指定不存在的分支时抛出错误', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/other', branch: 'other' },
    ]);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove', '-b', 'nonexistent'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('移除过程中部分失败时汇报并抛出错误', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);
    // 第一个成功，第二个失败
    mockedRemoveWorktreeByPath
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => { throw new Error('remove failed'); });

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove', '--all'], { from: 'user' }),
    ).rejects.toThrow();

    expect(mockedPrintError).toHaveBeenCalled();
  });
});
