import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...actual,
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
      STATUS_SNAPSHOT_ORPHANED: (count: number) => `其中 ${count} 个快照对应的 worktree 已不存在`,
      STATUS_CREATED_AT: (relativeTime: string) => `创建于 ${relativeTime}`,
      STATUS_NO_DIVERGED_COMMITS: '尚无分叉提交',
      STATUS_LAST_VALIDATED: (relativeTime: string) => `上次验证: ${relativeTime}`,
      STATUS_NOT_VALIDATED: '✗ 未验证',
      STATUS_CONFIGURED_BRANCH: (branchName: string) => `主工作分支: ${branchName}`,
      STATUS_CONFIGURED_BRANCH_DELETED: (branchName: string) => `✗ 主工作分支: ${branchName}（已不存在）`,
      STATUS_CONFIGURED_BRANCH_MISMATCH: (branchName: string) => `⚠ 主工作分支: ${branchName}（当前分支不一致）`,
      // 新增：来源分支展示消息
      STATUS_SOURCE_BRANCH: (branchName: string) => `来自 ${branchName}`,
    },
    VALIDATE_BRANCH_PREFIX: 'clawt-validate-',
  };
});

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  getProjectName: vi.fn(),
  getCurrentBranch: vi.fn(),
  isWorkingDirClean: vi.fn(),
  getProjectWorktrees: vi.fn(),
  getCommitDivergenceAsync: vi.fn(),
  getDiffStat: vi.fn(),
  getDiffStatAsync: vi.fn(),
  getStatusPorcelainAsync: vi.fn(),
  getSnapshotModifiedTime: vi.fn(),
  getProjectSnapshotBranches: vi.fn(),
  getWorktreeCreatedTime: vi.fn(),
  formatRelativeTime: vi.fn(),
  printInfo: vi.fn(),
  printDoubleSeparator: vi.fn(),
  printSeparator: vi.fn(),
  loadProjectConfig: vi.fn().mockReturnValue(null),
  checkBranchExists: vi.fn().mockReturnValue(true),
  // 新增：读取 worktree 来源分支，默认返回 null（无来源分支）
  readWorktreeSourceBranch: vi.fn().mockReturnValue(null),
  // 新增：JSON 序列化工具，支持可选的缩进参数
  safeStringify: vi.fn().mockImplementation((value: unknown, indent?: number) => JSON.stringify(value, null, indent ?? 2)),
  // 新增：交互式面板组件（status.ts 从 utils 导入）
  InteractivePanel: vi.fn(),
}));

