import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock shell（拦截所有 git 操作）
vi.mock('../../../src/utils/shell.js', () => ({
  execCommand: vi.fn(),
  execCommandWithInput: vi.fn(),
}));

// mock node:child_process（用于直接调用 execSync 的函数）
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { execSync } from 'node:child_process';
import { execCommand, execCommandWithInput } from '../../../src/utils/shell.js';
import {
  getGitCommonDir,
  getGitTopLevel,
  getProjectName,
  checkBranchExists,
  createWorktree,
  removeWorktreeByPath,
  deleteBranch,
  getStatusPorcelain,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  gitResetHard,
  gitCleanForce,
  gitStashPush,
  gitStashApply,
  gitStashPop,
  gitStashDrop,
  gitStashList,
  gitRestoreStaged,
  gitWorktreeList,
  gitWorktreePrune,
  hasLocalCommits,
  getCommitCountAhead,
  getDiffStat,
  gitDiffCachedBinary,
  gitApplyCachedFromStdin,
  getCurrentBranch,
  getHeadCommitHash,
  gitDiffBinaryAgainstBranch,
  gitApplyFromStdin,
  gitResetSoft,
  gitMergeBase,
  hasCommitWithMessage,
  gitResetSoftTo,
  gitWriteTree,
  gitReadTree,
  getCommitTreeHash,
  gitDiffTree,
  gitApplyCachedCheck,
} from '../../../src/utils/git.js';

const mockedExecCommand = vi.mocked(execCommand);
const mockedExecCommandWithInput = vi.mocked(execCommandWithInput);
const mockedExecSync = vi.mocked(execSync);

beforeEach(() => {
  // 重置 mock 实现，避免前一个测试的 mockImplementation 影响后续测试
  mockedExecCommand.mockReset();
  mockedExecCommandWithInput.mockReset();
  mockedExecSync.mockReset();
});

describe('getGitCommonDir', () => {
  it('返回 git common dir', () => {
    mockedExecCommand.mockReturnValue('.git');
    expect(getGitCommonDir()).toBe('.git');
  });

  it('传递 cwd', () => {
    mockedExecCommand.mockReturnValue('/path/.git');
    getGitCommonDir('/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git rev-parse --git-common-dir', { cwd: '/repo' });
  });
});

describe('getGitTopLevel', () => {
  it('返回仓库根目录', () => {
    mockedExecCommand.mockReturnValue('/Users/test/project');
    expect(getGitTopLevel()).toBe('/Users/test/project');
  });
});

describe('getProjectName', () => {
  it('返回仓库根目录的 basename', () => {
    mockedExecCommand.mockReturnValue('/Users/test/my-project');
    expect(getProjectName()).toBe('my-project');
  });
});

describe('checkBranchExists', () => {
  it('分支存在时返回 true', () => {
    mockedExecCommand.mockReturnValue('abc123 refs/heads/feature');
    expect(checkBranchExists('feature')).toBe(true);
  });

  it('分支不存在时返回 false', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('not found'); });
    expect(checkBranchExists('nonexistent')).toBe(false);
  });
});

describe('createWorktree', () => {
  it('执行正确的 git 命令', () => {
    mockedExecCommand.mockReturnValue('');
    createWorktree('feature', '/path/to/worktree');
    expect(mockedExecCommand).toHaveBeenCalledWith(
      'git worktree add -b feature "/path/to/worktree"',
      { cwd: undefined },
    );
  });
});

describe('removeWorktreeByPath', () => {
  it('执行强制移除命令', () => {
    mockedExecCommand.mockReturnValue('');
    removeWorktreeByPath('/path/to/worktree');
    expect(mockedExecCommand).toHaveBeenCalledWith(
      'git worktree remove -f "/path/to/worktree"',
      { cwd: undefined },
    );
  });
});

describe('deleteBranch', () => {
  it('执行强制删除分支命令', () => {
    mockedExecCommand.mockReturnValue('');
    deleteBranch('feature');
    expect(mockedExecCommand).toHaveBeenCalledWith('git branch -D feature', { cwd: undefined });
  });
});

