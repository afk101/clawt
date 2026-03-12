import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    TASK_INIT_FILE_EXISTS: (path: string) => `文件已存在: ${path}，如需覆盖请先删除`,
    TASK_INIT_SUCCESS: (path: string) => `✓ 任务模板已生成: ${path}`,
    TASK_INIT_HINT: (path: string) => `使用 clawt run -f ${path} 执行任务`,
  },
  TASK_TEMPLATE_OUTPUT_DIR: '.clawt/tasks',
  TASK_TEMPLATE_FILENAME_PREFIX: 'clawt-tasks',
  TASK_TEMPLATE_CONTENT: '# 模板内容',
}));

const mockExistsSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

const mockGenerateTaskFilename = vi.fn().mockReturnValue('clawt-tasks-2026-01-01-00-00-00.md');

vi.mock('../../../src/utils/index.js', () => ({
  printSuccess: vi.fn(),
  printHint: vi.fn(),
  ensureDir: vi.fn(),
  generateTaskFilename: (...args: unknown[]) => mockGenerateTaskFilename(...args),
}));

vi.mock('../../../src/errors/index.js', () => {
  class ClawtError extends Error {
    public readonly exitCode: number;
    constructor(message: string, exitCode: number = 1) {
      super(message);
      this.name = 'ClawtError';
      this.exitCode = exitCode;
    }
  }
  return { ClawtError };
});

import { registerTasksCommand } from '../../../src/commands/tasks.js';
import { printSuccess, printHint, ensureDir } from '../../../src/utils/index.js';
import { ClawtError } from '../../../src/errors/index.js';

const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintHint = vi.mocked(printHint);
const mockedEnsureDir = vi.mocked(ensureDir);

beforeEach(() => {
  mockExistsSync.mockReset();
  mockWriteFileSync.mockReset();
  mockGenerateTaskFilename.mockReset();
  mockGenerateTaskFilename.mockReturnValue('clawt-tasks-2026-01-01-00-00-00.md');
  mockedPrintSuccess.mockReset();
  mockedPrintHint.mockReset();
  mockedEnsureDir.mockReset();
});

describe('registerTasksCommand', () => {
  it('注册 tasks 命令', () => {
    const program = new Command();
    registerTasksCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'tasks');
    expect(cmd).toBeDefined();
  });

  it('注册 tasks init 子命令', () => {
    const program = new Command();
    registerTasksCommand(program);
    const taskCmd = program.commands.find((c) => c.name() === 'tasks');
    const initCmd = taskCmd?.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
  });
});

describe('handleTasksInit', () => {
  it('默认路径生成带时间戳的文件', async () => {
    mockExistsSync.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerTasksCommand(program);
    await program.parseAsync(['tasks', 'init'], { from: 'user' });

    expect(mockGenerateTaskFilename).toHaveBeenCalledWith('clawt-tasks');
    // 默认路径应输出到 .clawt/tasks/ 目录下
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.clawt/tasks/clawt-tasks-2026-01-01-00-00-00.md'),
      '# 模板内容',
      'utf-8',
    );
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('.clawt/tasks/clawt-tasks-2026-01-01-00-00-00.md'),
    );
    expect(mockedPrintHint).toHaveBeenCalledWith(
      expect.stringContaining('.clawt/tasks/clawt-tasks-2026-01-01-00-00-00.md'),
    );
  });

  it('指定路径生成自定义文件', async () => {
    mockExistsSync.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerTasksCommand(program);
    await program.parseAsync(['tasks', 'init', 'my-tasks.md'], { from: 'user' });

    expect(mockGenerateTaskFilename).not.toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('my-tasks.md'),
      '# 模板内容',
      'utf-8',
    );
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('my-tasks.md'),
    );
  });

  it('文件已存在时抛出 ClawtError', async () => {
    mockExistsSync.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerTasksCommand(program);

    await expect(
      program.parseAsync(['tasks', 'init'], { from: 'user' }),
    ).rejects.toThrow(ClawtError);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('父目录不存在时自动创建', async () => {
    mockExistsSync.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerTasksCommand(program);
    await program.parseAsync(['tasks', 'init', 'sub/dir/tasks.md'], { from: 'user' });

    expect(mockedEnsureDir).toHaveBeenCalledWith(
      expect.stringContaining('sub/dir'),
    );
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
