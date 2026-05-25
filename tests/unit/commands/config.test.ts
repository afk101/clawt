import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// mock enquirer（必须在所有 import 之前）
const { mockSelectRun, mockInputRun, mockSelectConstructorArgs } = vi.hoisted(() => {
  const mockSelectRun = vi.fn();
  const mockInputRun = vi.fn();
  /** 用于捕获 Select 构造时传入的参数 */
  const mockSelectConstructorArgs: unknown[] = [];
  return { mockSelectRun, mockInputRun, mockSelectConstructorArgs };
});

vi.mock('enquirer', () => ({
  default: {
    Select: function MockSelect(opts: unknown) { mockSelectConstructorArgs.push(opts); return { run: mockSelectRun }; },
    Input: function MockInput() { return { run: mockInputRun }; },
  },
}));

// mock 依赖模块
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/utils/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/utils/index.js')>();
  return {
    loadConfig: vi.fn(),
    writeDefaultConfig: vi.fn(),
    saveConfig: vi.fn(),
    printInfo: vi.fn(),
    printSuccess: vi.fn(),
    printError: vi.fn(),
    confirmDestructiveAction: vi.fn(),
    // 策略工具函数透传真实实现（因为常量已被 mock，工具函数可以正常工作）
    isValidConfigKey: original.isValidConfigKey,
    getValidConfigKeys: original.getValidConfigKeys,
    parseConfigValue: original.parseConfigValue,
    promptConfigValue: original.promptConfigValue,
    formatConfigValue: original.formatConfigValue,
    interactiveConfigEditor: original.interactiveConfigEditor,
  };
});

vi.mock('../../../src/constants/index.js', () => ({
  CONFIG_PATH: '/mock/.clawt/config.json',
  DEFAULT_CONFIG: {
    language: 'en',
    autoDeleteBranch: false,
    claudeCodeCommand: 'claude',
    autoPullPush: false,
    confirmDestructiveOps: true,
    maxConcurrency: 0,
    terminalApp: 'auto',
    resumeInPlace: false,
    aliases: {},
    autoUpdate: true,
    conflictResolveMode: 'ask',
    conflictResolveTimeoutMs: 900000,
  },
  CONFIG_DESCRIPTIONS: {
    language: 'Interface language',
    autoDeleteBranch: 'Whether to auto-delete the local branch when removing a worktree',
    claudeCodeCommand: 'Claude Code CLI launch command',
    autoPullPush: 'Whether to auto-run git pull and git push after merge',
    confirmDestructiveOps: 'Whether to prompt for confirmation before destructive operations',
    maxConcurrency: 'Default max concurrency for run command, 0 means unlimited',
    terminalApp: 'Terminal app for batch resume',
    resumeInPlace: 'Whether to resume in current terminal',
    aliases: 'Command alias mapping',
    autoUpdate: 'Whether to enable auto-update checks',
    conflictResolveMode: 'Merge conflict resolution mode',
    conflictResolveTimeoutMs: 'Claude Code conflict resolution timeout',
  },
  CONFIG_DEFINITIONS: {
    language: { defaultValue: 'en', description: 'Interface language', allowedValues: ['en', 'zh-CN'] },
    autoDeleteBranch: { defaultValue: false, description: 'Whether to auto-delete the local branch when removing a worktree' },
    claudeCodeCommand: { defaultValue: 'claude', description: 'Claude Code CLI launch command' },
    autoPullPush: { defaultValue: false, description: 'Whether to auto-run git pull and git push after merge' },
    confirmDestructiveOps: { defaultValue: true, description: 'Whether to prompt for confirmation before destructive operations' },
    maxConcurrency: { defaultValue: 0, description: 'Default max concurrency for run command, 0 means unlimited' },
    terminalApp: { defaultValue: 'auto', description: 'Terminal app for batch resume', allowedValues: ['auto', 'iterm2', 'terminal'] },
    resumeInPlace: { defaultValue: false, description: 'Whether to resume in current terminal' },
    aliases: { defaultValue: {}, description: 'Command alias mapping' },
    autoUpdate: { defaultValue: true, description: 'Whether to enable auto-update checks' },
    conflictResolveMode: { defaultValue: 'ask', description: 'Merge conflict resolution mode', allowedValues: ['ask', 'auto', 'manual'] },
    conflictResolveTimeoutMs: { defaultValue: 900000, description: 'Claude Code conflict resolution timeout' },
  },
  CONFIG_ALIAS_DISABLED_HINT: '(Manage via clawt alias command)',
  getI18nConfigDescriptions: () => ({
    autoDeleteBranch: 'Whether to auto-delete the local branch when removing a worktree',
    claudeCodeCommand: 'Claude Code CLI launch command',
    autoPullPush: 'Whether to auto-run git pull and git push after merge',
    confirmDestructiveOps: 'Whether to prompt for confirmation before destructive operations',
    maxConcurrency: 'Default max concurrency for run command, 0 means unlimited',
    terminalApp: 'Terminal app for batch resume',
    aliases: 'Command alias mapping',
    autoUpdate: 'Whether to enable auto-update checks',
    resumeInPlace: 'Whether to resume in current terminal',
    conflictResolveMode: 'Merge conflict resolution mode',
    conflictResolveTimeoutMs: 'Claude Code conflict resolution timeout',
    language: 'Interface language',
  }),
  MESSAGES: {
    CONFIG_RESET_SUCCESS: 'Configuration reset to defaults',
    DESTRUCTIVE_OP_CANCELLED: 'Operation cancelled',
    CONFIG_SET_SUCCESS: (key: string, value: string) => `✓ ${key} set to ${value}`,
    CONFIG_GET_VALUE: (key: string, value: string) => `${key} = ${value}`,
    CONFIG_INVALID_KEY: (key: string, validKeys: string[]) =>
      `Invalid config key: ${key}\nAvailable keys: ${validKeys.join(', ')}`,
    CONFIG_INVALID_BOOLEAN: (key: string) =>
      `Config key ${key} is boolean, only true or false accepted`,
    CONFIG_INVALID_NUMBER: (key: string) =>
      `Config key ${key} is number, please enter a valid number`,
    CONFIG_INVALID_ENUM: (key: string, validValues: readonly string[]) =>
      `Config key ${key} only accepts: ${validValues.join(', ')}`,
    CONFIG_SELECT_PROMPT: 'Select a config key to modify',
    CONFIG_INPUT_PROMPT: (key: string) => `Enter new value for ${key}`,
    CONFIG_MISSING_VALUE: (key: string) => `Missing value, usage: clawt config set ${key} <value>`,
    CONFIG_RESET_WARNING: 'This will reset all configuration to defaults',
    NON_INTERACTIVE_CONFIG_EDITOR: 'Cannot edit config in non-interactive mode',
    NOT_SET: '(not set)',
  },
}));

