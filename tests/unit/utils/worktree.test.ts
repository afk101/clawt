import { describe, it, expect, vi } from 'vitest';

// mock git 函数
vi.mock('../../../src/utils/git.js', () => ({
  getProjectName: vi.fn().mockReturnValue('my-project'),
  gitWorktreeList: vi.fn().mockReturnValue(''),
  createWorktree: vi.fn(),
  removeWorktreeByPath: vi.fn(),
  deleteBranch: vi.fn(),
  gitWorktreePrune: vi.fn(),
  getCommitCountAhead: vi.fn(),
  getDiffStat: vi.fn(),
  isWorkingDirClean: vi.fn(),
}));

// mock branch
vi.mock('../../../src/utils/branch.js', () => ({
  sanitizeBranchName: vi.fn((name: string) => name),
  generateBranchNames: vi.fn((name: string, count: number) =>
    count === 1 ? [name] : Array.from({ length: count }, (_, i) => `${name}-${i + 1}`),
  ),
  validateBranchesNotExist: vi.fn(),
}));

// mock fs
vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: vi.fn(),
  removeEmptyDir: vi.fn(),
}));

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// mock constants
vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...original,
    WORKTREES_DIR: '/tmp/test-worktrees',
  };
});

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock validate-branch
vi.mock('../../../src/utils/validate-branch.js', () => ({
  createValidateBranch: vi.fn(),
  deleteValidateBranch: vi.fn(),
}));

import { existsSync, readdirSync } from 'node:fs';
import {
  getProjectName,
  gitWorktreeList,
  createWorktree as gitCreateWorktree,
  removeWorktreeByPath,
  deleteBranch,
  gitWorktreePrune,
  getCommitCountAhead,
  getDiffStat,
  isWorkingDirClean,
} from '../../../src/utils/git.js';
import { sanitizeBranchName, validateBranchesNotExist } from '../../../src/utils/branch.js';
import { ensureDir, removeEmptyDir } from '../../../src/utils/fs.js';
import { createWorktrees, createWorktreesByBranches, getProjectWorktrees, cleanupWorktrees, getWorktreeStatus } from '../../../src/utils/worktree.js';
import { createWorktreeInfo } from '../../helpers/fixtures.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReaddirSync = vi.mocked(readdirSync);
const mockedGitWorktreeList = vi.mocked(gitWorktreeList);
const mockedGitCreateWorktree = vi.mocked(gitCreateWorktree);
const mockedRemoveWorktreeByPath = vi.mocked(removeWorktreeByPath);
const mockedDeleteBranch = vi.mocked(deleteBranch);
const mockedGetCommitCountAhead = vi.mocked(getCommitCountAhead);
const mockedGetDiffStat = vi.mocked(getDiffStat);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);

describe('createWorktrees', () => {
  it('单个 worktree 创建', () => {
    const result = createWorktrees('feature', 1);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('feature');
    expect(result[0].path).toContain('feature');
    expect(mockedGitCreateWorktree).toHaveBeenCalledTimes(1);
  });

  it('多个 worktree 创建', () => {
    const result = createWorktrees('task', 3);
    expect(result).toHaveLength(3);
    expect(result[0].branch).toBe('task-1');
    expect(result[1].branch).toBe('task-2');
    expect(result[2].branch).toBe('task-3');
    expect(mockedGitCreateWorktree).toHaveBeenCalledTimes(3);
  });

  it('调用分支名清理和存在性校验', () => {
    createWorktrees('feature', 1);
    expect(sanitizeBranchName).toHaveBeenCalledWith('feature');
    expect(validateBranchesNotExist).toHaveBeenCalled();
    expect(ensureDir).toHaveBeenCalled();
  });
});

describe('createWorktreesByBranches', () => {
  it('根据分支名列表创建 worktree', () => {
    const result = createWorktreesByBranches(['feat-login', 'fix-bug']);
    expect(result).toHaveLength(2);
    expect(result[0].branch).toBe('feat-login');
    expect(result[1].branch).toBe('fix-bug');
    expect(mockedGitCreateWorktree).toHaveBeenCalledTimes(2);
  });

  it('调用存在性校验但不调用分支名清理', () => {
    createWorktreesByBranches(['feat-a', 'feat-b']);
    // 不使用 sanitizeBranchName（调用方负责清理）
    expect(sanitizeBranchName).not.toHaveBeenCalled();
    expect(validateBranchesNotExist).toHaveBeenCalledWith(['feat-a', 'feat-b']);
    expect(ensureDir).toHaveBeenCalled();
  });

  it('单个分支名也能正常创建', () => {
    const result = createWorktreesByBranches(['single-branch']);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('single-branch');
    expect(mockedGitCreateWorktree).toHaveBeenCalledTimes(1);
  });
});

describe('getProjectWorktrees', () => {
  it('项目目录不存在时返回空数组', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(getProjectWorktrees()).toEqual([]);
  });

  it('正确解析和交叉验证', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedGitWorktreeList.mockReturnValue(
      '/repo  abc [main]\n/tmp/test-worktrees/my-project/feature  def [feature]',
    );
    mockedReaddirSync.mockReturnValue([
      { name: 'feature', isDirectory: () => true },
      { name: 'orphan', isDirectory: () => true },
      { name: 'file.txt', isDirectory: () => false },
    ] as any);
    const result = getProjectWorktrees();
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('feature');
  });
});

describe('cleanupWorktrees', () => {
  it('正确调用删除流程', () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'a', path: '/path/a' }),
      createWorktreeInfo({ branch: 'b', path: '/path/b' }),
    ];
    cleanupWorktrees(worktrees);
    expect(mockedRemoveWorktreeByPath).toHaveBeenCalledTimes(2);
    expect(mockedDeleteBranch).toHaveBeenCalledTimes(2);
    expect(gitWorktreePrune).toHaveBeenCalled();
    expect(removeEmptyDir).toHaveBeenCalled();
  });

  it('单个删除失败不影响后续', () => {
    mockedRemoveWorktreeByPath.mockImplementationOnce(() => { throw new Error('fail'); });
    const worktrees = [
      createWorktreeInfo({ branch: 'a', path: '/path/a' }),
      createWorktreeInfo({ branch: 'b', path: '/path/b' }),
    ];
    // 不应抛出异常
    expect(() => cleanupWorktrees(worktrees)).not.toThrow();
  });
});

describe('getWorktreeStatus', () => {
  it('正确聚合状态信息', () => {
    mockedGetCommitCountAhead.mockReturnValue(5);
    mockedGetDiffStat.mockReturnValue({ insertions: 100, deletions: 20 });
    mockedIsWorkingDirClean.mockReturnValue(false);
    const worktree = createWorktreeInfo();
    const result = getWorktreeStatus(worktree);
    expect(result).toEqual({
      commitCount: 5,
      insertions: 100,
      deletions: 20,
      hasDirtyFiles: true,
    });
  });

  it('工作区干净时 hasDirtyFiles 为 false', () => {
    mockedGetCommitCountAhead.mockReturnValue(0);
    mockedGetDiffStat.mockReturnValue({ insertions: 0, deletions: 0 });
    mockedIsWorkingDirClean.mockReturnValue(true);
    const worktree = createWorktreeInfo();
    const result = getWorktreeStatus(worktree);
    expect(result).not.toBeNull();
    expect(result!.hasDirtyFiles).toBe(false);
  });

  it('获取失败时返回 null', () => {
    mockedGetCommitCountAhead.mockImplementation(() => { throw new Error('fail'); });
    const worktree = createWorktreeInfo();
    const result = getWorktreeStatus(worktree);
    expect(result).toBeNull();
  });
});
