import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { EventEmitter, Readable } from 'node:stream';

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
    BRANCH_EXISTS_USE_RESUME: (name: string) => `分支 ${name} 已存在，请使用 resume 恢复`,
    WORKTREE_CREATED: (count: number) => `✓ 已创建 ${count} 个 worktree`,
    INTERRUPTED: '已中断',
    INTERRUPT_AUTO_CLEANED: (count: number) => `已清理 ${count} 个 worktree`,
    INTERRUPT_CONFIRM_CLEANUP: '是否清理已创建的 worktree？',
    INTERRUPT_CLEANED: (count: number) => `已清理 ${count} 个 worktree`,
    INTERRUPT_KEPT: '已保留 worktree',
    CONCURRENCY_INFO: (concurrency: number, total: number) => `并发限制: ${concurrency}，共 ${total} 个任务`,
    CONCURRENCY_INVALID: '并发数必须为正整数',
    FILE_AND_TASKS_CONFLICT: '--file 和 --tasks 不能同时使用',
    BRANCH_OR_FILE_REQUIRED: '请指定 -b 或 -f',
    TASK_FILE_LOADED: (count: number, path: string) => `✓ 从 ${path} 加载了 ${count} 个任务`,
    TASK_FILE_MISSING_TASK_BY_INDEX: (blockIndex: number) => `第 ${blockIndex} 个任务块缺少任务描述`,
    DRY_RUN_TITLE: 'Dry Run 预览',
    DRY_RUN_TASK_COUNT: (count: number) => `任务数: ${count}`,
    DRY_RUN_CONCURRENCY: (concurrency: number) => `并发数: ${concurrency === 0 ? '不限制' : concurrency}`,
    DRY_RUN_WORKTREE_DIR: (dir: string) => `Worktree 目录: ${dir}`,
    DRY_RUN_BRANCH_EXISTS_WARNING: (name: string) => `分支 ${name} 已存在`,
    DRY_RUN_INTERACTIVE_MODE: '模式: 交互式（无预设任务）',
    DRY_RUN_READY: '预览完成，无冲突。移除 --dry-run 即可正式执行。',
    DRY_RUN_HAS_CONFLICT: '存在分支冲突，实际执行时将会报错。请先处理冲突的分支。',
  },
}));

/**
 * mock utils/index.js —— run.ts 的直接依赖
 * 注意：executeBatchTasks 不在此 mock，由 utils/index.js 的 re-export 指向 task-executor.js 的真实实现
 */
vi.mock('../../../src/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/index.js')>();
  return {
    ...actual,
    validateMainWorktree: vi.fn(),
    validateClaudeCodeInstalled: vi.fn(),
    createWorktrees: vi.fn(),
    sanitizeBranchName: vi.fn(),
    generateBranchNames: vi.fn(),
    checkBranchExists: vi.fn(),
    getConfigValue: vi.fn().mockReturnValue(0),
    parseConcurrency: vi.fn().mockReturnValue(0),
    getProjectWorktreeDir: vi.fn().mockReturnValue('/mock/.clawt/worktrees/test-project'),
    printSuccess: vi.fn(),
    printError: vi.fn(),
    printWarning: vi.fn(),
    printInfo: vi.fn(),
    printSeparator: vi.fn(),
    printDoubleSeparator: vi.fn(),
    confirmAction: vi.fn(),
    launchInteractiveClaude: vi.fn(),
    loadTaskFile: vi.fn(),
    parseTasksFromOptions: vi.fn(),
    createWorktreesByBranches: vi.fn(),
    printDryRunPreview: vi.fn(),
  };
});

/** task-executor.ts 内部依赖的具体模块 mock */
vi.mock('../../../src/utils/shell.js', () => ({
  spawnProcess: vi.fn(),
  killAllChildProcesses: vi.fn(),
  execCommand: vi.fn(),
  execCommandWithInput: vi.fn(),
}));

