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
      MERGE_NO_WORKTREES: '没有可用的 worktree',
      MERGE_SELECT_BRANCH: '选择要合并的分支',
      MERGE_MULTIPLE_MATCHES: (keyword: string) => `找到多个匹配 "${keyword}" 的分支`,
      MERGE_NO_MATCH: (keyword: string, branches: string[]) => `未找到匹配 "${keyword}" 的分支`,
      MERGE_SQUASH_PROMPT: '是否压缩提交？',
      MERGE_SQUASH_COMMITTED: (branch: string) => `已压缩提交: ${branch}`,
      MERGE_SQUASH_PENDING: (path: string, branch: string) => `请手动提交: ${path}`,
      MERGE_VALIDATE_STATE_HINT: (branch: string) => `分支 ${branch} 存在 validate 状态`,
      MAIN_WORKTREE_DIRTY: '主 worktree 有未提交的更改',
      TARGET_WORKTREE_DIRTY_NO_MESSAGE: (worktreePath: string) =>
        `${worktreePath} 有未提交修改，请提供 -m 参数`,
      TARGET_WORKTREE_NO_CHANGES: '没有可合并的变更',
      MERGE_CONFLICT: '合并冲突',
      PULL_CONFLICT: 'pull 冲突',
      PUSH_FAILED: 'push 失败',
      MERGE_SUCCESS: (branch: string, message: string, autoPullPush: boolean) => `合并成功: ${branch}`,
      MERGE_SUCCESS_NO_MESSAGE: (branch: string, autoPullPush: boolean) => `合并成功: ${branch}`,
      WORKTREE_CLEANED: (branch: string) => `已清理: ${branch}`,
    },
    AUTO_SAVE_COMMIT_MESSAGE: 'clawt:auto-save',
  };
});

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  getProjectName: vi.fn(),
  getGitTopLevel: vi.fn(),
  getProjectWorktrees: vi.fn(),
  isWorkingDirClean: vi.fn(),
  gitAddAll: vi.fn(),
  gitCommit: vi.fn(),
  gitMerge: vi.fn(),
  hasMergeConflict: vi.fn(),
  gitPull: vi.fn(),
  gitPush: vi.fn(),
  hasLocalCommits: vi.fn(),
  hasSnapshot: vi.fn(),
  removeSnapshot: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  printWarning: vi.fn(),
  getConfigValue: vi.fn(),
  confirmAction: vi.fn(),
  cleanupWorktrees: vi.fn(),
  hasCommitWithMessage: vi.fn(),
  gitMergeBase: vi.fn(),
  gitResetSoftTo: vi.fn(),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  gitResetHard: vi.fn(),
  gitCleanForce: vi.fn(),
  gitCheckout: vi.fn(),
  resolveTargetWorktree: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  getMainWorkBranch: vi.fn().mockReturnValue('main'),
  ensureOnMainWorkBranch: vi.fn(),
  guardMainWorkBranch: vi.fn().mockResolvedValue(undefined),
  guardMainWorkBranchExists: vi.fn(),
  handleMergeConflict: vi.fn(),
  isNonInteractive: vi.fn().mockReturnValue(false),
}));

import { registerMergeCommand } from '../../../src/commands/merge.js';
import {
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  gitPull,
  gitPush,
  hasLocalCommits,
  hasSnapshot,
  removeSnapshot,
  printSuccess,
  printWarning,
  getConfigValue,
  confirmAction,
  cleanupWorktrees,
  hasCommitWithMessage,
  resolveTargetWorktree,
  handleMergeConflict,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetGitTopLevel = vi.mocked(getGitTopLevel);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGitAddAll = vi.mocked(gitAddAll);
const mockedGitCommit = vi.mocked(gitCommit);
const mockedGitMerge = vi.mocked(gitMerge);
const mockedHasMergeConflict = vi.mocked(hasMergeConflict);
const mockedGitPull = vi.mocked(gitPull);
const mockedGitPush = vi.mocked(gitPush);
const mockedHasLocalCommits = vi.mocked(hasLocalCommits);
const mockedHasSnapshot = vi.mocked(hasSnapshot);
const mockedRemoveSnapshot = vi.mocked(removeSnapshot);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintWarning = vi.mocked(printWarning);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedConfirmAction = vi.mocked(confirmAction);
const mockedCleanupWorktrees = vi.mocked(cleanupWorktrees);
const mockedHasCommitWithMessage = vi.mocked(hasCommitWithMessage);
const mockedResolveTargetWorktree = vi.mocked(resolveTargetWorktree);
const mockedHandleMergeConflict = vi.mocked(handleMergeConflict);

const worktree = { path: '/path/feature', branch: 'feature' };

beforeEach(() => {
  mockedGetGitTopLevel.mockReturnValue('/repo');
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetProjectWorktrees.mockReturnValue([worktree]);
  mockedResolveTargetWorktree.mockResolvedValue(worktree);
  mockedHasCommitWithMessage.mockReturnValue(false);
  // 显式重置所有可能泄漏的 mock
  mockedHasMergeConflict.mockReset();
  mockedHasMergeConflict.mockReturnValue(false);
  mockedHasSnapshot.mockReturnValue(false);
  mockedGetConfigValue.mockReturnValue(false); // autoPullPush, autoDeleteBranch
  mockedConfirmAction.mockResolvedValue(false);
  mockedGitMerge.mockReset();
  mockedGitPull.mockReset();
  mockedGitPush.mockReset();
  mockedIsWorkingDirClean.mockReset();
  mockedHasLocalCommits.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintWarning.mockReset();
  mockedRemoveSnapshot.mockReset();
  mockedCleanupWorktrees.mockReset();
  mockedHandleMergeConflict.mockReset();
  mockedHandleMergeConflict.mockResolvedValue(true); // 默认 AI 解决成功
});

describe('registerMergeCommand', () => {
  it('注册 merge 命令', () => {
    const program = new Command();
    registerMergeCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'merge');
    expect(cmd).toBeDefined();
  });
});