import { registerStatusCommand } from '../../../src/commands/status.js';
import {
  getProjectName,
  getCurrentBranch,
  isWorkingDirClean,
  getProjectWorktrees,
  getCommitDivergenceAsync,
  getDiffStat,
  getDiffStatAsync,
  getStatusPorcelainAsync,
  getSnapshotModifiedTime,
  getProjectSnapshotBranches,
  getWorktreeCreatedTime,
  formatRelativeTime,
  printInfo,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedGetCommitDivergenceAsync = vi.mocked(getCommitDivergenceAsync);
const mockedGetDiffStat = vi.mocked(getDiffStat);
const mockedGetDiffStatAsync = vi.mocked(getDiffStatAsync);
const mockedGetStatusPorcelainAsync = vi.mocked(getStatusPorcelainAsync);
const mockedGetSnapshotModifiedTime = vi.mocked(getSnapshotModifiedTime);
const mockedGetProjectSnapshotBranches = vi.mocked(getProjectSnapshotBranches);
const mockedGetWorktreeCreatedTime = vi.mocked(getWorktreeCreatedTime);
const mockedFormatRelativeTime = vi.mocked(formatRelativeTime);
const mockedPrintInfo = vi.mocked(printInfo);

beforeEach(() => {
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetCurrentBranch.mockReturnValue('main');
  mockedIsWorkingDirClean.mockReturnValue(true);
  mockedGetProjectWorktrees.mockReturnValue([]);
  mockedGetProjectSnapshotBranches.mockReturnValue([]);
  mockedGetCommitDivergenceAsync.mockResolvedValue({ ahead: 0, behind: 0 });
  mockedGetDiffStat.mockReturnValue({ insertions: 0, deletions: 0 });
  mockedGetDiffStatAsync.mockResolvedValue({ insertions: 0, deletions: 0 });
  mockedGetStatusPorcelainAsync.mockResolvedValue('');
  mockedGetSnapshotModifiedTime.mockReturnValue(null);
  mockedGetWorktreeCreatedTime.mockReturnValue(null);
  mockedFormatRelativeTime.mockReturnValue('3 天前');
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
  it('无 worktree 时文本输出', async () => {
    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('--json 输出完整 JSON 结构', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetCommitDivergenceAsync.mockResolvedValue({ ahead: 2, behind: 0 });
    mockedGetDiffStatAsync.mockResolvedValue({ insertions: 10, deletions: 5 });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

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

  it('有 worktree 时收集正确的变更状态', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    // 模拟冲突状态：porcelain 输出包含 UU 前缀的行
    mockedGetStatusPorcelainAsync.mockResolvedValue('UU src/conflict-file.ts');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].changeStatus).toBe('conflict');
  });

  it('主 worktree 不干净时 isClean=false', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.main.isClean).toBe(false);
  });

  it('快照摘要包含总数和孤立数', async () => {
    mockedGetProjectSnapshotBranches.mockReturnValue(['feature', 'deleted-branch']);
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.snapshots.total).toBe(2);
    expect(parsed.snapshots.orphaned).toBe(1);
  });

  it('uncommitted 变更状态正确检测', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    // 模拟未提交修改：porcelain 输出包含修改但非冲突的行
    mockedGetStatusPorcelainAsync.mockResolvedValue(' M src/file.ts');  // 目标 worktree 有未提交修改

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].changeStatus).toBe('uncommitted');
  });

  it('createdAt 字段包含在 JSON 输出中', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetWorktreeCreatedTime.mockReturnValue('2026-02-20T14:30:00+08:00');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].createdAt).toBe('2026-02-20T14:30:00+08:00');
  });

  it('snapshotTime 字段包含在 JSON 输出中', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetSnapshotModifiedTime.mockReturnValue('2026-02-22T10:00:00.000Z');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].snapshotTime).toBe('2026-02-22T10:00:00.000Z');
  });

  it('文本模式显示分支创建时间', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetWorktreeCreatedTime.mockReturnValue('2026-02-20T14:30:00+08:00');
    mockedFormatRelativeTime.mockReturnValue('2 天前');

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status'], { from: 'user' });

    const printedLines = mockedPrintInfo.mock.calls.map((call) => call[0]);
    const createdAtLine = printedLines.find((line) => line.includes('创建于'));
    expect(createdAtLine).toBeDefined();
  });

  it('文本模式 createdAt 为 null 时不显示创建时间', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetWorktreeCreatedTime.mockReturnValue(null);

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status'], { from: 'user' });

    const printedLines = mockedPrintInfo.mock.calls.map((call) => call[0]);
    const createdAtLine = printedLines.find((line) => line.includes('创建于'));
    expect(createdAtLine).toBeUndefined();
  });

  it('文本模式无快照时显示未验证警示', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetSnapshotModifiedTime.mockReturnValue(null);

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status'], { from: 'user' });

    const printedLines = mockedPrintInfo.mock.calls.map((call) => call[0]);
    const unverifiedLine = printedLines.find((line) => line.includes('未验证'));
    expect(unverifiedLine).toBeDefined();
  });

  it('文本模式有快照时显示上次验证时间', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetSnapshotModifiedTime.mockReturnValue('2026-02-22T10:00:00.000Z');
    mockedFormatRelativeTime.mockReturnValue('5 小时前');

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status'], { from: 'user' });

    const printedLines = mockedPrintInfo.mock.calls.map((call) => call[0]);
    const validatedLine = printedLines.find((line) => line.includes('上次验证'));
    expect(validatedLine).toBeDefined();
    const unverifiedLine = printedLines.find((line) => line.includes('未验证'));
    expect(unverifiedLine).toBeUndefined();
  });

  it('主 worktree diff 统计包含在 JSON 输出中', async () => {
    // 模拟主 worktree 有变更
    mockedGetDiffStat.mockReturnValue({ insertions: 185, deletions: 42 });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.main.insertions).toBe(185);
    expect(parsed.main.deletions).toBe(42);
  });

  it('主 worktree 无变更时 diff 统计为 0', async () => {
    mockedGetDiffStat.mockReturnValue({ insertions: 0, deletions: 0 });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.main.insertions).toBe(0);
    expect(parsed.main.deletions).toBe(0);
  });

  it('sourceBranch 字段包含在 JSON 输出中', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    // mock readWorktreeSourceBranch 返回 'develop'
    const { readWorktreeSourceBranch } = await import('../../../src/utils/index.js');
    vi.mocked(readWorktreeSourceBranch).mockReturnValue('develop');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    if (jsonCall) {
      const parsed = JSON.parse(jsonCall[0]);
      expect(parsed.worktrees[0].sourceBranch).toBe('develop');
    }
  });
});