vi.mock('../../../src/utils/worktree.js', () => ({
  cleanupWorktrees: vi.fn(),
  createWorktrees: vi.fn(),
  getProjectWorktrees: vi.fn(),
  getProjectWorktreeDir: vi.fn(),
  getWorktreeStatus: vi.fn(),
  createWorktreesByBranches: vi.fn(),
}));

vi.mock('../../../src/utils/config.js', () => ({
  getConfigValue: vi.fn().mockReturnValue(0),
  parseConcurrency: vi.fn().mockReturnValue(0),
  loadConfig: vi.fn(),
  writeDefaultConfig: vi.fn(),
  ensureClawtDirs: vi.fn(),
}));

vi.mock('../../../src/utils/formatter.js', () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printInfo: vi.fn(),
  printSeparator: vi.fn(),
  printDoubleSeparator: vi.fn(),
  confirmAction: vi.fn(),
  confirmDestructiveAction: vi.fn(),
  formatWorktreeStatus: vi.fn(),
  isWorktreeIdle: vi.fn(),
  formatDuration: vi.fn(),
}));

vi.mock('../../../src/utils/progress.js', () => ({
  ProgressRenderer: class {
    start = vi.fn();
    stop = vi.fn();
    updateActivity = vi.fn();
    markRunning = vi.fn();
    markDone = vi.fn();
    markFailed = vi.fn();
  },
}));

vi.mock('../../../src/utils/dry-run.js', () => ({
  truncateTaskDesc: vi.fn(),
  printDryRunPreview: vi.fn(),
}));

import { registerRunCommand } from '../../../src/commands/run.js';
import {
  createWorktrees,
  createWorktreesByBranches,
  sanitizeBranchName,
  generateBranchNames,
  checkBranchExists,
  parseConcurrency,
  printSuccess,
  printDryRunPreview,
  launchInteractiveClaude,
  getConfigValue,
  loadTaskFile,
  parseTasksFromOptions,
  validateClaudeCodeInstalled,
} from '../../../src/utils/index.js';
import { spawnProcess } from '../../../src/utils/shell.js';
import { printInfo as formatterPrintInfo } from '../../../src/utils/formatter.js';

const mockedCreateWorktrees = vi.mocked(createWorktrees);
const mockedCreateWorktreesByBranches = vi.mocked(createWorktreesByBranches);
const mockedSanitizeBranchName = vi.mocked(sanitizeBranchName);
const mockedGenerateBranchNames = vi.mocked(generateBranchNames);
const mockedCheckBranchExists = vi.mocked(checkBranchExists);
const mockedParseConcurrency = vi.mocked(parseConcurrency);
const mockedSpawnProcess = vi.mocked(spawnProcess);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintDryRunPreview = vi.mocked(printDryRunPreview);
const mockedFormatterPrintInfo = vi.mocked(formatterPrintInfo);
const mockedLaunchInteractiveClaude = vi.mocked(launchInteractiveClaude);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedLoadTaskFile = vi.mocked(loadTaskFile);
const mockedParseTasksFromOptions = vi.mocked(parseTasksFromOptions);
const mockedValidateClaudeCodeInstalled = vi.mocked(validateClaudeCodeInstalled);

/**
 * 创建模拟子进程
 * @param {string} stdout - 子进程标准输出内容
 * @param {number} exitCode - 退出码
 * @returns {object} 模拟的子进程对象
 */
function createMockChildProcess(stdout: string, exitCode: number) {
  const child = new EventEmitter() as any;
  const stdoutStream = new Readable({ read() {} });
  const stderrStream = new Readable({ read() {} });
  child.stdout = stdoutStream;
  child.stderr = stderrStream;
  child.pid = 12345;
  child.exitCode = null;

  // 延迟触发 close 事件
  setTimeout(() => {
    stdoutStream.push(stdout);
    stdoutStream.push(null);
    stderrStream.push(null);
    child.exitCode = exitCode;
    child.emit('close', exitCode);
  }, 10);

  return child;
}

