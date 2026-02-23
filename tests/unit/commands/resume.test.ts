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
}));

import { registerResumeCommand } from '../../../src/commands/resume.js';
import {
  validateMainWorktree,
  validateClaudeCodeInstalled,
  getProjectWorktrees,
  launchInteractiveClaude,
  resolveTargetWorktrees,
} from '../../../src/utils/index.js';

const mockedValidateMainWorktree = vi.mocked(validateMainWorktree);
const mockedValidateClaudeCodeInstalled = vi.mocked(validateClaudeCodeInstalled);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedLaunchInteractiveClaude = vi.mocked(launchInteractiveClaude);
const mockedResolveTargetWorktrees = vi.mocked(resolveTargetWorktrees);

beforeEach(() => {
  mockedValidateMainWorktree.mockReset();
  mockedValidateClaudeCodeInstalled.mockReset();
  mockedGetProjectWorktrees.mockReset();
  mockedLaunchInteractiveClaude.mockReset();
  mockedResolveTargetWorktrees.mockReset();
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
  it('成功恢复 Claude Code 会话', async () => {
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
    expect(mockedLaunchInteractiveClaude).toHaveBeenCalledWith(worktree, { autoContinue: true });
  });

  it('不传 -b 时也能调用 resolveTargetWorktrees', async () => {
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedGetProjectWorktrees.mockReturnValue([worktree]);
    mockedResolveTargetWorktrees.mockResolvedValue([worktree]);

    const program = new Command();
    program.exitOverride();
    registerResumeCommand(program);
    await program.parseAsync(['resume'], { from: 'user' });

    // branchName 参数为 undefined
    expect(mockedResolveTargetWorktrees).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      undefined,
    );
  });
});
