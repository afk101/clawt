import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock logger（避免测试时写日志文件）
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  accessSync: vi.fn(),
  chmodSync: vi.fn(),
  constants: { X_OK: 1 },
}));

// mock node:child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// mock project-config
vi.mock('../../../src/utils/project-config.js', () => ({
  loadProjectConfig: vi.fn(),
}));

// mock git
vi.mock('../../../src/utils/git.js', () => ({
  getMainWorktreePath: vi.fn(),
}));

// mock formatter
vi.mock('../../../src/utils/formatter.js', () => ({
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
}));

import { EventEmitter } from 'node:events';
import { existsSync, accessSync, chmodSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { loadProjectConfig } from '../../../src/utils/project-config.js';
import { getMainWorktreePath } from '../../../src/utils/git.js';
import { printInfo, printSuccess, printWarning } from '../../../src/utils/formatter.js';
import { logger } from '../../../src/logger/index.js';
import {
  resolvePostCreateHook,
  executePostCreateHooks,
  runPostCreateHooks,
} from '../../../src/hooks/post-create.js';
import { createWorktreeInfo, createWorktreeList } from '../../helpers/fixtures.js';
import type { ResolvedHook } from '../../../src/types/index.js';

const mockedLoadProjectConfig = vi.mocked(loadProjectConfig);
const mockedGetMainWorktreePath = vi.mocked(getMainWorktreePath);
const mockedExistsSync = vi.mocked(existsSync);
const mockedAccessSync = vi.mocked(accessSync);
const mockedChmodSync = vi.mocked(chmodSync);
const mockedSpawn = vi.mocked(spawn);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintWarning = vi.mocked(printWarning);
const mockedLoggerError = vi.mocked(logger.error);
const mockedLoggerInfo = vi.mocked(logger.info);

/**
 * 创建模拟的 spawn 子进程
 * @param {number} exitCode - 子进程退出码
 * @returns {object} 模拟的子进程对象
 */
function createMockSpawnChild(exitCode: number) {
  const child = new EventEmitter() as any;
  child.pid = 12345;
  child.killed = false;
  child.kill = vi.fn();

  // 延迟触发 close 事件
  setTimeout(() => {
    child.emit('close', exitCode);
  }, 5);

  return child;
}

/**
 * 创建会触发 error 事件的模拟子进程
 * @param {string} errorMessage - 错误信息
 * @returns {object} 模拟的子进程对象
 */
function createMockSpawnChildWithError(errorMessage: string) {
  const child = new EventEmitter() as any;
  child.pid = 12345;
  child.killed = false;
  child.kill = vi.fn();

  // 延迟触发 error 事件
  setTimeout(() => {
    child.emit('error', new Error(errorMessage));
  }, 5);

  return child;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetMainWorktreePath.mockReturnValue('/repo');
});