import { registerConfigCommand } from '../../../src/commands/config.js';
import { loadConfig, writeDefaultConfig, saveConfig, printInfo, printSuccess, printError, confirmDestructiveAction } from '../../../src/utils/index.js';

const mockedLoadConfig = vi.mocked(loadConfig);
const mockedWriteDefaultConfig = vi.mocked(writeDefaultConfig);
const mockedSaveConfig = vi.mocked(saveConfig);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintError = vi.mocked(printError);
const mockedConfirmDestructiveAction = vi.mocked(confirmDestructiveAction);

/** 创建默认配置对象用于 mock */
function createMockConfig() {
  return {
    language: 'en' as const,
    autoDeleteBranch: false,
    claudeCodeCommand: 'claude',
    autoPullPush: false,
    confirmDestructiveOps: true,
    maxConcurrency: 0,
    terminalApp: 'auto',
    resumeInPlace: false,
    aliases: {},
    autoUpdate: true,
    conflictResolveMode: 'ask' as const,
    conflictResolveTimeoutMs: 900000,
  };
}

beforeEach(() => {
  mockedLoadConfig.mockReset();
  mockedWriteDefaultConfig.mockReset();
  mockedSaveConfig.mockReset();
  mockedPrintInfo.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintError.mockReset();
  mockedConfirmDestructiveAction.mockReset();
  mockSelectRun.mockReset();
  mockInputRun.mockReset();
  mockSelectConstructorArgs.length = 0;
});

describe('registerConfigCommand', () => {
  it('注册 config 命令及所有子命令', () => {
    const program = new Command();
    registerConfigCommand(program);
    const configCmd = program.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();

    const subcommandNames = configCmd!.commands.map((c) => c.name());
    expect(subcommandNames).toContain('reset');
    expect(subcommandNames).toContain('set');
    expect(subcommandNames).toContain('get');
  });
});

describe('handleConfig（通过 action 间接测试）', () => {
  it('无子命令时进入交互式配置', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());
    // 第一次 Select.run 选择配置项
    mockSelectRun.mockResolvedValueOnce('autoDeleteBranch');
    // 第二次 Select.run 选择布尔值
    mockSelectRun.mockResolvedValueOnce('true');

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config'], { from: 'user' });

    expect(mockedLoadConfig).toHaveBeenCalled();
    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ autoDeleteBranch: true }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});

describe('handleConfigReset（通过 action 间接测试）', () => {
  it('用户确认后恢复默认配置', async () => {
    mockedConfirmDestructiveAction.mockResolvedValue(true);

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'reset'], { from: 'user' });

    expect(mockedWriteDefaultConfig).toHaveBeenCalled();
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('用户取消操作时不写入', async () => {
    mockedConfirmDestructiveAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'reset'], { from: 'user' });

    expect(mockedWriteDefaultConfig).not.toHaveBeenCalled();
    expect(mockedPrintInfo).toHaveBeenCalled();
  });
});

