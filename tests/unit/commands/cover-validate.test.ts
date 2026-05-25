import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock i18n 模块，使 getCurrentLanguage 返回 'zh-CN' 以匹配中文断言
// 同时导出 createMessages 供 constants 模块使用
vi.mock('../../../src/utils/i18n.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/i18n.js')>();
  return {
    ...actual,
    getCurrentLanguage: vi.fn().mockReturnValue('zh-CN'),
    resetLanguageCache: vi.fn(),
  };
});

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
    COVER_VALIDATE_COVER_FAILED: (branch: string) => `覆盖变更到 worktree ${branch} 失败`,
    COVER_VALIDATE_SUCCESS: (branch: string) => `✓ 已将验证分支上的修改覆盖到 worktree => ${branch}`,
    COVER_VALIDATE_WORKING_DIR_CLEAN: '当前验证分支的工作区和暂存区没有任何修改，可能为误操作',
  },
  VALIDATE_BRANCH_PREFIX: 'clawt-validate-',
}));

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  requireProjectConfig: vi.fn(),
  getProjectName: vi.fn().mockReturnValue('test-project'),
  getGitTopLevel: vi.fn().mockReturnValue('/repo'),
  getCurrentBranch: vi.fn().mockReturnValue('clawt-validate-feature'),
  getProjectWorktrees: vi.fn().mockReturnValue([{ path: '/path/feature', branch: 'feature' }]),
  findExactMatch: vi.fn().mockReturnValue({ path: '/path/feature', branch: 'feature' }),
  hasSnapshot: vi.fn().mockReturnValue(true),
  readSnapshot: vi.fn().mockReturnValue({ treeHash: 'snapshot-tree-hash', headCommitHash: '', stagedTreeHash: '' }),
  writeSnapshot: vi.fn(),
  gitAddAll: vi.fn(),
  gitWriteTree: vi.fn().mockReturnValue('current-tree-hash'),
  gitReadTree: vi.fn(),
  gitCheckoutIndexForce: vi.fn(),
  gitCleanForce: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  isWorkingDirClean: vi.fn().mockReturnValue(false),
  confirmAction: vi.fn().mockResolvedValue(true),
  guardMainWorkBranch: vi.fn().mockResolvedValue(undefined),
  guardMainWorkBranchExists: vi.fn(),
  isNonInteractive: vi.fn().mockReturnValue(false),
}));

import { registerCoverValidateCommand, extractTargetBranchName, findTargetWorktreePath, computeWorktreeTreeHash } from '../../../src/commands/cover-validate.js';
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
  gitCheckoutIndexForce,
  gitCleanForce,
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
const mockedGitCheckoutIndexForce = vi.mocked(gitCheckoutIndexForce);
const mockedGitCleanForce = vi.mocked(gitCleanForce);
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
  mockedReadSnapshot.mockReturnValue({ treeHash: 'snapshot-tree-hash', headCommitHash: '', stagedTreeHash: '' });
  mockedIsWorkingDirClean.mockReturnValue(false);
  mockedConfirmAction.mockResolvedValue(true);
  mockedGitWriteTree.mockReturnValue('current-tree-hash');
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

describe('computeWorktreeTreeHash', () => {
  it('返回当前工作区的 tree hash', () => {
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')  // 保存暂存区
      .mockReturnValueOnce('new-tree-hash');     // git add . 后的 tree

    const result = computeWorktreeTreeHash('/repo');
    expect(result).toBe('new-tree-hash');
    expect(mockedGitAddAll).toHaveBeenCalledWith('/repo');
    expect(mockedGitReadTree).toHaveBeenCalledWith('saved-index-tree', '/repo');
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

  it('工作区干净且用户取消时不执行覆盖', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(false);

    await runCover();

    expect(mockedPrintInfo).toHaveBeenCalled();
    expect(mockedConfirmAction).toHaveBeenCalledWith('是否继续执行覆盖？');
    // 用户取消后不应继续执行后续逻辑
    expect(mockedGitAddAll).not.toHaveBeenCalled();
    expect(mockedGitCheckoutIndexForce).not.toHaveBeenCalled();
    expect(mockedGitCleanForce).not.toHaveBeenCalled();
    expect(mockedPrintSuccess).not.toHaveBeenCalled();
  });

  it('工作区干净且用户确认继续时正常执行', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(true);
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')
      .mockReturnValueOnce('new-tree-hash');

    await runCover();

    expect(mockedConfirmAction).toHaveBeenCalledWith('是否继续执行覆盖？');
    expect(mockedGitReadTree).toHaveBeenCalledWith('new-tree-hash', '/path/feature');
    expect(mockedGitCheckoutIndexForce).toHaveBeenCalledWith('/path/feature');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/path/feature');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('工作区不干净时跳过确认直接执行', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);
    mockedGitWriteTree
      .mockReturnValueOnce('saved-index-tree')
      .mockReturnValueOnce('new-tree-hash');

    await runCover();

    expect(mockedConfirmAction).not.toHaveBeenCalled();
    expect(mockedGitReadTree).toHaveBeenCalledWith('new-tree-hash', '/path/feature');
    expect(mockedGitCheckoutIndexForce).toHaveBeenCalledWith('/path/feature');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/path/feature');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});
