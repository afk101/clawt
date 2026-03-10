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
      RESUME_NO_WORKTREES: '没有可用的 worktree',
      RESUME_SELECT_BRANCH: '选择要恢复的分支',
      RESUME_MULTIPLE_MATCHES: (keyword: string) => `找到多个匹配 "${keyword}" 的分支`,
      RESUME_NO_MATCH: (keyword: string, branches: string[]) => `未找到匹配 "${keyword}" 的分支`,
      RESUME_ALL_CONFIRM: (count: number) => `确认恢复 ${count} 个分支？`,
      RESUME_ALL_SUCCESS: (count: number) => `已恢复 ${count} 个分支`,
      RESUME_PROMPT_REQUIRES_BRANCH: '--prompt 必须配合 -b 指定目标分支',
      RESUME_PROMPT_FILE_CONFLICT: '--prompt 和 -f 不能同时使用',
      RESUME_WORKTREE_NOT_FOUND: (branch: string, available: string[]) => `未找到分支 "${branch}" 对应的 worktree`,
      RESUME_FOLLOW_UP_FILE_LOADED: (count: number, path: string) => `从 ${path} 加载了 ${count} 个追问任务`,
      CONCURRENCY_INFO: (concurrency: number, total: number) => `并发限制: ${concurrency}，共 ${total} 个任务`,
    },
  };
});

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  validateClaudeCodeInstalled: vi.fn(),
  getProjectWorktrees: vi.fn(),
  launchInteractiveClaude: vi.fn(),
  launchInteractiveClaudeInNewTerminal: vi.fn(),
  hasClaudeSessionHistory: vi.fn(),
  resolveTargetWorktrees: vi.fn(),
  promptGroupedMultiSelectBranches: vi.fn(),
  findExactMatch: vi.fn(),
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
  confirmAction: vi.fn(),
  getConfigValue: vi.fn(),
  parseConcurrency: vi.fn().mockReturnValue(0),
  loadTaskFile: vi.fn(),
  executeBatchTasks: vi.fn().mockResolvedValue([]),
}));

import { registerResumeCommand } from '../../../src/commands/resume.js';
import {
  runPreChecks,
  getProjectWorktrees,
  launchInteractiveClaude,
  launchInteractiveClaudeInNewTerminal,
  hasClaudeSessionHistory,
  resolveTargetWorktrees,
  promptGroupedMultiSelectBranches,
  findExactMatch,
  confirmAction,
  getConfigValue,
  parseConcurrency,
  loadTaskFile,
  executeBatchTasks,
} from '../../../src/utils/index.js';

const mockedRunPreChecks = vi.mocked(runPreChecks);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedLaunchInteractiveClaude = vi.mocked(launchInteractiveClaude);
const mockedLaunchInteractiveClaudeInNewTerminal = vi.mocked(launchInteractiveClaudeInNewTerminal);
const mockedHasClaudeSessionHistory = vi.mocked(hasClaudeSessionHistory);
const mockedResolveTargetWorktrees = vi.mocked(resolveTargetWorktrees);
const mockedPromptGroupedMultiSelectBranches = vi.mocked(promptGroupedMultiSelectBranches);
const mockedFindExactMatch = vi.mocked(findExactMatch);
const mockedConfirmAction = vi.mocked(confirmAction);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedParseConcurrency = vi.mocked(parseConcurrency);
const mockedLoadTaskFile = vi.mocked(loadTaskFile);
const mockedExecuteBatchTasks = vi.mocked(executeBatchTasks);

beforeEach(() => {
  mockedRunPreChecks.mockReset();
  mockedGetProjectWorktrees.mockReset();
  mockedLaunchInteractiveClaude.mockReset();
  mockedLaunchInteractiveClaudeInNewTerminal.mockReset();
  mockedHasClaudeSessionHistory.mockReset();
  mockedResolveTargetWorktrees.mockReset();
  mockedPromptGroupedMultiSelectBranches.mockReset();
  mockedFindExactMatch.mockReset();
  mockedConfirmAction.mockReset();
  mockedGetConfigValue.mockReset();
  mockedParseConcurrency.mockReset();
  mockedParseConcurrency.mockReturnValue(0);
  mockedLoadTaskFile.mockReset();
  mockedExecuteBatchTasks.mockReset();
  mockedExecuteBatchTasks.mockResolvedValue([]);
});

