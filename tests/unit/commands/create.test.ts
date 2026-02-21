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

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    INVALID_COUNT: (val: string) => `数量必须为正整数: ${val}`,
    WORKTREE_CREATED: (count: number) => `✓ 已创建 ${count} 个 worktree`,
  },
  EXIT_CODES: { SUCCESS: 0, ERROR: 1, ARGUMENT_ERROR: 2 },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  createWorktrees: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  printSeparator: vi.fn(),
}));

import { registerCreateCommand } from '../../../src/commands/create.js';
import { validateMainWorktree, createWorktrees, printSuccess } from '../../../src/utils/index.js';

const mockedValidateMainWorktree = vi.mocked(validateMainWorktree);
const mockedCreateWorktrees = vi.mocked(createWorktrees);
const mockedPrintSuccess = vi.mocked(printSuccess);

beforeEach(() => {
  mockedValidateMainWorktree.mockReset();
  mockedCreateWorktrees.mockReset();
  mockedPrintSuccess.mockReset();
});

describe('registerCreateCommand', () => {
  it('注册 create 命令', () => {
    const program = new Command();
    registerCreateCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'create');
    expect(cmd).toBeDefined();
  });
});

describe('handleCreate', () => {
  it('成功创建 worktree', () => {
    mockedCreateWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);

    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);
    program.parse(['create', '-b', 'feature'], { from: 'user' });

    expect(mockedValidateMainWorktree).toHaveBeenCalled();
    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feature', 1);
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('支持 -n 指定创建数量', () => {
    mockedCreateWorktrees.mockReturnValue([
      { path: '/path/feature-1', branch: 'feature-1' },
      { path: '/path/feature-2', branch: 'feature-2' },
    ]);

    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);
    program.parse(['create', '-b', 'feature', '-n', '2'], { from: 'user' });

    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feature', 2);
  });

  it('无效数量抛出 ClawtError', () => {
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    expect(() => {
      program.parse(['create', '-b', 'feature', '-n', 'abc'], { from: 'user' });
    }).toThrow();
  });

  it('数量为 0 时抛出 ClawtError', () => {
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    expect(() => {
      program.parse(['create', '-b', 'feature', '-n', '0'], { from: 'user' });
    }).toThrow();
  });

  it('负数数量抛出 ClawtError', () => {
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    expect(() => {
      program.parse(['create', '-b', 'feature', '-n', '-1'], { from: 'user' });
    }).toThrow();
  });
});