describe('handleConfigSet — 直接模式', () => {
  it('设置布尔值 true', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'autoDeleteBranch', 'true'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ autoDeleteBranch: true }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('设置布尔值 false', async () => {
    mockedLoadConfig.mockReturnValue({ ...createMockConfig(), confirmDestructiveOps: true });

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'confirmDestructiveOps', 'false'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ confirmDestructiveOps: false }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('布尔值无效时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'autoDeleteBranch', 'abc'], { from: 'user' });

    expect(mockedSaveConfig).not.toHaveBeenCalled();
    expect(mockedPrintError).toHaveBeenCalled();
  });

  it('设置数字值', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'maxConcurrency', '4'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ maxConcurrency: 4 }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('数字值无效时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'maxConcurrency', 'abc'], { from: 'user' });

    expect(mockedSaveConfig).not.toHaveBeenCalled();
    expect(mockedPrintError).toHaveBeenCalled();
  });

  it('设置字符串值', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'claudeCodeCommand', 'cc'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ claudeCodeCommand: 'cc' }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('设置 terminalApp 有效值', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'terminalApp', 'iterm2'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ terminalApp: 'iterm2' }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('设置 terminalApp 无效值时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'terminalApp', 'invalid'], { from: 'user' });

    expect(mockedSaveConfig).not.toHaveBeenCalled();
    expect(mockedPrintError).toHaveBeenCalled();
  });

  it('无效 key 时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'foobar', 'true'], { from: 'user' });

    expect(mockedSaveConfig).not.toHaveBeenCalled();
    expect(mockedPrintError).toHaveBeenCalled();
  });

  it('缺少 value 参数时报错', async () => {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set', 'autoDeleteBranch'], { from: 'user' });

    expect(mockedSaveConfig).not.toHaveBeenCalled();
    expect(mockedPrintError).toHaveBeenCalled();
  });
});

describe('handleConfigSet — 交互模式', () => {
  it('交互选择布尔配置项并修改', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());
    // 第一次 Select.run 选择配置项
    mockSelectRun.mockResolvedValueOnce('autoDeleteBranch');
    // 第二次 Select.run 选择布尔值
    mockSelectRun.mockResolvedValueOnce('true');

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ autoDeleteBranch: true }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('交互选择数字配置项并修改', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());
    // 选择配置项
    mockSelectRun.mockResolvedValueOnce('maxConcurrency');
    // 输入数字
    mockInputRun.mockResolvedValueOnce('8');

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ maxConcurrency: 8 }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('交互选择字符串配置项并修改', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());
    // 选择配置项
    mockSelectRun.mockResolvedValueOnce('claudeCodeCommand');
    // 输入字符串
    mockInputRun.mockResolvedValueOnce('cc');

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ claudeCodeCommand: 'cc' }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('交互选择 terminalApp 配置项时使用 Select', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());
    // 选择配置项
    mockSelectRun.mockResolvedValueOnce('terminalApp');
    // 选择 terminalApp 值
    mockSelectRun.mockResolvedValueOnce('iterm2');

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set'], { from: 'user' });

    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ terminalApp: 'iterm2' }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('aliases 选项带 disabled 属性且不可选', async () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());
    // 选择一个普通配置项完成交互流程
    mockSelectRun.mockResolvedValueOnce('autoDeleteBranch');
    mockSelectRun.mockResolvedValueOnce('true');

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    await program.parseAsync(['config', 'set'], { from: 'user' });

    // 捕获第一次 Select 构造参数（配置项选择列表）
    const selectOpts = mockSelectConstructorArgs[0] as { choices: Array<{ name: string; disabled?: string }> };
    const aliasesChoice = selectOpts.choices.find((c) => c.name === 'aliases');
    expect(aliasesChoice).toBeDefined();
    expect(aliasesChoice!.disabled).toBe('(Manage via clawt alias command)');

    // 普通配置项不应有 disabled 属性
    const normalChoice = selectOpts.choices.find((c) => c.name === 'autoDeleteBranch');
    expect(normalChoice).toBeDefined();
    expect(normalChoice!.disabled).toBeUndefined();
  });
});

describe('handleConfigGet', () => {
  it('获取有效配置项的值', () => {
    mockedLoadConfig.mockReturnValue(createMockConfig());

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    program.parse(['config', 'get', 'maxConcurrency'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('获取布尔配置项的值', () => {
    mockedLoadConfig.mockReturnValue({ ...createMockConfig(), autoDeleteBranch: true });

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    program.parse(['config', 'get', 'autoDeleteBranch'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
  });

  it('无效 key 时报错', () => {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    program.parse(['config', 'get', 'invalidKey'], { from: 'user' });

    expect(mockedPrintError).toHaveBeenCalled();
  });
});
