import { describe, it, expect, vi } from 'vitest';

// mock shell
vi.mock('../../../src/utils/shell.js', () => ({
  execCommand: vi.fn(),
}));

// mock git（validateMainWorktree 依赖 getGitCommonDir）
vi.mock('../../../src/utils/git.js', () => ({
  getGitCommonDir: vi.fn(),
}));

// mock project-config（validate 依赖 requireProjectConfig）
vi.mock('../../../src/utils/project-config.js', () => ({
  requireProjectConfig: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { execCommand } from '../../../src/utils/shell.js';
import { getGitCommonDir } from '../../../src/utils/git.js';
import { validateMainWorktree, validateGitInstalled, validateClaudeCodeInstalled, validateHeadExists, runPreChecks } from '../../../src/utils/validation.js';
import { requireProjectConfig } from '../../../src/utils/project-config.js';
import { ClawtError } from '../../../src/errors/index.js';

const mockedExecCommand = vi.mocked(execCommand);
const mockedGetGitCommonDir = vi.mocked(getGitCommonDir);
const mockedRequireProjectConfig = vi.mocked(requireProjectConfig);

describe('validateMainWorktree', () => {
  it('.git 返回时正常通过', () => {
    mockedGetGitCommonDir.mockReturnValue('.git');
    expect(() => validateMainWorktree()).not.toThrow();
  });

  it('非 .git 时抛出 ClawtError', () => {
    mockedGetGitCommonDir.mockReturnValue('/path/to/.git');
    expect(() => validateMainWorktree()).toThrow(ClawtError);
  });

  it('命令失败时抛出 ClawtError', () => {
    mockedGetGitCommonDir.mockImplementation(() => { throw new Error('not a git repo'); });
    expect(() => validateMainWorktree()).toThrow(ClawtError);
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
    mockedGetGitCommonDir.mockReturnValue('.git');
    mockedExecCommand.mockReturnValue('abc1234');
    mockedRequireProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'main' });

    expect(() => runPreChecks({ mainWorktree: true, headExists: true, projectConfig: true })).not.toThrow();
  });

  it('未设置的选项不触发校验', () => {
    // 不设置任何选项，不应该调用任何校验函数
    mockedGetGitCommonDir.mockImplementation(() => { throw new Error('should not be called'); });
    mockedExecCommand.mockImplementation(() => { throw new Error('should not be called'); });
    mockedRequireProjectConfig.mockImplementation(() => { throw new Error('should not be called'); });

    expect(() => runPreChecks({})).not.toThrow();
  });
});
