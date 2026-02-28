import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    INIT_SUCCESS: (branch: string) => `✓ 项目初始化成功，主工作分支设置为: ${branch}`,
    INIT_UPDATED: (oldBranch: string, newBranch: string) => `✓ 已将主工作分支从 ${oldBranch} 更新为 ${newBranch}`,
    INIT_SHOW: (configJson: string) => `当前项目配置:\n${configJson}`,
    PROJECT_NOT_INITIALIZED: '项目尚未初始化，请先执行 clawt init 设置主工作分支',
    PROJECT_CONFIG_MISSING_BRANCH: '项目配置缺少主工作分支信息，请重新执行 clawt init 设置主工作分支',
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  loadProjectConfig: vi.fn(),
  saveProjectConfig: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  safeStringify: vi.fn((value: unknown, indent: number = 2) => JSON.stringify(value, null, indent)),
}));

import { registerInitCommand } from '../../../src/commands/init.js';
import {
  loadProjectConfig,
  saveProjectConfig,
  requireProjectConfig,
  printSuccess,
  printInfo,
  getCurrentBranch,
} from '../../../src/utils/index.js';

const mockedLoadProjectConfig = vi.mocked(loadProjectConfig);
const mockedSaveProjectConfig = vi.mocked(saveProjectConfig);
const mockedRequireProjectConfig = vi.mocked(requireProjectConfig);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);

beforeEach(() => {
  mockedLoadProjectConfig.mockReset();
  mockedSaveProjectConfig.mockReset();
  mockedRequireProjectConfig.mockReset();
  mockedRequireProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'main' });
  mockedPrintSuccess.mockReset();
  mockedPrintInfo.mockReset();
  mockedGetCurrentBranch.mockReturnValue('main');
});

describe('registerInitCommand', () => {
  it('注册 init 命令', () => {
    const program = new Command();
    registerInitCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'init');
    expect(cmd).toBeDefined();
  });

  it('注册 init show 子命令', () => {
    const program = new Command();
    registerInitCommand(program);
    const initCmd = program.commands.find((c) => c.name() === 'init');
    const showCmd = initCmd?.commands.find((c) => c.name() === 'show');
    expect(showCmd).toBeDefined();
  });
});

describe('handleInit', () => {
  it('无参数且已初始化时使用当前分支切换主工作分支', async () => {
    mockedLoadProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'develop' });

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init'], { from: 'user' });

    expect(mockedSaveProjectConfig).toHaveBeenCalledWith({ clawtMainWorkBranch: 'main' });
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('develop'),
    );
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('main'),
    );
  });

  it('无参数且未初始化时使用当前分支初始化', async () => {
    mockedLoadProjectConfig.mockReturnValue(null);

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init'], { from: 'user' });

    expect(mockedSaveProjectConfig).toHaveBeenCalledWith({ clawtMainWorkBranch: 'main' });
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('有 -b 参数时设置指定分支', async () => {
    mockedLoadProjectConfig.mockReturnValue(null);

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init', '-b', 'develop'], { from: 'user' });

    expect(mockedSaveProjectConfig).toHaveBeenCalledWith({ clawtMainWorkBranch: 'develop' });
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('有 -b 参数且已初始化时更新配置', async () => {
    mockedLoadProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'main' });

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init', '-b', 'develop'], { from: 'user' });

    expect(mockedSaveProjectConfig).toHaveBeenCalledWith({ clawtMainWorkBranch: 'develop' });
    // 验证 INIT_UPDATED 传入了旧分支名和新分支名
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('main'),
    );
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('develop'),
    );
  });
});

describe('handleInitShow (show 子命令)', () => {
  it('clawt init show 展示当前配置', async () => {
    mockedRequireProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'develop' });

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init', 'show'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
    expect(mockedSaveProjectConfig).not.toHaveBeenCalled();
  });
});
