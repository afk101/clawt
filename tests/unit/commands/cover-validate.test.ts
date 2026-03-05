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
    COVER_VALIDATE_NOT_ON_VALIDATE_BRANCH: '当前分支不是验证分支',
    COVER_VALIDATE_NO_CHANGES: '验证分支上没有相对于快照的增量修改，无需覆盖',
    COVER_VALIDATE_TARGET_NOT_FOUND: (branch: string) => `未找到分支 ${branch} 对应的 worktree`,
    COVER_VALIDATE_NO_SNAPSHOT: (branch: string) => `未找到分支 ${branch} 的 validate 快照`,
    COVER_VALIDATE_APPLY_FAILED: (branch: string) => `覆盖变更到 worktree ${branch} 失败`,
    COVER_VALIDATE_SUCCESS: (branch: string) => `✓ 已将验证分支上的修改覆盖到 worktree => ${branch}`,
    COVER_VALIDATE_WORKING_DIR_CLEAN: '当前验证分支的工作区和暂存区没有任何修改，可能为误操作',
  },
  VALIDATE_BRANCH_PREFIX: 'clawt-validate-',
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  requireProjectConfig: vi.fn(),
  getProjectName: vi.fn().mockReturnValue('test-project'),
  getGitTopLevel: vi.fn().mockReturnValue('/repo'),
  getCurrentBranch: vi.fn().mockReturnValue('clawt-validate-feature'),
  getProjectWorktrees: vi.fn().mockReturnValue([{ path: '/path/feature', branch: 'feature' }]),
  findExactMatch: vi.fn().mockReturnValue({ path: '/path/feature', branch: 'feature' }),
  hasSnapshot: vi.fn().mockReturnValue(true),
  readSnapshot: vi.fn().mockReturnValue({ treeHash: 'snapshot-tree-hash' }),
  writeSnapshot: vi.fn(),
  gitAddAll: vi.fn(),
  gitWriteTree: vi.fn().mockReturnValue('current-tree-hash'),
  gitReadTree: vi.fn(),
  gitDiffTree: vi.fn().mockReturnValue(Buffer.from('fake-patch')),
  gitApplyFromStdin: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  isWorkingDirClean: vi.fn().mockReturnValue(false),
  confirmAction: vi.fn().mockResolvedValue(true),
  guardMainWorkBranch: vi.fn().mockResolvedValue(undefined),
  guardMainWorkBranchExists: vi.fn(),
}));

import { registerCoverValidateCommand, extractTargetBranchName, findTargetWorktreePath, computeIncrementalPatch } from '../../../src/commands/cover-validate.js';
import {
  getCurrentBranch,
  getProjectWorktrees,
  findExactMatch,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  gitAddAll,
  gitWriteTree,
  gitReadTree,
  gitDiffTree,
  gitApplyFromStdin,
  printSuccess,
  printInfo,
  isWorkingDirClean,
  confirmAction,
} from '../../../src/utils/index.js';

const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedFindExactMatch = vi.mocked(findExactMatch);
const mockedHasSnapshot = vi.mocked(hasSnapshot);
const mockedReadSnapshot = vi.mocked(readSnapshot);
const mockedWriteSnapshot = vi.mocked(writeSnapshot);
const mockedGitAddAll = vi.mocked(gitAddAll);
const mockedGitWriteTree = vi.mocked(gitWriteTree);
const mockedGitReadTree = vi.mocked(gitReadTree);
const mockedGitDiffTree = vi.mocked(gitDiffTree);
const mockedGitApplyFromStdin = vi.mocked(gitApplyFromStdin);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedConfirmAction = vi.mocked(confirmAction);

