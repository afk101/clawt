import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    RESUME_NO_WORKTREES: '没有可用的 worktree',
    RESUME_SELECT_BRANCH: '选择要恢复的分支',
    RESUME_MULTIPLE_MATCHES: (keyword: string) => `找到多个匹配 "${keyword}" 的分支`,
    RESUME_NO_MATCH: (keyword: string, branches: string[]) => `未找到匹配 "${keyword}" 的分支`,
    RESUME_ALL_CONFIRM: (count: number) => `确认恢复 ${count} 个分支？`,
    RESUME_ALL_SUCCESS: (count: number) => `已恢复 ${count} 个分支`,
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  validateClaudeCodeInstalled: vi.fn(),
  getProjectWorktrees: vi.fn(),
  launchInteractiveClaude: vi.fn(),
  launchInteractiveClaudeInNewTerminal: vi.fn(),
  hasClaudeSessionHistory: vi.fn(),
  resolveTargetWorktrees: vi.fn(),
  promptGroupedMultiSelectBranches: vi.fn(),
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  confirmAction: vi.fn(),
  getConfigValue: vi.fn(),
}));

import { registerResumeCommand } from '../../../src/commands/resume.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
  launchInteractiveClaudeInNewTerminal,
  hasClaudeSessionHistory,
  resolveTargetWorktrees,
  promptGroupedMultiSelectBranches,
  confirmAction,
  getConfigValue,
} from '../../../src/utils/index.js';

const mockedValidateMainWorktree = vi.mocked(validateMainWorktree);
const mockedValidateClaudeCodeInstalled = vi.mocked(validateClaudeCodeInstalled);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedLaunchInteractiveClaude = vi.mocked(launchInteractiveClaude);
const mockedLaunchInteractiveClaudeInNewTerminal = vi.mocked(launchInteractiveClaudeInNewTerminal);
const mockedHasClaudeSessionHistory = vi.mocked(hasClaudeSessionHistory);
const mockedResolveTargetWorktrees = vi.mocked(resolveTargetWorktrees);
const mockedPromptGroupedMultiSelectBranches = vi.mocked(promptGroupedMultiSelectBranches);
const mockedConfirmAction = vi.mocked(confirmAction);
const mockedGetConfigValue = vi.mocked(getConfigValue);

beforeEach(() => {
  mockedValidateMainWorktree.mockReset();
  mockedValidateClaudeCodeInstalled.mockReset();
  mockedGetProjectWorktrees.mockReset();
  mockedLaunchInteractiveClaude.mockReset();
  mockedLaunchInteractiveClaudeInNewTerminal.mockReset();
  mockedHasClaudeSessionHistory.mockReset();
  mockedResolveTargetWorktrees.mockReset();
  mockedPromptGroupedMultiSelectBranches.mockReset();
  mockedConfirmAction.mockReset();
  mockedGetConfigValue.mockReset();
});

describe('registerResumeCommand', () => {
  it('注册 resume 命令', () => {
    const program = new Command();
    registerResumeCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'resume');
    expect(cmd).toBeDefined();
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

    expect(mockedValidateMainWorktree).toHaveBeenCalled();
    expect(mockedValidateClaudeCodeInstalled).toHaveBeenCalled();
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