describe('getStatusPorcelain', () => {
  it('返回 porcelain 输出', () => {
    mockedExecCommand.mockReturnValue('M file.txt');
    expect(getStatusPorcelain()).toBe('M file.txt');
  });
});

describe('isWorkingDirClean', () => {
  it('干净时返回 true', () => {
    mockedExecCommand.mockReturnValue('');
    expect(isWorkingDirClean()).toBe(true);
  });

  it('有修改时返回 false', () => {
    mockedExecCommand.mockReturnValue('M file.txt');
    expect(isWorkingDirClean()).toBe(false);
  });
});

describe('gitAddAll', () => {
  it('执行 git add .', () => {
    gitAddAll('/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git add .', { cwd: '/repo' });
  });
});

describe('gitCommit', () => {
  it('执行 git commit 并转义单引号', () => {
    gitCommit("it's a test");
    expect(mockedExecCommand).toHaveBeenCalledWith(
      expect.stringContaining('git commit -m'),
      { cwd: undefined },
    );
  });
});

describe('gitMerge', () => {
  it('执行 git merge', () => {
    gitMerge('feature');
    expect(mockedExecCommand).toHaveBeenCalledWith('git merge feature', { cwd: undefined });
  });
});

describe('hasMergeConflict', () => {
  it('UU 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('UU file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('AA 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('AA file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('DD 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('DD file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('DU 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('DU file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('UD 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('UD file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('AU 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('AU file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('UA 冲突返回 true', () => {
    mockedExecCommand.mockReturnValue('UA file.txt');
    expect(hasMergeConflict()).toBe(true);
  });

  it('无冲突返回 false', () => {
    mockedExecCommand.mockReturnValue('M  file.txt');
    expect(hasMergeConflict()).toBe(false);
  });

  it('空状态返回 false', () => {
    mockedExecCommand.mockReturnValue('');
    expect(hasMergeConflict()).toBe(false);
  });
});

describe('gitResetHard', () => {
  it('执行 git reset --hard HEAD', () => {
    gitResetHard('/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git reset --hard HEAD', { cwd: '/repo' });
  });
});

describe('gitCleanForce', () => {
  it('执行 git clean -fd', () => {
    gitCleanForce('/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git clean -fd', { cwd: '/repo' });
  });
});

describe('gitStashPush', () => {
  it('执行 git stash push -m', () => {
    gitStashPush('auto-stash', '/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git stash push -m "auto-stash"', { cwd: '/repo' });
  });
});

describe('gitStashApply', () => {
  it('执行 git stash apply', () => {
    gitStashApply();
    expect(mockedExecCommand).toHaveBeenCalledWith('git stash apply', { cwd: undefined });
  });
});

describe('gitStashPop', () => {
  it('默认弹出 stash@{0}', () => {
    gitStashPop();
    expect(mockedExecCommand).toHaveBeenCalledWith('git stash pop stash@{0}', { cwd: undefined });
  });

  it('指定索引', () => {
    gitStashPop(2);
    expect(mockedExecCommand).toHaveBeenCalledWith('git stash pop stash@{2}', { cwd: undefined });
  });
});

describe('gitStashDrop', () => {
  it('默认删除 stash@{0}', () => {
    gitStashDrop();
    expect(mockedExecCommand).toHaveBeenCalledWith('git stash drop stash@{0}', { cwd: undefined });
  });
});

describe('gitStashList', () => {
  it('返回 stash 列表', () => {
    mockedExecCommand.mockReturnValue('stash@{0}: WIP');
    expect(gitStashList()).toBe('stash@{0}: WIP');
  });

  it('命令失败时返回空字符串', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('fail'); });
    expect(gitStashList()).toBe('');
  });
});

describe('gitRestoreStaged', () => {
  it('执行 git restore --staged .', () => {
    mockedExecCommand.mockReturnValue('');
    gitRestoreStaged('/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git restore --staged .', { cwd: '/repo' });
  });
});

describe('gitWorktreeList', () => {
  it('返回 worktree 列表', () => {
    mockedExecCommand.mockReturnValue('/repo  abc123 [main]');
    expect(gitWorktreeList()).toBe('/repo  abc123 [main]');
  });
});

describe('gitWorktreePrune', () => {
  it('执行 git worktree prune', () => {
    gitWorktreePrune();
    expect(mockedExecCommand).toHaveBeenCalledWith('git worktree prune', { cwd: undefined });
  });
});

describe('hasLocalCommits', () => {
  it('有本地提交时返回 true', () => {
    mockedExecCommand.mockReturnValue('abc123 some commit');
    expect(hasLocalCommits('feature')).toBe(true);
  });

  it('无本地提交时返回 false', () => {
    mockedExecCommand.mockReturnValue('');
    expect(hasLocalCommits('feature')).toBe(false);
  });

  it('命令失败时返回 false', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('fail'); });
    expect(hasLocalCommits('feature')).toBe(false);
  });
});

