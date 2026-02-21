import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    STATUS_TITLE: (name: string) => `项目 ${name} 状态`,
    STATUS_MAIN_SECTION: '主 Worktree',
    STATUS_WORKTREES_SECTION: 'Worktree 列表',
    STATUS_SNAPSHOTS_SECTION: 'Validate 快照',
    STATUS_NO_WORKTREES: '无 worktree',
    STATUS_NO_SNAPSHOTS: '无快照',
    STATUS_CHANGE_COMMITTED: '已提交',
    STATUS_CHANGE_UNCOMMITTED: '未提交',
    STATUS_CHANGE_CONFLICT: '冲突',
    STATUS_CHANGE_CLEAN: '干净',
    STATUS_SNAPSHOT_ORPHANED: '(孤立)',
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  getProjectName: vi.fn(),
  getCurrentBranch: vi.fn(),
  isWorkingDirClean: vi.fn(),
  getProjectWorktrees: vi.fn(),
  getCommitCountAhead: vi.fn(),
  getCommitCountBehind: vi.fn(),
  getDiffStat: vi.fn(),
  hasMergeConflict: vi.fn(),
  hasLocalCommits: vi.fn(),
  hasSnapshot: vi.fn(),
  getProjectSnapshotBranches: vi.fn(),
  printInfo: vi.fn(),
  printDoubleSeparator: vi.fn(),
  printSeparator: vi.fn(),
}));

import { registerStatusCommand } from '../../../src/commands/status.js';
import {
  getProjectName,
  getCurrentBranch,
  isWorkingDirClean,
  getProjectWorktrees,
  getCommitCountAhead,
  getCommitCountBehind,
  getDiffStat,
  hasMergeConflict,
  hasLocalCommits,
  hasSnapshot,
  getProjectSnapshotBranches,
  printInfo,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedGetCommitCountAhead = vi.mocked(getCommitCountAhead);
const mockedGetCommitCountBehind = vi.mocked(getCommitCountBehind);
const mockedGetDiffStat = vi.mocked(getDiffStat);
const mockedHasMergeConflict = vi.mocked(hasMergeConflict);
const mockedHasLocalCommits = vi.mocked(hasLocalCommits);
const mockedHasSnapshot = vi.mocked(hasSnapshot);
const mockedGetProjectSnapshotBranches = vi.mocked(getProjectSnapshotBranches);
const mockedPrintInfo = vi.mocked(printInfo);

beforeEach(() => {
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetCurrentBranch.mockReturnValue('main');
  mockedIsWorkingDirClean.mockReturnValue(true);
  mockedGetProjectWorktrees.mockReturnValue([]);
  mockedGetProjectSnapshotBranches.mockReturnValue([]);
  mockedGetCommitCountAhead.mockReturnValue(0);
  mockedGetCommitCountBehind.mockReturnValue(0);
  mockedGetDiffStat.mockReturnValue({ insertions: 0, deletions: 0 });
  mockedHasMergeConflict.mockReturnValue(false);
  mockedHasLocalCommits.mockReturnValue(false);
  mockedHasSnapshot.mockReturnValue(false);
  mockedPrintInfo.mockReset();
});

describe('registerStatusCommand', () => {
  it('注册 status 命令', () => {
    const program = new Command();
    registerStatusCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'status');
    expect(cmd).toBeDefined();
  });
});

describe('handleStatus', () => {
  it('无 worktree 时文本输出', () => {
    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    program.parse(['status'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('--json 输出完整 JSON 结构', () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetCommitCountAhead.mockReturnValue(2);
    mockedGetDiffStat.mockReturnValue({ insertions: 10, deletions: 5 });
    mockedHasLocalCommits.mockReturnValue(true);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    program.parse(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.main.projectName).toBe('test-project');
    expect(parsed.main.branch).toBe('main');
    expect(parsed.totalWorktrees).toBe(1);
    expect(parsed.worktrees).toHaveLength(1);
    expect(parsed.worktrees[0].branch).toBe('feature');
  });

  it('有 worktree 时收集正确的变更状态', () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    // 模拟冲突状态
    mockedHasMergeConflict.mockReturnValue(true);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    program.parse(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].changeStatus).toBe('conflict');
  });

  it('主 worktree 不干净时 isClean=false', () => {
    mockedIsWorkingDirClean.mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    program.parse(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.main.isClean).toBe(false);
  });

  it('存在快照时标识孤立快照', () => {
    mockedGetProjectSnapshotBranches.mockReturnValue(['feature', 'deleted-branch']);
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    program.parse(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.snapshots).toHaveLength(2);
    expect(parsed.snapshots[0]).toEqual({ branch: 'feature', worktreeExists: true });
    expect(parsed.snapshots[1]).toEqual({ branch: 'deleted-branch', worktreeExists: false });
  });

  it('uncommitted 变更状态正确检测', () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedHasMergeConflict.mockReturnValue(false);
    mockedIsWorkingDirClean
      .mockReturnValueOnce(true)   // 主 worktree
      .mockReturnValueOnce(false); // 目标 worktree 不干净

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    program.parse(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].changeStatus).toBe('uncommitted');
  });
});
