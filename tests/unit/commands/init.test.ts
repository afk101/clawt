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
    INIT_SELECT_PROMPT: '选择要修改的项目配置项',
    INIT_SET_SUCCESS: (key: string, value: string) => `✓ 项目配置 ${key} 已设置为 ${value}`,
  },
  PROJECT_CONFIG_DEFINITIONS: {
    clawtMainWorkBranch: { defaultValue: '', description: 'Main worktree branch name' },
    validateRunCommand: { defaultValue: undefined, description: 'Command to auto-run after validate succeeds' },
  },
  getI18nProjectConfigDescriptions: () => ({
    clawtMainWorkBranch: 'Main worktree branch name',
    validateRunCommand: 'Command to auto-run after validate succeeds',
  }),
}));

vi.mock('../../../src/utils/index.js', () => ({
  runPreChecks: vi.fn(),
  validateHeadExists: vi.fn(),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  loadProjectConfig: vi.fn(),
  saveProjectConfig: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  safeStringify: vi.fn((value: unknown, indent: number = 2) => JSON.stringify(value, null, indent)),
  interactiveConfigEditor: vi.fn(),
  guardMainWorkBranch: vi.fn().mockResolvedValue(undefined),
  guardMainWorkBranchExists: vi.fn(),
  normalizeProjectConfig: vi.fn((config: unknown) => config),
}));

import { registerInitCommand } from '../../../src/commands/init.js';
import {
  loadProjectConfig,
  saveProjectConfig,
  requireProjectConfig,
  printSuccess,
  getCurrentBranch,
  interactiveConfigEditor,
} from '../../../src/utils/index.js';

const mockedLoadProjectConfig = vi.mocked(loadProjectConfig);
const mockedSaveProjectConfig = vi.mocked(saveProjectConfig);
const mockedRequireProjectConfig = vi.mocked(requireProjectConfig);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockedInteractiveConfigEditor = vi.mocked(interactiveConfigEditor);

beforeEach(() => {
  mockedLoadProjectConfig.mockReset();
  mockedSaveProjectConfig.mockReset();
  mockedRequireProjectConfig.mockReset();
  mockedRequireProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'main' });
  mockedPrintSuccess.mockReset();
  mockedGetCurrentBranch.mockReturnValue('main');
  mockedInteractiveConfigEditor.mockReset();
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
  it('clawt init show 进入交互式面板并保存修改', async () => {
    mockedRequireProjectConfig.mockReturnValue({ clawtMainWorkBranch: 'develop' });
    mockedInteractiveConfigEditor.mockResolvedValue({ key: 'validateRunCommand', newValue: 'npm test' });

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init', 'show'], { from: 'user' });

    // 验证调用了交互式配置编辑器
    expect(mockedInteractiveConfigEditor).toHaveBeenCalled();
    // 验证保存了合并后的配置
    expect(mockedSaveProjectConfig).toHaveBeenCalledWith({
      clawtMainWorkBranch: 'develop',
      validateRunCommand: 'npm test',
    });
    // 验证输出了成功消息
    expect(mockedPrintSuccess).toHaveBeenCalledWith(
      expect.stringContaining('validateRunCommand'),
    );
  });

  it('clawt init show 修改已有配置项', async () => {
    mockedRequireProjectConfig.mockReturnValue({
      clawtMainWorkBranch: 'main',
      validateRunCommand: 'npm test',
    });
    mockedInteractiveConfigEditor.mockResolvedValue({ key: 'clawtMainWorkBranch', newValue: 'develop' });

    const program = new Command();
    program.exitOverride();
    registerInitCommand(program);
    await program.parseAsync(['init', 'show'], { from: 'user' });

    expect(mockedSaveProjectConfig).toHaveBeenCalledWith({
      clawtMainWorkBranch: 'develop',
      validateRunCommand: 'npm test',
    });
  });
});
