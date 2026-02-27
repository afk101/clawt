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
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  validateClaudeCodeInstalled: vi.fn(),
  getProjectWorktrees: vi.fn(),
  launchInteractiveClaude: vi.fn(),
  resolveTargetWorktrees: vi.fn(),
  promptGroupedMultiSelectBranches: vi.fn(),
}));

import { registerResumeCommand } from '../../../src/commands/resume.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
  resolveTargetWorktrees,
  promptGroupedMultiSelectBranches,
} from '../../../src/utils/index.js';

const mockedValidateMainWorktree = vi.mocked(validateMainWorktree);
const mockedValidateClaudeCodeInstalled = vi.mocked(validateClaudeCodeInstalled);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedLaunchInteractiveClaude = vi.mocked(launchInteractiveClaude);
const mockedResolveTargetWorktrees = vi.mocked(resolveTargetWorktrees);
const mockedPromptGroupedMultiSelectBranches = vi.mocked(promptGroupedMultiSelectBranches);

beforeEach(() => {
  mockedValidateMainWorktree.mockReset();
  mockedValidateClaudeCodeInstalled.mockReset();
  mockedGetProjectWorktrees.mockReset();
  mockedLaunchInteractiveClaude.mockReset();
  mockedResolveTargetWorktrees.mockReset();
  mockedPromptGroupedMultiSelectBranches.mockReset();
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

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume'], { from: 'user' });

    expect(mockedResolveTargetWorktrees).toHaveBeenCalled();
    expect(mockedPromptGroupedMultiSelectBranches).not.toHaveBeenCalled();
  });
});
