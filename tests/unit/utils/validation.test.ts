import { describe, it, expect, vi } from 'vitest';

// mock shell
vi.mock('../../../src/utils/shell.js', () => ({
  execCommand: vi.fn(),
}));

// mock git（validateMainWorktree 依赖 getGitCommonDir 和 isInsideGitRepo）
vi.mock('../../../src/utils/git.js', () => ({
  getGitCommonDir: vi.fn(),
  isInsideGitRepo: vi.fn(),
}));

// mock project-config（runPreChecks 依赖 requireProjectConfig 和 guardMainWorkBranchExists）
vi.mock('../../../src/utils/project-config.js', () => ({
  requireProjectConfig: vi.fn(),
  guardMainWorkBranchExists: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { execCommand } from '../../../src/utils/shell.js';
import { getGitCommonDir, isInsideGitRepo } from '../../../src/utils/git.js';
import { validateMainWorktree, validateGitInstalled, validateClaudeCodeInstalled, validateHeadExists, runPreChecks } from '../../../src/utils/validation.js';
import { requireProjectConfig, guardMainWorkBranchExists } from '../../../src/utils/project-config.js';
import { ClawtError } from '../../../src/errors/index.js';

const mockedExecCommand = vi.mocked(execCommand);
const mockedGetGitCommonDir = vi.mocked(getGitCommonDir);
const mockedIsInsideGitRepo = vi.mocked(isInsideGitRepo);
const mockedRequireProjectConfig = vi.mocked(requireProjectConfig);
const mockedGuardMainWorkBranchExists = vi.mocked(guardMainWorkBranchExists);

describe('validateMainWorktree', () => {
  it('在主 worktree 根目录时正常通过', () => {
    mockedIsInsideGitRepo.mockReturnValue(true);
    mockedGetGitCommonDir.mockReturnValue('.git');
    expect(() => validateMainWorktree()).not.toThrow();
  });

  it('在子 worktree 中时抛出 NOT_MAIN_WORKTREE 错误', () => {
    mockedIsInsideGitRepo.mockReturnValue(true);
    mockedGetGitCommonDir.mockReturnValue('/path/to/.git');
    expect(() => validateMainWorktree()).toThrow(ClawtError);
    expect(() => validateMainWorktree()).toThrow('Please run clawt in the root directory of the main worktree');
  });

  it('不在 git 仓库中时抛出 NOT_GIT_REPO 错误', () => {
    mockedIsInsideGitRepo.mockReturnValue(false);
    expect(() => validateMainWorktree()).toThrow(ClawtError);
    expect(() => validateMainWorktree()).toThrow('Current directory is not a git repository');
  });
});

describe('validateGitInstalled', () => {
  it('Git 已安装时正常通过', () => {
    mockedExecCommand.mockReturnValue('git version 2.40.0');
    expect(() => validateGitInstalled()).not.toThrow();
  });

  it('Git 未安装时抛出 ClawtError', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('not found'); });
    expect(() => validateGitInstalled()).toThrow(ClawtError);
  });
});

describe('validateClaudeCodeInstalled', () => {
  it('Claude Code 已安装时正常通过', () => {
    mockedExecCommand.mockReturnValue('claude 1.0.0');
    expect(() => validateClaudeCodeInstalled()).not.toThrow();
  });

  it('Claude Code 未安装时抛出 ClawtError', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('not found'); });
    expect(() => validateClaudeCodeInstalled()).toThrow(ClawtError);
  });
});

describe('validateHeadExists', () => {
  it('HEAD 存在时正常通过', () => {
    mockedExecCommand.mockReturnValue('abc1234');
    expect(() => validateHeadExists()).not.toThrow();
  });

  it('HEAD 不存在时抛出 ClawtError', () => {
    mockedExecCommand.mockImplementation(() => { throw new Error('fatal: ambiguous argument HEAD'); });
    expect(() => validateHeadExists()).toThrow(ClawtError);
  });
});

describe('runPreChecks', () => {
  it('按选项组合调用对应校验', () => {
    mockedIsInsideGitRepo.mockReturnValue(true);
    mockedGetGitCommonDir.mockReturnValue('.git');
    mockedExecCommand.mockReturnValue('abc1234');
    mockedRequireProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'main' });
    mockedGuardMainWorkBranchExists.mockReturnValue(undefined);

    expect(() => runPreChecks({ mainWorktree: true, headExists: true, projectConfig: true, branchExists: true })).not.toThrow();
  });

  it('未设置的选项不触发校验', () => {
    // 不设置任何选项，不应该调用任何校验函数
    mockedGetGitCommonDir.mockImplementation(() => { throw new Error('should not be called'); });
    mockedExecCommand.mockImplementation(() => { throw new Error('should not be called'); });
    mockedRequireProjectConfig.mockImplementation(() => { throw new Error('should not be called'); });
    mockedGuardMainWorkBranchExists.mockImplementation(() => { throw new Error('should not be called'); });

    expect(() => runPreChecks({})).not.toThrow();
  });
});