beforeEach(() => {
  vi.clearAllMocks();
  // 恢复默认 mock 值
  mockedGetCurrentBranch.mockReturnValue('clawt-validate-feature');
  mockedGetProjectWorktrees.mockReturnValue([{ path: '/path/feature', branch: 'feature' }]);
  mockedFindExactMatch.mockReturnValue({ path: '/path/feature', branch: 'feature' });
  mockedHasSnapshot.mockReturnValue(true);
  mockedReadSnapshot.mockReturnValue({ treeHash: 'snapshot-tree-hash' });
  mockedIsWorkingDirClean.mockReturnValue(false);
  mockedConfirmAction.mockResolvedValue(true);
  mockedGitWriteTree.mockReturnValue('current-tree-hash');
  mockedGitDiffTree.mockReturnValue(Buffer.from('fake-patch'));
});

describe('registerCoverValidateCommand', () => {
  it('注册 cover 命令', () => {
    const program = new Command();
    registerCoverValidateCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'cover');
    expect(cmd).toBeDefined();
  });
});

describe('extractTargetBranchName', () => {
  it('从验证分支名中提取目标分支名', () => {
    expect(extractTargetBranchName('clawt-validate-feature')).toBe('feature');
    expect(extractTargetBranchName('clawt-validate-fix/bug-123')).toBe('fix/bug-123');
  });
});

describe('findTargetWorktreePath', () => {
  it('找到目标 worktree 时返回路径', () => {
    const path = findTargetWorktreePath('feature');
    expect(path).toBe('/path/feature');
  });

  it('未找到目标 worktree 时抛出错误', () => {
    mockedFindExactMatch.mockReturnValue(undefined);
    expect(() => findTargetWorktreePath('nonexistent')).toThrow();
  });
});

describe('computeIncrementalPatch', () => {
  it('有增量变更时返回 patch 和 currentTreeHash', () => {
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')  // 保存暂存区
      .mockReturnValueOnce('new-tree-hash');     // git add . 后的 tree

    const result = computeIncrementalPatch('snapshot-tree-hash', '/repo');
    expect(result).not.toBeNull();
    expect(result!.currentTreeHash).toBe('new-tree-hash');
    expect(mockedGitAddAll).toHaveBeenCalledWith('/repo');
    expect(mockedGitReadTree).toHaveBeenCalledWith('saved-index-tree', '/repo');
    expect(mockedGitDiffTree).toHaveBeenCalledWith('snapshot-tree-hash', 'new-tree-hash', '/repo');
  });

  it('无增量变更时返回 null', () => {
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')
      .mockReturnValueOnce('snapshot-tree-hash'); // 与快照相同

    const result = computeIncrementalPatch('snapshot-tree-hash', '/repo');
    expect(result).toBeNull();
  });
});

describe('handleCoverValidate - 工作区干净检查', () => {
  /** 辅助函数：执行 cover 命令 */
  async function runCover(): Promise<void> {
    const program = new Command();
    program.exitOverride();
    registerCoverValidateCommand(program);
    await program.parseAsync(['cover'], { from: 'user' });
  }

  it('工作区干净且用户取消时不执行 patch', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(false);

    await runCover();

    expect(mockedPrintInfo).toHaveBeenCalled();
    expect(mockedConfirmAction).toHaveBeenCalledWith('是否继续执行覆盖？');
    // 用户取消后不应继续执行后续逻辑
    expect(mockedGitAddAll).not.toHaveBeenCalled();
    expect(mockedGitApplyFromStdin).not.toHaveBeenCalled();
    expect(mockedPrintSuccess).not.toHaveBeenCalled();
  });

  it('工作区干净且用户确认继续时正常执行', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(true);
    // computeIncrementalPatch 返回有 patch 的结果
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')
      .mockReturnValueOnce('new-tree-hash');

    await runCover();

    expect(mockedConfirmAction).toHaveBeenCalledWith('是否继续执行覆盖？');
    expect(mockedGitApplyFromStdin).toHaveBeenCalled();
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('工作区不干净时跳过确认直接执行', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')
      .mockReturnValueOnce('new-tree-hash');

    await runCover();

    expect(mockedConfirmAction).not.toHaveBeenCalled();
    expect(mockedGitApplyFromStdin).toHaveBeenCalled();
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});
