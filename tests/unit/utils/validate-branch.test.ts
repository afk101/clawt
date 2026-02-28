import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock errors
vi.mock('../../../src/errors/index.js', () => ({
  ClawtError: class ClawtError extends Error {
    exitCode: number;
    constructor(message: string, exitCode = 1) {
      super(message);
      this.exitCode = exitCode;
    }
  },
}));

// mock constants
vi.mock('../../../src/constants/index.js', () => ({
  VALIDATE_BRANCH_PREFIX: 'clawt-validate-',
}));

// mock enquirer（必须在所有 import 之前）
const { mockSelectRun } = vi.hoisted(() => {
  const mockSelectRun = vi.fn();
  return { mockSelectRun };
});

vi.mock('enquirer', () => ({
  default: {
    Select: function MockSelect() { return { run: mockSelectRun }; },
  },
}));

// mock git
vi.mock('../../../src/utils/git.js', () => ({
  checkBranchExists: vi.fn(),
  createBranch: vi.fn(),
  deleteBranch: vi.fn(),
  getCurrentBranch: vi.fn(),
  gitCheckout: vi.fn(),
  gitResetHard: vi.fn(),
  gitCleanForce: vi.fn(),
  isWorkingDirClean: vi.fn().mockReturnValue(true),
  gitAddAll: vi.fn(),
  gitStashPush: vi.fn(),
}));

// mock project-config
vi.mock('../../../src/utils/project-config.js', () => ({
  getMainWorkBranch: vi.fn().mockReturnValue('main'),
}));

// mock formatter
vi.mock('../../../src/utils/formatter.js', () => ({
  printWarning: vi.fn(),
  confirmAction: vi.fn(),
}));

import {
  checkBranchExists,
  createBranch,
  deleteBranch,
  getCurrentBranch,
  gitCheckout,
  gitResetHard,
  gitCleanForce,
  isWorkingDirClean,
  gitAddAll,
  gitStashPush,
} from '../../../src/utils/git.js';
import {
  getValidateBranchName,
  createValidateBranch,
  deleteValidateBranch,
  rebuildValidateBranch,
  switchBackIfOnValidateBranch,
  ensureOnMainWorkBranch,
  handleDirtyWorkingDir,
} from '../../../src/utils/validate-branch.js';
import { confirmAction } from '../../../src/utils/formatter.js';

const mockedCheckBranchExists = vi.mocked(checkBranchExists);
const mockedCreateBranch = vi.mocked(createBranch);
const mockedDeleteBranch = vi.mocked(deleteBranch);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockedGitCheckout = vi.mocked(gitCheckout);
const mockedGitResetHard = vi.mocked(gitResetHard);
const mockedGitCleanForce = vi.mocked(gitCleanForce);
const mockedConfirmAction = vi.mocked(confirmAction);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGitAddAll = vi.mocked(gitAddAll);
const mockedGitStashPush = vi.mocked(gitStashPush);

beforeEach(() => {
  mockedCheckBranchExists.mockReset();
  mockedCreateBranch.mockReset();
  mockedDeleteBranch.mockReset();
  mockedGetCurrentBranch.mockReset();
  mockedGitCheckout.mockReset();
  mockedGitResetHard.mockReset();
  mockedGitCleanForce.mockReset();
  mockedConfirmAction.mockReset();
  mockedIsWorkingDirClean.mockReset().mockReturnValue(true);
  mockedGitAddAll.mockReset();
  mockedGitStashPush.mockReset();
  mockSelectRun.mockReset();
});

describe('getValidateBranchName', () => {
  it('生成正确的验证分支名', () => {
    expect(getValidateBranchName('feature')).toBe('clawt-validate-feature');
  });

  it('处理含连字符的分支名', () => {
    expect(getValidateBranchName('my-feature-1')).toBe('clawt-validate-my-feature-1');
  });
});

describe('createValidateBranch', () => {
  it('分支不存在时创建', () => {
    mockedCheckBranchExists.mockReturnValue(false);
    createValidateBranch('feature');
    expect(mockedCreateBranch).toHaveBeenCalledWith('clawt-validate-feature', undefined);
  });

  it('分支已存在时跳过', () => {
    mockedCheckBranchExists.mockReturnValue(true);
    createValidateBranch('feature');
    expect(mockedCreateBranch).not.toHaveBeenCalled();
  });
});

