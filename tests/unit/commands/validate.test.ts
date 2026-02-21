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
    VALIDATE_NO_WORKTREES: '没有可用的 worktree',
    VALIDATE_SELECT_BRANCH: '选择要验证的分支',
    VALIDATE_MULTIPLE_MATCHES: (keyword: string) => `找到多个匹配 "${keyword}" 的分支`,
    VALIDATE_NO_MATCH: (keyword: string, branches: string[]) => `未找到匹配 "${keyword}" 的分支`,
    TARGET_WORKTREE_CLEAN: '该 worktree 的分支上没有任何更改',
    VALIDATE_SUCCESS: (branch: string) => `✓ 已验证 ${branch}`,
    VALIDATE_CLEANED: (branch: string) => `✓ 已清理 ${branch} 的 validate 状态`,
    VALIDATE_PATCH_APPLY_FAILED: (branch: string) => `patch 应用失败: ${branch}`,
    INCREMENTAL_VALIDATE_SUCCESS: (branch: string) => `✓ 增量验证 ${branch}`,
    INCREMENTAL_VALIDATE_FALLBACK: '降级为全量模式',
    DESTRUCTIVE_OP_CANCELLED: '已取消操作',
  },
}));

// mock enquirer
vi.mock('enquirer', () => ({
  default: {
    Select: vi.fn(),
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  getProjectName: vi.fn(),
  getGitTopLevel: vi.fn(),
  getProjectWorktrees: vi.fn(),
  getConfigValue: vi.fn(),
  isWorkingDirClean: vi.fn(),
  gitAddAll: vi.fn(),
  gitCommit: vi.fn(),
  gitStashPush: vi.fn(),
  gitRestoreStaged: vi.fn(),
  gitResetHard: vi.fn(),
  gitCleanForce: vi.fn(),
  gitDiffBinaryAgainstBranch: vi.fn(),
  gitApplyFromStdin: vi.fn(),
  gitApplyCachedFromStdin: vi.fn(),
  gitResetSoft: vi.fn(),
  gitWriteTree: vi.fn(),
  gitReadTree: vi.fn(),
  getHeadCommitHash: vi.fn(),
  getCommitTreeHash: vi.fn(),
  gitDiffTree: vi.fn(),
  gitApplyCachedCheck: vi.fn(),
  hasLocalCommits: vi.fn(),
  hasSnapshot: vi.fn(),
  readSnapshot: vi.fn(),
  writeSnapshot: vi.fn(),
  removeSnapshot: vi.fn(),
  confirmDestructiveAction: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
  printInfo: vi.fn(),
  resolveTargetWorktree: vi.fn(),
}));

import { registerValidateCommand } from '../../../src/commands/validate.js';
import {
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
  getConfigValue,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitDiffBinaryAgainstBranch,
  gitApplyFromStdin,
  gitResetSoft,
  gitWriteTree,
  gitRestoreStaged,
  getHeadCommitHash,
  gitReadTree,
  hasLocalCommits,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
  confirmDestructiveAction,
  printSuccess,
  printInfo,
  resolveTargetWorktree,
  gitResetHard,
  gitCleanForce,
  getCommitTreeHash,
  gitDiffTree,
  gitApplyCachedCheck,
  gitApplyCachedFromStdin,
  printWarning,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetGitTopLevel = vi.mocked(getGitTopLevel);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGitAddAll = vi.mocked(gitAddAll);
const mockedGitCommit = vi.mocked(gitCommit);
const mockedGitDiffBinaryAgainstBranch = vi.mocked(gitDiffBinaryAgainstBranch);
const mockedGitApplyFromStdin = vi.mocked(gitApplyFromStdin);
const mockedGitResetSoft = vi.mocked(gitResetSoft);
const mockedGitWriteTree = vi.mocked(gitWriteTree);
const mockedGitRestoreStaged = vi.mocked(gitRestoreStaged);
const mockedGetHeadCommitHash = vi.mocked(getHeadCommitHash);
const mockedGitReadTree = vi.mocked(gitReadTree);
const mockedHasLocalCommits = vi.mocked(hasLocalCommits);
const mockedHasSnapshot = vi.mocked(hasSnapshot);
const mockedReadSnapshot = vi.mocked(readSnapshot);
const mockedWriteSnapshot = vi.mocked(writeSnapshot);
const mockedRemoveSnapshot = vi.mocked(removeSnapshot);
const mockedConfirmDestructiveAction = vi.mocked(confirmDestructiveAction);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedResolveTargetWorktree = vi.mocked(resolveTargetWorktree);
const mockedGitResetHard = vi.mocked(gitResetHard);
const mockedGitCleanForce = vi.mocked(gitCleanForce);
const mockedGetCommitTreeHash = vi.mocked(getCommitTreeHash);
const mockedGitDiffTree = vi.mocked(gitDiffTree);
const mockedGitApplyCachedCheck = vi.mocked(gitApplyCachedCheck);
const mockedGitApplyCachedFromStdin = vi.mocked(gitApplyCachedFromStdin);
const mockedPrintWarning = vi.mocked(printWarning);

const worktree = { path: '/path/feature', branch: 'feature' };

beforeEach(() => {
  mockedGetGitTopLevel.mockReturnValue('/repo');
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetProjectWorktrees.mockReturnValue([worktree]);
  mockedResolveTargetWorktree.mockResolvedValue(worktree);
  mockedGetConfigValue.mockReturnValue(false);
  mockedHasSnapshot.mockReturnValue(false);
  mockedIsWorkingDirClean.mockReset();
  mockedGitAddAll.mockReset();
  mockedGitCommit.mockReset();
  mockedGitDiffBinaryAgainstBranch.mockReset();
  mockedGitApplyFromStdin.mockReset();
  mockedGitResetSoft.mockReset();
  mockedGitWriteTree.mockReset();
  mockedGitRestoreStaged.mockReset();
  mockedGetHeadCommitHash.mockReset();
  mockedGitReadTree.mockReset();
  mockedHasLocalCommits.mockReset();
  mockedReadSnapshot.mockReset();
  mockedWriteSnapshot.mockReset();
  mockedRemoveSnapshot.mockReset();
  mockedConfirmDestructiveAction.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintInfo.mockReset();
  mockedGitResetHard.mockReset();
  mockedGitCleanForce.mockReset();
  mockedGetCommitTreeHash.mockReset();
  mockedGitDiffTree.mockReset();
  mockedGitApplyCachedCheck.mockReset();
  mockedGitApplyCachedFromStdin.mockReset();
  mockedPrintWarning.mockReset();
});

describe('registerValidateCommand', () => {
  it('注册 validate 命令', () => {
    const program = new Command();
    registerValidateCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'validate');
    expect(cmd).toBeDefined();
  });
});

describe('handleValidate', () => {
  it('目标分支无变更时提示并返回', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
    expect(mockedGitDiffBinaryAgainstBranch).not.toHaveBeenCalled();
  });

  it('首次 validate：有已提交 commit 且主 worktree 干净', async () => {
    // 目标 worktree 干净，但有已提交 commit
    mockedIsWorkingDirClean.mockReturnValue(true); // 所有调用都返回 true
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash123');
    mockedGetHeadCommitHash.mockReturnValue('headhash456');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGitDiffBinaryAgainstBranch).toHaveBeenCalledWith('feature', '/repo');
    expect(mockedGitApplyFromStdin).toHaveBeenCalled();
    expect(mockedWriteSnapshot).toHaveBeenCalledWith('test-project', 'feature', 'treehash123', 'headhash456');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('首次 validate：有未提交修改时做临时 commit 后撤销', async () => {
    // 主 worktree 干净，目标 worktree 有未提交修改
    mockedIsWorkingDirClean
      .mockReturnValueOnce(true)    // 主 worktree 调用（collectStatus 或 handleValidate 首次检查目标）
      .mockReturnValueOnce(false);  // 目标 worktree 检查
    mockedHasLocalCommits.mockReturnValue(false); // 无已提交 commit，但有未提交修改
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash');
    mockedGetHeadCommitHash.mockReturnValue('headhash');

    // 注意：hasUncommitted 来自 !isWorkingDirClean(targetWorktreePath)
    // 这里的 mock 链：
    // 第 1 次调用 isWorkingDirClean: 检查 targetWorktreePath => false（有未提交修改）
    // 但是代码中先检查 isWorkingDirClean(mainWorktreePath)
    // 需要更精确的 mock
    mockedIsWorkingDirClean.mockReset();
    mockedIsWorkingDirClean.mockImplementation((cwd?: string) => {
      if (cwd === '/path/feature') return false;  // 目标 worktree 不干净
      return true;  // 主 worktree 干净
    });
    // 因为 hasUncommitted 依赖 !isWorkingDirClean(targetWorktreePath)，
    // 且 !hasUncommitted && !hasCommitted 需要检查 hasLocalCommits
    mockedHasLocalCommits.mockReturnValue(true); // 让它不走"无变更"路径

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    // 临时 commit
    expect(mockedGitAddAll).toHaveBeenCalledWith('/path/feature');
    expect(mockedGitCommit).toHaveBeenCalledWith('clawt:temp-commit-for-validate', '/path/feature');
    // 撤销临时 commit
    expect(mockedGitResetSoft).toHaveBeenCalledWith(1, '/path/feature');
    expect(mockedGitRestoreStaged).toHaveBeenCalledWith('/path/feature');
  });
});

describe('handleValidateClean', () => {
  it('确认后清理 validate 状态', async () => {
    mockedGetConfigValue.mockReturnValue(true); // confirmDestructiveOps
    mockedConfirmDestructiveAction.mockResolvedValue(true);
    mockedIsWorkingDirClean.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature'], { from: 'user' });

    expect(mockedGitResetHard).toHaveBeenCalledWith('/repo');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/repo');
    expect(mockedRemoveSnapshot).toHaveBeenCalledWith('test-project', 'feature');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('用户拒绝时取消操作', async () => {
    mockedGetConfigValue.mockReturnValue(true);
    mockedConfirmDestructiveAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature'], { from: 'user' });

    expect(mockedGitResetHard).not.toHaveBeenCalled();
    expect(mockedRemoveSnapshot).not.toHaveBeenCalled();
  });

  it('confirmDestructiveOps=false 时跳过确认', async () => {
    mockedGetConfigValue.mockReturnValue(false);
    mockedIsWorkingDirClean.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature'], { from: 'user' });

    expect(mockedConfirmDestructiveAction).not.toHaveBeenCalled();
    expect(mockedRemoveSnapshot).toHaveBeenCalledWith('test-project', 'feature');
  });
});

describe('增量 validate', () => {
  it('HEAD 未变化时使用 read-tree 旧快照', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash' });
    mockedGetHeadCommitHash.mockReturnValue('headhash'); // HEAD 未变化
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGitReadTree).toHaveBeenCalledWith('oldtree', '/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('HEAD 变化时通过 patch 重放旧变更到暂存区', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'oldhead' });
    mockedGetHeadCommitHash.mockReturnValue('newhead'); // HEAD 已变化
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedGetCommitTreeHash.mockReturnValue('oldheadtree');
    mockedGitDiffTree.mockReturnValue(Buffer.from('old change patch'));
    mockedGitApplyCachedCheck.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGetCommitTreeHash).toHaveBeenCalledWith('oldhead', '/repo');
    expect(mockedGitDiffTree).toHaveBeenCalledWith('oldheadtree', 'oldtree', '/repo');
    expect(mockedGitApplyCachedFromStdin).toHaveBeenCalled();
  });

  it('旧变更 patch 有冲突时降级为全量模式', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'oldhead' });
    mockedGetHeadCommitHash.mockReturnValue('newhead');
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedGetCommitTreeHash.mockReturnValue('oldheadtree');
    mockedGitDiffTree.mockReturnValue(Buffer.from('conflicting patch'));
    mockedGitApplyCachedCheck.mockReturnValue(false); // 有冲突

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedGitApplyCachedFromStdin).not.toHaveBeenCalled();
  });

  it('read-tree 失败时降级为全量模式', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash' });
    mockedGetHeadCommitHash.mockReturnValue('headhash');
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedGitReadTree.mockImplementation(() => { throw new Error('gc reclaimed'); });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});