beforeEach(() => {
  mockedCreateWorktrees.mockReset();
  mockedCreateWorktreesByBranches.mockReset();
  mockedSanitizeBranchName.mockReset();
  mockedGenerateBranchNames.mockReset();
  mockedCheckBranchExists.mockReset();
  mockedParseConcurrency.mockReset();
  mockedParseConcurrency.mockReturnValue(0);
  mockedSpawnProcess.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintDryRunPreview.mockReset();
  mockedFormatterPrintInfo.mockReset();
  mockedLaunchInteractiveClaude.mockReset();
  mockedGetConfigValue.mockReset();
  mockedGetConfigValue.mockReturnValue(0 as any);
  mockedLoadTaskFile.mockReset();
  mockedParseTasksFromOptions.mockReset();
  mockedValidateClaudeCodeInstalled.mockReset();
  // sanitizeBranchName 默认返回输入值
  mockedSanitizeBranchName.mockImplementation((name: string) => name);
  // generateBranchNames 默认使用真实逻辑
  mockedGenerateBranchNames.mockImplementation((name: string, count: number) => {
    if (count === 1) return [name];
    return Array.from({ length: count }, (_, i) => `${name}-${i + 1}`);
  });
  // parseTasksFromOptions 默认使用真实逻辑
  mockedParseTasksFromOptions.mockImplementation((rawTasks: string[]) => {
    const tasks = rawTasks.map((t) => t.trim()).filter(Boolean);
    if (tasks.length === 0) throw new Error('任务列表不能为空');
    return tasks;
  });
});

describe('registerRunCommand', () => {
  it('注册 run 命令', () => {
    const program = new Command();
    registerRunCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'run');
    expect(cmd).toBeDefined();
  });
});