describe('getCommitCountAhead', () => {
  it('返回正确的提交数', () => {
    mockedExecCommand.mockReturnValue('5');
    expect(getCommitCountAhead('feature')).toBe(5);
  });

  it('返回 0 当输出无法解析', () => {
    mockedExecCommand.mockReturnValue('');
    expect(getCommitCountAhead('feature')).toBe(0);
  });
});

describe('getDiffStat（间接测试 parseShortStat）', () => {
  it('解析标准 shortstat 输出', () => {
    mockedExecCommand.mockReturnValue(' 3 files changed, 42 insertions(+), 10 deletions(-)');
    const result = getDiffStat('/repo');
    expect(result).toEqual({ insertions: 42, deletions: 10 });
  });

  it('仅有 insertions', () => {
    mockedExecCommand.mockReturnValue(' 1 file changed, 5 insertions(+)');
    const result = getDiffStat('/repo');
    expect(result).toEqual({ insertions: 5, deletions: 0 });
  });

  it('仅有 deletions', () => {
    mockedExecCommand.mockReturnValue(' 1 file changed, 3 deletions(-)');
    const result = getDiffStat('/repo');
    expect(result).toEqual({ insertions: 0, deletions: 3 });
  });

  it('空输出（无变更）', () => {
    mockedExecCommand.mockReturnValue('');
    const result = getDiffStat('/repo');
    expect(result).toEqual({ insertions: 0, deletions: 0 });
  });

  it('单数形式 (1 insertion)', () => {
    mockedExecCommand.mockReturnValue(' 1 file changed, 1 insertion(+)');
    const result = getDiffStat('/repo');
    expect(result).toEqual({ insertions: 1, deletions: 0 });
  });
});

describe('gitDiffCachedBinary', () => {
  it('调用 execSync 获取 binary diff', () => {
    const buffer = Buffer.from('diff content');
    mockedExecSync.mockReturnValue(buffer);
    const result = gitDiffCachedBinary('/repo');
    expect(result).toBe(buffer);
    expect(mockedExecSync).toHaveBeenCalledWith('git diff --cached --binary', expect.objectContaining({
      cwd: '/repo',
    }));
  });
});

describe('gitApplyCachedFromStdin', () => {
  it('调用 execCommandWithInput 传递 patch', () => {
    const patch = Buffer.from('patch content');
    gitApplyCachedFromStdin(patch, '/repo');
    expect(mockedExecCommandWithInput).toHaveBeenCalledWith('git', ['apply', '--cached'], {
      input: patch,
      cwd: '/repo',
    });
  });
});

describe('getCurrentBranch', () => {
  it('返回当前分支名', () => {
    mockedExecCommand.mockReturnValue('main');
    expect(getCurrentBranch()).toBe('main');
  });
});

describe('getHeadCommitHash', () => {
  it('返回 HEAD commit hash', () => {
    mockedExecCommand.mockReturnValue('abc123def456');
    expect(getHeadCommitHash()).toBe('abc123def456');
  });
});