describe('registerResumeCommand', () => {
  it('注册 resume 命令', () => {
    const program = new Command();
    registerResumeCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'resume');
    expect(cmd).toBeDefined();
  });

  it('注册 --prompt、-f、-c 选项', () => {
    const program = new Command();
    registerResumeCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'resume');
    const options = cmd!.options.map((o) => o.long);
    expect(options).toContain('--prompt');
    expect(options).toContain('--file');
    expect(options).toContain('--concurrency');
  });
});

describe('handleResume', () => {
  it('传 -b 时走标准解析流程', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktrees.mockResolvedValue([worktree]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-b', 'feature'], { from: 'user' });

    expect(mockedRunPreChecks).toHaveBeenCalled();
    expect(mockedResolveTargetWorktrees).toHaveBeenCalled();
    expect(mockedPromptGroupedMultiSelectBranches).not.toHaveBeenCalled();
    expect(mockedLaunchInteractiveClaude).toHaveBeenCalledWith(worktree, { autoContinue: true });
  });

  it('不传 -b 且多个 worktree 时默认使用分组多选', async () => {
    const worktrees = [
      { path: '/path/feature-a', branch: 'feature-a' },
      { path: '/path/feature-b', branch: 'feature-b' },
    ];
    mockedGetProjectWorktrees.mockReturnValue(worktrees);
    mockedPromptGroupedMultiSelectBranches.mockResolvedValue([worktrees[0]]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume'], { from: 'user' });

    expect(mockedPromptGroupedMultiSelectBranches).toHaveBeenCalledWith(
      worktrees,
      expect.any(String),
    );
    expect(mockedResolveTargetWorktrees).not.toHaveBeenCalled();
  });

  it('仅 1 个 worktree 时走标准流程', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktrees.mockResolvedValue([worktree]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume'], { from: 'user' });

    expect(mockedResolveTargetWorktrees).toHaveBeenCalled();
    expect(mockedPromptGroupedMultiSelectBranches).not.toHaveBeenCalled();
  });
});

describe('handleResume — resumeInPlace 配置', () => {
  it('resumeInPlace 为 true 时，单选在当前终端就地恢复', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktrees.mockResolvedValue([worktree]);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-b', 'feature'], { from: 'user' });

    expect(mockedGetConfigValue).toHaveBeenCalledWith('resumeInPlace');
    expect(mockedLaunchInteractiveClaude).toHaveBeenCalledWith(worktree, { autoContinue: true });
    expect(mockedLaunchInteractiveClaudeInNewTerminal).not.toHaveBeenCalled();
  });

  it('resumeInPlace 为 false 时，单选在新终端 Tab 中恢复', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktrees.mockResolvedValue([worktree]);
    mockedGetConfigValue.mockReturnValue(false);
    mockedHasClaudeSessionHistory.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-b', 'feature'], { from: 'user' });

    expect(mockedGetConfigValue).toHaveBeenCalledWith('resumeInPlace');
    expect(mockedHasClaudeSessionHistory).toHaveBeenCalledWith(worktree.path);
    expect(mockedLaunchInteractiveClaudeInNewTerminal).toHaveBeenCalledWith(worktree, true);
    expect(mockedLaunchInteractiveClaude).not.toHaveBeenCalled();
  });

  it('resumeInPlace 为 false 且无历史会话时，传 false 给新终端启动', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktrees.mockResolvedValue([worktree]);
    mockedGetConfigValue.mockReturnValue(false);
    mockedHasClaudeSessionHistory.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-b', 'feature'], { from: 'user' });

    expect(mockedLaunchInteractiveClaudeInNewTerminal).toHaveBeenCalledWith(worktree, false);
  });

  it('多选时不受 resumeInPlace 影响，始终在新 Tab 中打开', async () => {
    const worktrees = [
      { path: '/path/feature-a', branch: 'feature-a' },
      { path: '/path/feature-b', branch: 'feature-b' },
    ];
    mockedGetProjectWorktrees.mockReturnValue(worktrees);
    mockedPromptGroupedMultiSelectBranches.mockResolvedValue(worktrees);
    mockedConfirmAction.mockResolvedValue(true);
    mockedHasClaudeSessionHistory.mockReturnValue(false);
    mockedGetConfigValue.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume'], { from: 'user' });

    // 多选走 handleBatchResume，不读取 resumeInPlace
    expect(mockedLaunchInteractiveClaude).not.toHaveBeenCalled();
    expect(mockedLaunchInteractiveClaudeInNewTerminal).toHaveBeenCalledTimes(2);
  });

  it('用户未选择任何分支时直接退出', async () => {
    const worktrees = [
      { path: '/path/feature-a', branch: 'feature-a' },
      { path: '/path/feature-b', branch: 'feature-b' },
    ];
    mockedGetProjectWorktrees.mockReturnValue(worktrees);
    mockedPromptGroupedMultiSelectBranches.mockResolvedValue([]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume'], { from: 'user' });

    expect(mockedLaunchInteractiveClaude).not.toHaveBeenCalled();
    expect(mockedLaunchInteractiveClaudeInNewTerminal).not.toHaveBeenCalled();
    expect(mockedGetConfigValue).not.toHaveBeenCalled();
  });
});