describe('deleteValidateBranch', () => {
  it('分支存在时删除', () => {
    mockedCheckBranchExists.mockReturnValue(true);
    deleteValidateBranch('feature');
    expect(mockedDeleteBranch).toHaveBeenCalledWith('clawt-validate-feature', undefined);
  });

  it('分支不存在时跳过', () => {
    mockedCheckBranchExists.mockReturnValue(false);
    deleteValidateBranch('feature');
    expect(mockedDeleteBranch).not.toHaveBeenCalled();
  });
});

describe('rebuildValidateBranch', () => {
  it('重建时先删除再创建', async () => {
    mockedGetCurrentBranch.mockReturnValue('main');
    // 第一次调用 (deleteValidateBranch) 检查存在 → 删除
    // 第二次调用 (createValidateBranch) 检查不存在 → 创建
    mockedCheckBranchExists
      .mockReturnValueOnce(true)   // deleteValidateBranch 检查
      .mockReturnValueOnce(false); // createValidateBranch 检查
    await rebuildValidateBranch('feature');
    expect(mockedDeleteBranch).toHaveBeenCalled();
    expect(mockedCreateBranch).toHaveBeenCalled();
  });

  it('当前在验证分支上时先执行 reset+clean 再切回', async () => {
    // 第一次 getCurrentBranch（rebuildValidateBranch 内部检测）返回验证分支
    // 第二次 getCurrentBranch（switchBackIfOnValidateBranch 内部）返回验证分支
    mockedGetCurrentBranch.mockReturnValue('clawt-validate-feature');
    mockedCheckBranchExists
      .mockReturnValueOnce(true)   // deleteValidateBranch 检查
      .mockReturnValueOnce(false); // createValidateBranch 检查
    await rebuildValidateBranch('feature');
    expect(mockedGitResetHard).toHaveBeenCalledWith(undefined);
    expect(mockedGitCleanForce).toHaveBeenCalledWith(undefined);
    expect(mockedGitCheckout).toHaveBeenCalledWith('main', undefined);
  });

  it('当前不在验证分支上时不执行 reset+clean', async () => {
    mockedGetCurrentBranch.mockReturnValue('main');
    mockedCheckBranchExists
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    await rebuildValidateBranch('feature');
    expect(mockedGitResetHard).not.toHaveBeenCalled();
    expect(mockedGitCleanForce).not.toHaveBeenCalled();
  });
});

describe('handleDirtyWorkingDir', () => {
  it('用户选择 reset 时执行 gitResetHard 和 gitCleanForce', async () => {
    mockSelectRun.mockResolvedValue('reset');
    // 第一次调用（handleDirtyWorkingDir 末尾检查）返回干净
    mockedIsWorkingDirClean.mockReturnValue(true);
    await handleDirtyWorkingDir();
    expect(mockedGitResetHard).toHaveBeenCalledWith(undefined);
    expect(mockedGitCleanForce).toHaveBeenCalledWith(undefined);
  });

  it('用户选择 stash 时执行 gitAddAll 和 gitStashPush', async () => {
    mockSelectRun.mockResolvedValue('stash');
    mockedIsWorkingDirClean.mockReturnValue(true);
    await handleDirtyWorkingDir();
    expect(mockedGitAddAll).toHaveBeenCalledWith(undefined);
    expect(mockedGitStashPush).toHaveBeenCalledWith('clawt:auto-stash', undefined);
  });

  it('用户选择 exit 时抛出错误', async () => {
    mockSelectRun.mockResolvedValue('exit');
    await expect(handleDirtyWorkingDir()).rejects.toThrow('用户选择退出');
  });

  it('处理后工作区仍不干净时抛出错误', async () => {
    mockSelectRun.mockResolvedValue('reset');
    mockedIsWorkingDirClean.mockReturnValue(false);
    await expect(handleDirtyWorkingDir()).rejects.toThrow('工作区仍然不干净');
  });

  it('传入 cwd 参数时透传给 git 操作', async () => {
    mockSelectRun.mockResolvedValue('reset');
    mockedIsWorkingDirClean.mockReturnValue(true);
    await handleDirtyWorkingDir('/some/path');
    expect(mockedGitResetHard).toHaveBeenCalledWith('/some/path');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/some/path');
  });
});