// ─────────────────────────────────────────────
// resolvePostCreateHook
// ─────────────────────────────────────────────
describe('resolvePostCreateHook', () => {
  it('项目配置有 postCreate 字符串时返回 projectConfig 来源', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: 'npm install',
    });

    const result = resolvePostCreateHook();

    expect(result).toEqual({
      command: 'npm install',
      source: 'projectConfig',
    });
  });

  it('项目配置 postCreate 为空字符串时回退到脚本检测', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: '',
    });
    mockedExistsSync.mockReturnValue(false);

    const result = resolvePostCreateHook();

    expect(result).toBeNull();
  });

  it('无项目配置时检测 .clawt/postCreate.sh 脚本', () => {
    mockedLoadProjectConfig.mockReturnValue(null);
    mockedExistsSync.mockReturnValue(true);
    // accessSync 不抛出表示可执行
    mockedAccessSync.mockReturnValue(undefined);

    const result = resolvePostCreateHook();

    expect(result).toEqual({
      command: '/repo/.clawt/postCreate.sh',
      source: 'postCreateScript',
    });
    // 验证检测的路径包含 postCreate.sh（而非 setup.sh）
    expect(mockedExistsSync).toHaveBeenCalledWith('/repo/.clawt/postCreate.sh');
  });

  it('脚本存在但不可执行时自动 chmod +x 后返回 postCreateScript', () => {
    mockedLoadProjectConfig.mockReturnValue(null);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {
      throw new Error('EACCES');
    });
    mockedChmodSync.mockReturnValue(undefined);

    const result = resolvePostCreateHook();

    expect(result).toEqual({
      command: '/repo/.clawt/postCreate.sh',
      source: 'postCreateScript',
    });
    expect(mockedChmodSync).toHaveBeenCalledWith('/repo/.clawt/postCreate.sh', 0o755);
    expect(mockedPrintInfo).toHaveBeenCalledWith(
      expect.stringContaining('已自动添加执行权限'),
    );
  });

  it('脚本不可执行且自动 chmod 失败时打印警告但仍返回 hook', () => {
    mockedLoadProjectConfig.mockReturnValue(null);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {
      throw new Error('EACCES');
    });
    mockedChmodSync.mockImplementation(() => {
      throw new Error('EPERM');
    });

    const result = resolvePostCreateHook();

    // 仍然返回 hook（脚本执行阶段会自然报错）
    expect(result).toEqual({
      command: '/repo/.clawt/postCreate.sh',
      source: 'postCreateScript',
    });
    expect(mockedPrintWarning).toHaveBeenCalledWith(
      expect.stringContaining('不可执行'),
    );
  });

  it('无项目配置且脚本不存在时返回 null', () => {
    mockedLoadProjectConfig.mockReturnValue(null);
    mockedExistsSync.mockReturnValue(false);

    const result = resolvePostCreateHook();

    expect(result).toBeNull();
  });

  it('项目配置优先级高于脚本', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: 'pnpm install',
    });
    // 即使脚本也存在，也应该返回 projectConfig 来源
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockReturnValue(undefined);

    const result = resolvePostCreateHook();

    expect(result!.source).toBe('projectConfig');
    expect(result!.command).toBe('pnpm install');
  });

  it('字符串命令前后空白会被 trim', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: '  npm install  ',
    });

    const result = resolvePostCreateHook();

    expect(result!.command).toBe('npm install');
  });

});

// ─────────────────────────────────────────────
// executePostCreateHooks（异步并行版本）
// ─────────────────────────────────────────────
describe('executePostCreateHooks', () => {
  const hook: ResolvedHook = {
    command: 'npm install',
    source: 'projectConfig',
  };

  it('单个 worktree 执行成功', async () => {
    const worktree = createWorktreeInfo({ path: '/wt/feat', branch: 'feat' });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    const results = await executePostCreateHooks([worktree], hook);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].worktreePath).toBe('/wt/feat');
    expect(results[0].branch).toBe('feat');
    expect(results[0].source).toBe('projectConfig');
    expect(results[0].error).toBeUndefined();
  });

  it('命令退出码非零时标记失败', async () => {
    const worktree = createWorktreeInfo({ path: '/wt/feat', branch: 'feat' });
    mockedSpawn.mockReturnValue(createMockSpawnChild(1));

    const results = await executePostCreateHooks([worktree], hook);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('退出码: 1');
    expect(mockedLoggerError).toHaveBeenCalled();
  });

  it('子进程触发 error 事件时标记失败', async () => {
    const worktree = createWorktreeInfo({ path: '/wt/feat', branch: 'feat' });
    mockedSpawn.mockReturnValue(createMockSpawnChildWithError('spawn ENOENT'));

    const results = await executePostCreateHooks([worktree], hook);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('spawn ENOENT');
    expect(mockedLoggerError).toHaveBeenCalled();
  });

  it('多个 worktree 并行执行，互不影响', async () => {
    const worktrees = createWorktreeList(3);
    mockedSpawn
      .mockReturnValueOnce(createMockSpawnChild(0))
      .mockReturnValueOnce(createMockSpawnChild(1))
      .mockReturnValueOnce(createMockSpawnChild(0));

    const results = await executePostCreateHooks(worktrees, hook);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });

  it('正确传递 cwd 给 spawn', async () => {
    const worktree = createWorktreeInfo({ path: '/custom/path', branch: 'test' });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    await executePostCreateHooks([worktree], hook);

    expect(mockedSpawn).toHaveBeenCalledWith(
      'npm install',
      expect.objectContaining({ cwd: '/custom/path' }),
    );
  });

  it('spawn 使用 shell 模式和 stdio: ignore', async () => {
    const worktree = createWorktreeInfo({ path: '/wt/feat', branch: 'feat' });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    await executePostCreateHooks([worktree], hook);

    expect(mockedSpawn).toHaveBeenCalledWith(
      'npm install',
      expect.objectContaining({
        stdio: 'ignore',
        shell: true,
      }),
    );
  });

  it('退出码为 null 时视为成功（信号终止场景）', async () => {
    const worktree = createWorktreeInfo({ path: '/wt/feat', branch: 'feat' });
    // 创建退出码为 null 的子进程
    const child = new EventEmitter() as any;
    child.pid = 12345;
    child.killed = false;
    child.kill = vi.fn();
    setTimeout(() => {
      child.emit('close', null);
    }, 5);
    mockedSpawn.mockReturnValue(child);

    const results = await executePostCreateHooks([worktree], hook);

    expect(results[0].success).toBe(true);
  });

  it('source 字段正确传递 postCreateScript', async () => {
    const scriptHook: ResolvedHook = {
      command: '/repo/.clawt/postCreate.sh',
      source: 'postCreateScript',
    };
    const worktree = createWorktreeInfo({ path: '/wt/feat', branch: 'feat' });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    const results = await executePostCreateHooks([worktree], scriptHook);

    expect(results[0].source).toBe('postCreateScript');
  });
});