describe('handleResume — 非交互式追问', () => {
  it('--prompt + -b 有历史会话时传 [true]', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedFindExactMatch.mockReturnValue(worktree);
    mockedHasClaudeSessionHistory.mockReturnValue(true);
    mockedExecuteBatchTasks.mockResolvedValue([]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-b', 'feature', '--prompt', '加上单元测试'], { from: 'user' });

    expect(mockedFindExactMatch).toHaveBeenCalled();
    expect(mockedHasClaudeSessionHistory).toHaveBeenCalledWith(worktree.path);
    // 有历史会话时使用 --continue 模式
    expect(mockedExecuteBatchTasks).toHaveBeenCalledWith(
      [worktree],
      ['加上单元测试'],
      0,
      [true],
    );
    // 不应走交互式流程
    expect(mockedResolveTargetWorktrees).not.toHaveBeenCalled();
    expect(mockedLaunchInteractiveClaude).not.toHaveBeenCalled();
  });

  it('--prompt + -b 无历史会话时传 [false]', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedFindExactMatch.mockReturnValue(worktree);
    mockedHasClaudeSessionHistory.mockReturnValue(false);
    mockedExecuteBatchTasks.mockResolvedValue([]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-b', 'feature', '--prompt', '加上单元测试'], { from: 'user' });

    expect(mockedHasClaudeSessionHistory).toHaveBeenCalledWith(worktree.path);
    // 无历史会话时不传 --continue
    expect(mockedExecuteBatchTasks).toHaveBeenCalledWith(
      [worktree],
      ['加上单元测试'],
      0,
      [false],
    );
  });

  it('--prompt 无 -b 时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);

    await expect(
      program.parseAsync(['resume', '--prompt', '加上单元测试'], { from: 'user' }),
    ).rejects.toThrow('--prompt 必须配合 -b 指定目标分支');
  });

  it('--prompt 和 -f 同时使用时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);

    await expect(
      program.parseAsync(['resume', '-b', 'feature', '--prompt', '追问', '-f', 'tasks.md'], { from: 'user' }),
    ).rejects.toThrow('--prompt 和 -f 不能同时使用');
  });

  it('--prompt 指定的分支不存在时报错', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/other', branch: 'other' },
    ]);
    mockedFindExactMatch.mockReturnValue(undefined);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);

    await expect(
      program.parseAsync(['resume', '-b', 'nonexistent', '--prompt', '追问'], { from: 'user' }),
    ).rejects.toThrow('未找到分支');
  });

  it('-f 批量追问模式', async () => {
    const worktrees = [
      { path: '/path/feat-a', branch: 'feat-a' },
      { path: '/path/feat-b', branch: 'feat-b' },
    ];
    mockedLoadTaskFile.mockReturnValue([
      { branch: 'feat-a', task: '追问任务A' },
      { branch: 'feat-b', task: '追问任务B' },
    ]);
    mockedGetProjectWorktrees.mockReturnValue(worktrees);
    mockedFindExactMatch
      .mockReturnValueOnce(worktrees[0])
      .mockReturnValueOnce(worktrees[1]);
    mockedHasClaudeSessionHistory.mockReturnValue(true);
    mockedExecuteBatchTasks.mockResolvedValue([]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-f', 'follow-up.md'], { from: 'user' });

    expect(mockedLoadTaskFile).toHaveBeenCalledWith('follow-up.md', { branchRequired: true });
    // 按 worktree 独立检查会话历史
    expect(mockedHasClaudeSessionHistory).toHaveBeenCalledWith('/path/feat-a');
    expect(mockedHasClaudeSessionHistory).toHaveBeenCalledWith('/path/feat-b');
    expect(mockedExecuteBatchTasks).toHaveBeenCalledWith(
      worktrees,
      ['追问任务A', '追问任务B'],
      0,
      [true, true],
    );
  });

  it('-f 批量追问分支不存在时报错', async () => {
    mockedLoadTaskFile.mockReturnValue([
      { branch: 'nonexistent', task: '追问任务' },
    ]);
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feat-a', branch: 'feat-a' },
    ]);
    mockedFindExactMatch.mockReturnValue(undefined);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);

    await expect(
      program.parseAsync(['resume', '-f', 'follow-up.md'], { from: 'user' }),
    ).rejects.toThrow('未找到分支');
  });

  it('-f + -c 传递并发数', async () => {
    const worktree = { path: '/path/feat-a', branch: 'feat-a' };
    mockedLoadTaskFile.mockReturnValue([
      { branch: 'feat-a', task: '追问' },
    ]);
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedFindExactMatch.mockReturnValue(worktree);
    mockedHasClaudeSessionHistory.mockReturnValue(true);
    mockedParseConcurrency.mockReturnValue(2);
    mockedExecuteBatchTasks.mockResolvedValue([]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-f', 'follow-up.md', '-c', '2'], { from: 'user' });

    expect(mockedExecuteBatchTasks).toHaveBeenCalledWith(
      [worktree],
      ['追问'],
      2,
      [true],
    );
  });

  it('-f 批量追问按 worktree 独立检查会话历史', async () => {
    const worktrees = [
      { path: '/path/feat-a', branch: 'feat-a' },
      { path: '/path/feat-b', branch: 'feat-b' },
      { path: '/path/feat-c', branch: 'feat-c' },
    ];
    mockedLoadTaskFile.mockReturnValue([
      { branch: 'feat-a', task: '任务A' },
      { branch: 'feat-b', task: '任务B' },
      { branch: 'feat-c', task: '任务C' },
    ]);
    mockedGetProjectWorktrees.mockReturnValue(worktrees);
    mockedFindExactMatch
      .mockReturnValueOnce(worktrees[0])
      .mockReturnValueOnce(worktrees[1])
      .mockReturnValueOnce(worktrees[2]);
    // feat-a 有历史会话，feat-b 无，feat-c 有
    mockedHasClaudeSessionHistory
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    mockedExecuteBatchTasks.mockResolvedValue([]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume', '-f', 'follow-up.md'], { from: 'user' });

    // continueFlags 应按 worktree 独立反映各自的会话历史状态
    expect(mockedExecuteBatchTasks).toHaveBeenCalledWith(
      worktrees,
      ['任务A', '任务B', '任务C'],
      0,
      [true, false, true],
    );
  });
});
