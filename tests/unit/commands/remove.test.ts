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
    WORKTREE_REMOVED: (path: string) => `✓ 已移除 worktree: ${path}`,
    REMOVE_PARTIAL_FAILURE: (failures: Array<{ path: string; error: string }>) => `${failures.length} 个移除失败`,
    REMOVE_NO_WORKTREES: '当前项目没有可用的 worktree，无需移除',
    REMOVE_SELECT_BRANCH: '请选择要移除的分支（空格选择，回车确认）',
    REMOVE_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支`,
    REMOVE_NO_MATCH: (name: string, branches: string[]) => `未找到与 "${name}" 匹配的分支，可用：${branches.join(', ')}`,
    REMOVE_BRANCHES_KEPT: '已保留本地分支，可稍后使用 git branch -D <分支名> 手动删除',
    REMOVE_BRANCH_IS_CURRENT: (branch: string) =>
      `无法移除：分支 ${branch} 是主 worktree 当前所在分支，请先切换到其他分支后再移除`,
    REMOVE_VALIDATE_BRANCH_IS_CURRENT: (branch: string, validateBranch: string) =>
      `无法移除：分支 ${branch} 的验证分支 ${validateBranch} 是主 worktree 当前所在分支，请先切换到其他分支后再移除`,
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
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
  printHint: vi.fn(),
  confirmAction: vi.fn(),
  removeSnapshot: vi.fn(),
  removeProjectSnapshots: vi.fn(),
  resolveTargetWorktrees: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  getValidateBranchName: vi.fn((name: string) => `clawt-validate-${name}`),
  deleteValidateBranch: vi.fn(),
  getCurrentBranch: vi.fn(),
  guardMainWorkBranch: vi.fn().mockResolvedValue(undefined),
  guardMainWorkBranchExists: vi.fn(),
  isNonInteractive: vi.fn().mockReturnValue(false),
}));

import { registerRemoveCommand } from '../../../src/commands/remove.js';
import {
  runPreChecks,
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
  printHint,
  resolveTargetWorktrees,
  getCurrentBranch,
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
const mockedPrintHint = vi.mocked(printHint);
const mockedResolveTargetWorktrees = vi.mocked(resolveTargetWorktrees);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);

beforeEach(() => {
  vi.mocked(runPreChecks).mockReset();
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
  mockedPrintHint.mockReset();
  mockedResolveTargetWorktrees.mockReset();
  mockedGetCurrentBranch.mockReset();
  mockedGetCurrentBranch.mockReturnValue('main');
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

  it('-b 精确匹配时通过 resolveTargetWorktrees 解析并移除', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
      { path: '/path/other', branch: 'other' },
    ]);
    mockedResolveTargetWorktrees.mockResolvedValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove', '-b', 'feature'], { from: 'user' });

    expect(mockedResolveTargetWorktrees).toHaveBeenCalled();
    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(1);
    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledWith('/path/feature');
  });

  it('-b 模糊匹配多个时通过 resolveTargetWorktrees 解析并批量移除', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
      { path: '/path/other', branch: 'other' },
    ]);
    // 模拟用户多选了两个
    mockedResolveTargetWorktrees.mockResolvedValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove', '-b', 'feature'], { from: 'user' });

    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(2);
  });

  it('未指定 --all 或 -b 时通过 resolveTargetWorktrees 展示多选列表', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
    ]);
    mockedResolveTargetWorktrees.mockResolvedValue([
      { path: '/path/feature-1', branch: 'feature-1' },
    ]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);
    await program.parseAsync(['remove'], { from: 'user' });

    // 未传 branch 参数，resolveTargetWorktrees 的第三个参数应为 undefined
    expect(mockedResolveTargetWorktrees).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      undefined,
    );
    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(1);
  });

  it('autoDeleteBranch=false 时询问用户是否删除分支', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedResolveTargetWorktrees.mockResolvedValue([
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
    // 应提示用户分支已保留
    expect(mockedPrintHint).toHaveBeenCalledWith('已保留本地分支，可稍后使用 git branch -D <分支名> 手动删除');
  });

  it('-b 指定不存在的分支时 resolveTargetWorktrees 抛出错误', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/other', branch: 'other' },
    ]);
    mockedResolveTargetWorktrees.mockRejectedValue(new Error('未找到与 "nonexistent" 匹配的分支'));

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