// ─────────────────────────────────────────────
// runPostCreateHooks（完整入口，fire-and-forget）
// ─────────────────────────────────────────────
describe('runPostCreateHooks', () => {
  const worktrees = createWorktreeList(2);

  it('skip 为 true 时直接跳过', () => {
    runPostCreateHooks(worktrees, true);

    expect(mockedPrintInfo).toHaveBeenCalledWith(
      expect.stringContaining('--no-post-create'),
    );
    // 不应调用任何配置加载或命令执行
    expect(mockedLoadProjectConfig).not.toHaveBeenCalled();
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('无 hook 配置时提示未配置', () => {
    mockedLoadProjectConfig.mockReturnValue(null);
    mockedExistsSync.mockReturnValue(false);

    runPostCreateHooks(worktrees, false);

    expect(mockedPrintInfo).toHaveBeenCalledWith(
      expect.stringContaining('未配置'),
    );
  });

  it('有 hook 配置时调用 spawn 启动后台执行', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: 'npm install',
    });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    runPostCreateHooks(worktrees, false);

    // fire-and-forget：spawn 应该被调用（后台异步执行）
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
    // 验证后台执行提示已输出
    expect(mockedPrintInfo).toHaveBeenCalledWith(
      expect.stringContaining('后台执行'),
    );
  });

  it('返回值为 void', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: 'npm install',
    });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    const result = runPostCreateHooks(worktrees, false);

    expect(result).toBeUndefined();
  });

  it('输出 hook 来源信息（projectConfig）', () => {
    mockedLoadProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      postCreate: 'npm install',
    });
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    runPostCreateHooks(worktrees, false);

    expect(mockedPrintInfo).toHaveBeenCalledWith(
      expect.stringContaining('项目配置 (postCreate)'),
    );
  });

  it('输出 hook 来源信息（postCreateScript）', () => {
    mockedLoadProjectConfig.mockReturnValue(null);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockReturnValue(undefined);
    mockedSpawn.mockReturnValue(createMockSpawnChild(0));

    runPostCreateHooks(worktrees, false);

    expect(mockedPrintInfo).toHaveBeenCalledWith(
      expect.stringContaining('.clawt/postCreate.sh'),
    );
  });
});
