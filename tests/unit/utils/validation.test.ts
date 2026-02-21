import { describe, it, expect, vi } from 'vitest';

// mock shell
vi.mock('../../../src/utils/shell.js', () => ({
  execCommand: vi.fn(),
}));

// mock git（validateMainWorktree 依赖 getGitCommonDir）
vi.mock('../../../src/utils/git.js', () => ({
  getGitCommonDir: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { execCommand } from '../../../src/utils/shell.js';
import { getGitCommonDir } from '../../../src/utils/git.js';
import { validateMainWorktree, validateGitInstalled, validateClaudeCodeInstalled } from '../../../src/utils/validation.js';
import { ClawtError } from '../../../src/errors/index.js';

const mockedExecCommand = vi.mocked(execCommand);
const mockedGetGitCommonDir = vi.mocked(getGitCommonDir);

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