describe('ensureOnMainWorkBranch', () => {
  it('当前在主工作分支上时直接返回', async () => {
    mockedGetCurrentBranch.mockReturnValue('main');
    await ensureOnMainWorkBranch('main', true);
    expect(mockedGitCheckout).not.toHaveBeenCalled();
  });

  it('当前在验证分支上且工作区干净时自动切回主工作分支', async () => {
    mockedGetCurrentBranch.mockReturnValue('clawt-validate-feature');
    mockedIsWorkingDirClean.mockReturnValue(true);
    await ensureOnMainWorkBranch('main', true);
    expect(mockedGitCheckout).toHaveBeenCalledWith('main');
    // 工作区干净时不应调用 resetHard/cleanForce
    expect(mockedGitResetHard).not.toHaveBeenCalled();
    expect(mockedGitCleanForce).not.toHaveBeenCalled();
  });

  it('当前在验证分支上且工作区脏时先清理再切回', async () => {
    mockedGetCurrentBranch.mockReturnValue('clawt-validate-feature');
    mockedIsWorkingDirClean.mockReturnValue(false);
    await ensureOnMainWorkBranch('main', true);
    // 验证分支上的修改直接丢弃
    expect(mockedGitResetHard).toHaveBeenCalled();
    expect(mockedGitCleanForce).toHaveBeenCalled();
    expect(mockedGitCheckout).toHaveBeenCalledWith('main');
  });

  it('warnOnCreate=false 且工作区干净时直接切换到主工作分支', async () => {
    mockedGetCurrentBranch.mockReturnValue('feature');
    mockedIsWorkingDirClean.mockReturnValue(true);
    await ensureOnMainWorkBranch('main', false);
    expect(mockedGitCheckout).toHaveBeenCalledWith('main');
  });

  it('warnOnCreate=false 且工作区脏时先处理再切换', async () => {
    mockedGetCurrentBranch.mockReturnValue('feature');
    // 第一次调用（ensureOnMainWorkBranch 检测）返回脏
    // 第二次调用（handleDirtyWorkingDir 末尾检查）返回干净
    mockedIsWorkingDirClean.mockReturnValueOnce(false).mockReturnValueOnce(true);
    mockSelectRun.mockResolvedValue('reset');
    await ensureOnMainWorkBranch('main', false);
    expect(mockedGitResetHard).toHaveBeenCalled();
    expect(mockedGitCleanForce).toHaveBeenCalled();
    expect(mockedGitCheckout).toHaveBeenCalledWith('main');
  });

  it('warnOnCreate=true 且用户确认后切换到主工作分支', async () => {
    mockedGetCurrentBranch.mockReturnValue('feature');
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(true);
    await ensureOnMainWorkBranch('main', true);
    expect(mockedGitCheckout).toHaveBeenCalledWith('main');
  });

  it('warnOnCreate=true 且用户确认后工作区脏时先处理再切换', async () => {
    mockedGetCurrentBranch.mockReturnValue('feature');
    mockedConfirmAction.mockResolvedValue(true);
    // 第一次调用（ensureOnMainWorkBranch 检测）返回脏
    // 第二次调用（handleDirtyWorkingDir 末尾检查）返回干净
    mockedIsWorkingDirClean.mockReturnValueOnce(false).mockReturnValueOnce(true);
    mockSelectRun.mockResolvedValue('stash');
    await ensureOnMainWorkBranch('main', true);
    expect(mockedGitAddAll).toHaveBeenCalled();
    expect(mockedGitStashPush).toHaveBeenCalledWith('clawt:auto-stash', undefined);
    expect(mockedGitCheckout).toHaveBeenCalledWith('main');
  });

  it('warnOnCreate=true 且用户拒绝时抛出错误', async () => {
    mockedGetCurrentBranch.mockReturnValue('feature');
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedConfirmAction.mockResolvedValue(false);
    await expect(ensureOnMainWorkBranch('main', true)).rejects.toThrow('已取消操作');
    expect(mockedGitCheckout).not.toHaveBeenCalled();
  });
});

describe('switchBackIfOnValidateBranch', () => {
  it('在验证分支上时切回主工作分支', () => {
    mockedGetCurrentBranch.mockReturnValue('clawt-validate-feature');
    switchBackIfOnValidateBranch();
    expect(mockedGitCheckout).toHaveBeenCalledWith('main', undefined);
  });

  it('不在验证分支上时不操作', () => {
    mockedGetCurrentBranch.mockReturnValue('main');
    switchBackIfOnValidateBranch();
    expect(mockedGitCheckout).not.toHaveBeenCalled();
  });

  it('在普通分支上时不操作', () => {
    mockedGetCurrentBranch.mockReturnValue('feature');
    switchBackIfOnValidateBranch();
    expect(mockedGitCheckout).not.toHaveBeenCalled();
  });
});