describe('gitDiffBinaryAgainstBranch', () => {
  it('调用 execSync 执行三点 diff', () => {
    const buffer = Buffer.from('diff');
    mockedExecSync.mockReturnValue(buffer);
    const result = gitDiffBinaryAgainstBranch('feature', '/repo');
    expect(result).toBe(buffer);
    expect(mockedExecSync).toHaveBeenCalledWith('git diff HEAD...feature --binary', expect.objectContaining({
      cwd: '/repo',
    }));
  });
});

describe('gitApplyFromStdin', () => {
  it('调用 execCommandWithInput 不带 --cached', () => {
    const patch = Buffer.from('patch');
    gitApplyFromStdin(patch, '/repo');
    expect(mockedExecCommandWithInput).toHaveBeenCalledWith('git', ['apply'], {
      input: patch,
      cwd: '/repo',
    });
  });
});

describe('gitResetSoft', () => {
  it('默认 reset 1 个 commit', () => {
    gitResetSoft();
    expect(mockedExecCommand).toHaveBeenCalledWith('git reset --soft HEAD~1', { cwd: undefined });
  });

  it('指定 count', () => {
    gitResetSoft(3, '/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git reset --soft HEAD~3', { cwd: '/repo' });
  });
});

describe('gitMergeBase', () => {
  it('返回 merge-base hash', () => {
    mockedExecCommand.mockReturnValue('abc123');
    expect(gitMergeBase('main', 'feature')).toBe('abc123');
  });
});

describe('hasCommitWithMessage', () => {
  it('匹配前缀返回 true', () => {
    mockedExecCommand.mockReturnValue('clawt:auto-save\nother commit');
    expect(hasCommitWithMessage('feature', 'clawt:')).toBe(true);
  });

  it('不匹配前缀返回 false', () => {
    mockedExecCommand.mockReturnValue('normal commit\nother commit');
    expect(hasCommitWithMessage('feature', 'clawt:')).toBe(false);
  });

  it('空输出返回 false', () => {
    mockedExecCommand.mockReturnValue('');
    expect(hasCommitWithMessage('feature', 'clawt:')).toBe(false);
  });

  it('命令失败返回 false', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('fail'); });
    expect(hasCommitWithMessage('feature', 'clawt:')).toBe(false);
  });
});

describe('gitResetSoftTo', () => {
  it('执行 git reset --soft <hash>', () => {
    mockedExecCommand.mockReturnValue('');
    gitResetSoftTo('abc123', '/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git reset --soft abc123', { cwd: '/repo' });
  });
});

describe('gitWriteTree', () => {
  it('返回 tree hash', () => {
    mockedExecCommand.mockReturnValue('tree123');
    expect(gitWriteTree('/repo')).toBe('tree123');
  });
});

describe('gitReadTree', () => {
  it('执行 git read-tree', () => {
    gitReadTree('tree123', '/repo');
    expect(mockedExecCommand).toHaveBeenCalledWith('git read-tree tree123', { cwd: '/repo' });
  });
});

describe('getCommitTreeHash', () => {
  it('返回 commit 对应的 tree hash', () => {
    mockedExecCommand.mockReturnValue('treehash456');
    expect(getCommitTreeHash('commithash123')).toBe('treehash456');
  });
});

describe('gitDiffTree', () => {
  it('调用 execSync 获取 tree diff', () => {
    const buffer = Buffer.from('diff');
    mockedExecSync.mockReturnValue(buffer);
    const result = gitDiffTree('base123', 'target456', '/repo');
    expect(result).toBe(buffer);
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git diff-tree -p --binary base123 target456',
      expect.objectContaining({ cwd: '/repo' }),
    );
  });
});

describe('gitApplyCachedCheck', () => {
  it('patch 可应用时返回 true', () => {
    const patch = Buffer.from('patch');
    mockedExecCommandWithInput.mockReturnValue('');
    expect(gitApplyCachedCheck(patch, '/repo')).toBe(true);
  });

  it('patch 不可应用时返回 false', () => {
    const patch = Buffer.from('bad patch');
    mockedExecCommandWithInput.mockImplementation(() => { throw new Error('conflict'); });
    expect(gitApplyCachedCheck(patch, '/repo')).toBe(false);
  });
});