describe('handleRun', () => {
  it('未传 --tasks 时创建单个 worktree 并打开交互式界面', async () => {
    mockedSanitizeBranchName.mockReturnValue('feature');
    mockedCheckBranchExists.mockReturnValue(false);
    const worktree = { path: '/path/feature', branch: 'feature' };
    mockedCreateWorktrees.mockReturnValue([worktree]);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feature'], { from: 'user' });

    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feature', 1);
    expect(mockedLaunchInteractiveClaude).toHaveBeenCalledWith(worktree);
  });

  it('分支已存在时提示使用 resume', async () => {
    mockedSanitizeBranchName.mockReturnValue('feature');
    mockedCheckBranchExists.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);

    await expect(
      program.parseAsync(['run', '-b', 'feature'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('传 --tasks 时创建对应数量 worktree 并并行执行', async () => {
    const worktrees = [
      { path: '/path/feat-1', branch: 'feat-1' },
      { path: '/path/feat-2', branch: 'feat-2' },
    ];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', 'task2'], { from: 'user' });

    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feat', 2);
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(2);
  });

  it('任务执行失败时在通知中报告', async () => {
    const worktrees = [{ path: '/path/feat-1', branch: 'feat-1' }];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: true,
      duration_ms: 1000,
      total_cost_usd: 0.01,
    });
    mockedSpawnProcess.mockReturnValueOnce(createMockChildProcess(jsonOutput, 1));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'fail-task'], { from: 'user' });

    // 应输出汇总（含失败信息）
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(1);
  });

  it('子进程发生错误时返回失败结果', async () => {
    const worktrees = [{ path: '/path/feat-1', branch: 'feat-1' }];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    // 创建会触发 error 事件的子进程
    const child = new EventEmitter() as any;
    child.stdout = new Readable({ read() {} });
    child.stderr = new Readable({ read() {} });
    child.pid = 12345;
    child.exitCode = null;
    setTimeout(() => {
      child.emit('error', new Error('spawn error'));
    }, 10);
    mockedSpawnProcess.mockReturnValueOnce(child);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1'], { from: 'user' });

    expect(mockedSpawnProcess).toHaveBeenCalledTimes(1);
  });

  it('传 --concurrency 限制并发数', async () => {
    mockedParseConcurrency.mockReturnValue(1);
    const worktrees = [
      { path: '/path/feat-1', branch: 'feat-1' },
      { path: '/path/feat-2', branch: 'feat-2' },
      { path: '/path/feat-3', branch: 'feat-3' },
    ];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', 'task2', 'task3', '-c', '1'], { from: 'user' });

    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feat', 3);
    // 所有任务都应执行完毕
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(3);
    // 应输出并发限制提示
    expect(mockedFormatterPrintInfo).toHaveBeenCalledWith(expect.stringContaining('并发限制'));
  });

  it('--concurrency 为 0 时不限制并发', async () => {
    const worktrees = [
      { path: '/path/feat-1', branch: 'feat-1' },
      { path: '/path/feat-2', branch: 'feat-2' },
    ];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', 'task2', '-c', '0'], { from: 'user' });

    // 不限制并发时不输出并发限制提示
    expect(mockedFormatterPrintInfo).not.toHaveBeenCalledWith(expect.stringContaining('并发限制'));
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(2);
  });

  it('未传 -c 时使用全局配置的 maxConcurrency', async () => {
    mockedGetConfigValue.mockReturnValue(2 as any);
    mockedParseConcurrency.mockReturnValue(2);

    const worktrees = [
      { path: '/path/feat-1', branch: 'feat-1' },
      { path: '/path/feat-2', branch: 'feat-2' },
      { path: '/path/feat-3', branch: 'feat-3' },
    ];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', 'task2', 'task3'], { from: 'user' });

    // 应输出并发限制提示（使用配置值 2）
    expect(mockedFormatterPrintInfo).toHaveBeenCalledWith(expect.stringContaining('并发限制'));
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(3);
  });

  it('-f 从文件加载任务并执行（无 -b，使用文件中分支名）', async () => {
    mockedLoadTaskFile.mockReturnValue([
      { branch: 'feat-login', task: '实现登录功能' },
      { branch: 'fix-bug', task: '修复问题' },
    ]);
    const worktrees = [
      { path: '/path/feat-login', branch: 'feat-login' },
      { path: '/path/fix-bug', branch: 'fix-bug' },
    ];
    mockedCreateWorktreesByBranches.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-f', 'tasks.md'], { from: 'user' });

    expect(mockedLoadTaskFile).toHaveBeenCalledWith('tasks.md', { branchRequired: true });
    expect(mockedCreateWorktreesByBranches).toHaveBeenCalledWith(['feat-login', 'fix-bug']);
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(2);
  });

  it('-f + -b 模式使用 -b 自动编号', async () => {
    mockedLoadTaskFile.mockReturnValue([
      { task: '任务1' },
      { task: '任务2' },
    ]);
    const worktrees = [
      { path: '/path/feat-1', branch: 'feat-1' },
      { path: '/path/feat-2', branch: 'feat-2' },
    ];
    mockedCreateWorktrees.mockReturnValue(worktrees);

    const jsonOutput = JSON.stringify({
      is_error: false,
      duration_ms: 5000,
      total_cost_usd: 0.05,
    });
    mockedSpawnProcess
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0))
      .mockReturnValueOnce(createMockChildProcess(jsonOutput, 0));

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '-f', 'tasks.md'], { from: 'user' });

    // 应使用 createWorktrees（带 -b 自动编号），而非 createWorktreesByBranches
    expect(mockedLoadTaskFile).toHaveBeenCalledWith('tasks.md', { branchRequired: false });
    expect(mockedCreateWorktrees).toHaveBeenCalledWith('feat', 2);
    expect(mockedCreateWorktreesByBranches).not.toHaveBeenCalled();
    expect(mockedSpawnProcess).toHaveBeenCalledTimes(2);
  });

  it('-f 和 --tasks 互斥时报错', async () => {
    mockedLoadTaskFile.mockReturnValue([{ branch: 'feat', task: '任务' }]);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);

    await expect(
      program.parseAsync(['run', '-f', 'tasks.md', '--tasks', 'task1'], { from: 'user' }),
    ).rejects.toThrow();
  });

  it('未传 -b 和 -f 时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);

    await expect(
      program.parseAsync(['run', '--tasks', 'task1'], { from: 'user' }),
    ).rejects.toThrow();
  });
});

