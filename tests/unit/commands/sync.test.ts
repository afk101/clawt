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

vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...actual,
    MESSAGES: {
      SYNC_NO_WORKTREES: '没有可用的 worktree',
      SYNC_SELECT_BRANCH: '选择要同步的分支',
      SYNC_MULTIPLE_MATCHES: (keyword: string) => `找到多个匹配 "${keyword}" 的分支`,
      SYNC_NO_MATCH: (keyword: string, branches: string[]) => `未找到匹配 "${keyword}" 的分支`,
      SYNC_AUTO_COMMITTED: (branch: string) => `已自动保存 ${branch} 的未提交变更`,
      SYNC_MERGING: (branch: string, mainBranch: string) => `正在将 ${mainBranch} 合并到 ${branch}...`,
      SYNC_CONFLICT: (path: string) => `合并冲突，请手动解决: ${path}`,
      SYNC_SUCCESS: (branch: string, mainBranch: string) => `✓ 已将 ${mainBranch} 同步到 ${branch}`,
      SYNC_VALIDATE_BRANCH_REBUILT: (validateBranch: string) => `验证分支 ${validateBranch} 已重建`,
    },
    AUTO_SAVE_COMMIT_MESSAGE_PREFIX: 'clawt: auto-save before merging',
  };
});

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  getGitTopLevel: vi.fn(),
  getProjectWorktrees: vi.fn(),
  isWorkingDirClean: vi.fn(),
  gitAddAll: vi.fn(),
  gitCommit: vi.fn(),
  gitMerge: vi.fn(),
  hasMergeConflict: vi.fn(),
  getCurrentBranch: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  printWarning: vi.fn(),
  resolveTargetWorktree: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  getMainWorkBranch: vi.fn().mockReturnValue('main'),
  rebuildValidateBranch: vi.fn(),
  getValidateBranchName: vi.fn((name: string) => `clawt-validate-${name}`),
  guardMainWorkBranch: vi.fn().mockResolvedValue(undefined),
  guardMainWorkBranchExists: vi.fn(),
  buildAutoSaveCommitMessage: (mainBranch: string, branch: string) =>
    `clawt: auto-save before merging ${mainBranch} into ${branch}`,
}));

import { registerSyncCommand } from '../../../src/commands/sync.js';
import {
  getGitTopLevel,
  getProjectWorktrees,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  getCurrentBranch,
  printSuccess,
  printWarning,
  resolveTargetWorktree,
} from '../../../src/utils/index.js';

const mockedGetGitTopLevel = vi.mocked(getGitTopLevel);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGitAddAll = vi.mocked(gitAddAll);
const mockedGitCommit = vi.mocked(gitCommit);
const mockedGitMerge = vi.mocked(gitMerge);
const mockedHasMergeConflict = vi.mocked(hasMergeConflict);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintWarning = vi.mocked(printWarning);
const mockedResolveTargetWorktree = vi.mocked(resolveTargetWorktree);

beforeEach(() => {
  mockedGetGitTopLevel.mockReturnValue('/repo');
  mockedGetCurrentBranch.mockReturnValue('main');
  mockedGetProjectWorktrees.mockReset();
  mockedIsWorkingDirClean.mockReset();
  mockedGitAddAll.mockReset();
  mockedGitCommit.mockReset();
  mockedGitMerge.mockReset();
  mockedHasMergeConflict.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintWarning.mockReset();
  mockedResolveTargetWorktree.mockReset();
});

describe('registerSyncCommand', () => {
  it('注册 sync 命令', () => {
    const program = new Command();
    registerSyncCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'sync');
    expect(cmd).toBeDefined();
  });
});

describe('handleSync', () => {
  it('目标 worktree 干净时直接合并', async () => {
    const worktree = { path: '/path/feature', branch: 'feature', baseBranch: null };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktree.mockResolvedValue(worktree);
    mockedIsWorkingDirClean.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerSyncCommand(program);
    await program.parseAsync(['sync', '-b', 'feature'], { from: 'user' });

    expect(mockedGitAddAll).not.toHaveBeenCalled();
    expect(mockedGitMerge).toHaveBeenCalledWith('main', '/path/feature');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('目标 worktree 有未提交变更时自动保存后合并', async () => {
    const worktree = { path: '/path/feature', branch: 'feature', baseBranch: null };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktree.mockResolvedValue(worktree);
    mockedIsWorkingDirClean.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerSyncCommand(program);
    await program.parseAsync(['sync', '-b', 'feature'], { from: 'user' });

    expect(mockedGitAddAll).toHaveBeenCalledWith('/path/feature');
    expect(mockedGitCommit).toHaveBeenCalledWith(
      'clawt: auto-save before merging main into feature',
      '/path/feature',
    );
    expect(mockedGitMerge).toHaveBeenCalled();
  });

  it('合并冲突时输出警告并返回', async () => {
    const worktree = { path: '/path/feature', branch: 'feature', baseBranch: null };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktree.mockResolvedValue(worktree);
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedGitMerge.mockImplementation(() => { throw new Error('conflict'); });
    mockedHasMergeConflict.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerSyncCommand(program);
    await program.parseAsync(['sync', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedPrintSuccess).not.toHaveBeenCalled();
  });

  it('合并失败（非冲突错误）时向上抛出', async () => {
    const worktree = { path: '/path/feature', branch: 'feature', baseBranch: null };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktree.mockResolvedValue(worktree);
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedGitMerge.mockImplementation(() => { throw new Error('other error'); });
    mockedHasMergeConflict.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerSyncCommand(program);

    await expect(
      program.parseAsync(['sync', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });
});
