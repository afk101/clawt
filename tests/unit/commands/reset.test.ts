import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    RESET_SUCCESS: '✓ 已重置主 worktree',
    RESET_ALREADY_CLEAN: '主 worktree 已经是干净状态',
    DESTRUCTIVE_OP_CANCELLED: '已取消操作',
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  getGitTopLevel: vi.fn(),
  getConfigValue: vi.fn(),
  isWorkingDirClean: vi.fn(),
  gitResetHard: vi.fn(),
  gitCleanForce: vi.fn(),
  confirmDestructiveAction: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
}));

import { registerResetCommand } from '../../../src/commands/reset.js';
import {
  getGitTopLevel,
  getConfigValue,
  isWorkingDirClean,
  gitResetHard,
  gitCleanForce,
  confirmDestructiveAction,
  printSuccess,
  printInfo,
} from '../../../src/utils/index.js';

const mockedGetGitTopLevel = vi.mocked(getGitTopLevel);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGitResetHard = vi.mocked(gitResetHard);
const mockedGitCleanForce = vi.mocked(gitCleanForce);
const mockedConfirmDestructiveAction = vi.mocked(confirmDestructiveAction);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintInfo = vi.mocked(printInfo);

beforeEach(() => {
  mockedGetGitTopLevel.mockReturnValue('/repo');
  mockedGetConfigValue.mockReset();
  mockedIsWorkingDirClean.mockReset();
  mockedGitResetHard.mockReset();
  mockedGitCleanForce.mockReset();
  mockedConfirmDestructiveAction.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintInfo.mockReset();
});

describe('registerResetCommand', () => {
  it('注册 reset 命令', () => {
    const program = new Command();
    registerResetCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'reset');
    expect(cmd).toBeDefined();
  });
});

describe('handleReset', () => {
  it('工作区已干净时提示', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerResetCommand(program);
    await program.parseAsync(['reset'], { from: 'user' });

    expect(mockedGitResetHard).not.toHaveBeenCalled();
    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('工作区不干净且确认后执行重置', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);
    mockedGetConfigValue.mockReturnValue(true); // confirmDestructiveOps = true
    mockedConfirmDestructiveAction.mockResolvedValue(true);

    const program = new Command();
    program.exitOverride();
    registerResetCommand(program);
    await program.parseAsync(['reset'], { from: 'user' });

    expect(mockedGitResetHard).toHaveBeenCalledWith('/repo');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('用户拒绝确认时不执行重置', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);
    mockedGetConfigValue.mockReturnValue(true);
    mockedConfirmDestructiveAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerResetCommand(program);
    await program.parseAsync(['reset'], { from: 'user' });

    expect(mockedGitResetHard).not.toHaveBeenCalled();
    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('confirmDestructiveOps=false 时跳过确认直接重置', async () => {
    mockedIsWorkingDirClean.mockReturnValue(false);
    mockedGetConfigValue.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerResetCommand(program);
    await program.parseAsync(['reset'], { from: 'user' });

    expect(mockedConfirmDestructiveAction).not.toHaveBeenCalled();
    expect(mockedGitResetHard).toHaveBeenCalledWith('/repo');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/repo');
  });
});