describe('handleRun --dry-run', () => {
  it('--dry-run + --tasks 展示任务预览，不创建 worktree 也不启动 Claude Code', async () => {
    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', '实现登录功能', '修复首页bug', '--dry-run'], { from: 'user' });

    // 不创建 worktree
    expect(mockedCreateWorktrees).not.toHaveBeenCalled();
    expect(mockedCreateWorktreesByBranches).not.toHaveBeenCalled();
    // 不启动 Claude Code
    expect(mockedLaunchInteractiveClaude).not.toHaveBeenCalled();
    expect(mockedSpawnProcess).not.toHaveBeenCalled();
    // 应调用 generateBranchNames 生成分支名
    expect(mockedGenerateBranchNames).toHaveBeenCalledWith('feat', 2);
    // 应调用 printDryRunPreview 输出预览
    expect(mockedPrintDryRunPreview).toHaveBeenCalledWith(['feat-1', 'feat-2'], ['实现登录功能', '修复首页bug'], 0);
  });

  it('--dry-run 不调用 validateClaudeCodeInstalled', async () => {
    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', '--dry-run'], { from: 'user' });

    expect(mockedValidateClaudeCodeInstalled).not.toHaveBeenCalled();
  });

  it('--dry-run 交互式模式展示单个 worktree 信息', async () => {
    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--dry-run'], { from: 'user' });

    // 不创建 worktree
    expect(mockedCreateWorktrees).not.toHaveBeenCalled();
    // 不启动 Claude Code
    expect(mockedLaunchInteractiveClaude).not.toHaveBeenCalled();
    // 交互式模式：分支名列表为单个，任务为空数组
    expect(mockedPrintDryRunPreview).toHaveBeenCalledWith(['feat'], [], 0);
  });

  it('--dry-run + -f 从任务文件展示预览', async () => {
    mockedLoadTaskFile.mockReturnValue([
      { branch: 'feat-login', task: '实现登录功能' },
      { branch: 'fix-bug', task: '修复问题' },
    ]);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-f', 'tasks.md', '--dry-run'], { from: 'user' });

    // 应加载任务文件
    expect(mockedLoadTaskFile).toHaveBeenCalledWith('tasks.md', { branchRequired: true });
    // 不创建 worktree
    expect(mockedCreateWorktrees).not.toHaveBeenCalled();
    expect(mockedCreateWorktreesByBranches).not.toHaveBeenCalled();
    // 不启动 Claude Code
    expect(mockedSpawnProcess).not.toHaveBeenCalled();
    // 应调用 printDryRunPreview
    expect(mockedPrintDryRunPreview).toHaveBeenCalledWith(
      ['feat-login', 'fix-bug'],
      ['实现登录功能', '修复问题'],
      0,
    );
  });

  it('--dry-run + -f + -b 模式使用 -b 自动编号', async () => {
    mockedLoadTaskFile.mockReturnValue([
      { task: '任务1' },
      { task: '任务2' },
    ]);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '-f', 'tasks.md', '--dry-run'], { from: 'user' });

    // 应使用 generateBranchNames 自动编号
    expect(mockedGenerateBranchNames).toHaveBeenCalledWith('feat', 2);
    // 不实际创建 worktree
    expect(mockedCreateWorktrees).not.toHaveBeenCalled();
    // 应调用 printDryRunPreview
    expect(mockedPrintDryRunPreview).toHaveBeenCalled();
  });

  it('--dry-run 传递并发配置给 printDryRunPreview', async () => {
    mockedParseConcurrency.mockReturnValue(3);

    const program = new Command();
    program.exitOverride();
    registerRunCommand(program);
    await program.parseAsync(['run', '-b', 'feat', '--tasks', 'task1', 'task2', '-c', '3', '--dry-run'], { from: 'user' });

    // 不创建 worktree
    expect(mockedCreateWorktrees).not.toHaveBeenCalled();
    // 应将并发数传递给 printDryRunPreview
    expect(mockedPrintDryRunPreview).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      3,
    );
  });
});