describe('handleMerge', () => {
  it('主 worktree 不干净时抛出错误', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);

    await expect(
      program.parseAsync(['merge', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('目标 worktree 有未提交修改但未提供 -m 时抛出', async () => {
    mockedIsWorkingDirClean
      .mockReturnValueOnce(true) // 主 worktree 干净
      .mockReturnValueOnce(false); // 目标 worktree 不干净

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);

    await expect(
      program.parseAsync(['merge', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('目标 worktree 有未提交修改且提供 -m 时先提交再合并', async () => {
    mockedIsWorkingDirClean
      .mockReturnValueOnce(true)   // 主 worktree 状态检测：干净
      .mockReturnValueOnce(false); // 目标 worktree 不干净
    mockedConfirmAction.mockResolvedValue(false); // 不清理

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature', '-m', 'test commit'], { from: 'user' });

    expect(mockedGitAddAll).toHaveBeenCalledWith('/path/feature');
    expect(mockedGitCommit).toHaveBeenCalledWith('test commit', '/path/feature');
    expect(mockedGitMerge).toHaveBeenCalledWith('feature', '/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('目标 worktree 干净但无本地提交时抛出', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);

    await expect(
      program.parseAsync(['merge', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('目标 worktree 干净且有本地提交时直接合并', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedGitMerge).toHaveBeenCalledWith('feature', '/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('合并冲突时调用 handleMergeConflict', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGitMerge.mockImplementation(() => { throw new Error('merge conflict'); });
    mockedHasMergeConflict.mockReturnValue(true);
    mockedHandleMergeConflict.mockResolvedValue(true);
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedHandleMergeConflict).toHaveBeenCalledWith('main', 'feature', '/repo', undefined);
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('合并冲突且 handleMergeConflict 抛出时向上传播错误', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGitMerge.mockImplementation(() => { throw new Error('merge conflict'); });
    mockedHasMergeConflict.mockReturnValue(true);
    mockedHandleMergeConflict.mockRejectedValue(new Error('请手动解决冲突'));

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);

    await expect(
      program.parseAsync(['merge', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('合并冲突且 AI 部分解决时提前返回', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGitMerge.mockImplementation(() => { throw new Error('merge conflict'); });
    mockedHasMergeConflict.mockReturnValue(true);
    mockedHandleMergeConflict.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    // AI 未完全解决，不应继续到 pull/push 和 success
    expect(mockedGitPull).not.toHaveBeenCalled();
    expect(mockedPrintSuccess).not.toHaveBeenCalled();
  });

  it('--auto 参数传递给 handleMergeConflict', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGitMerge.mockImplementation(() => { throw new Error('merge conflict'); });
    mockedHasMergeConflict.mockReturnValue(true);
    mockedHandleMergeConflict.mockResolvedValue(true);
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature', '--auto'], { from: 'user' });

    expect(mockedHandleMergeConflict).toHaveBeenCalledWith('main', 'feature', '/repo', true);
  });

  it('autoPullPush=true 时执行 pull 和 push', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGetConfigValue.mockImplementation((key: string) => {
      if (key === 'autoPullPush') return true;
      if (key === 'autoDeleteBranch') return false;
      return false;
    });
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedGitPull).toHaveBeenCalledWith('/repo');
    expect(mockedGitPush).toHaveBeenCalledWith('/repo');
  });

  it('autoDeleteBranch=true 时自动清理', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGetConfigValue.mockImplementation((key: string) => {
      if (key === 'autoPullPush') return false;
      if (key === 'autoDeleteBranch') return true;
      return false;
    });

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedCleanupWorktrees).toHaveBeenCalled();
  });

  it('merge 成功后清理 validate 快照', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedRemoveSnapshot).toHaveBeenCalledWith('test-project', 'feature');
  });

  it('pull 冲突时输出警告', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGetConfigValue.mockImplementation((key: string) => {
      if (key === 'autoPullPush') return true;
      return false;
    });
    mockedGitPull.mockImplementation(() => { throw new Error('pull failed'); });
    // merge 成功后的调用顺序：
    // 1. 步骤 5.5 二次确认 hasMergeConflict → false（merge 成功无冲突）
    // 2. pull catch 中 hasMergeConflict → true（触发 printWarning 并 return）
    mockedHasMergeConflict.mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
  });

  it('push 失败时输出警告', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedGetConfigValue.mockImplementation((key: string) => {
      if (key === 'autoPullPush') return true;
      return false;
    });
    mockedGitPush.mockImplementation(() => { throw new Error('push failed'); });
    mockedConfirmAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerMergeCommand(program);
    await program.parseAsync(['merge', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
  });
});
