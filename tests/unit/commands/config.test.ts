import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// mock enquirer（必须在所有 import 之前）
const { mockSelectRun, mockInputRun } = vi.hoisted(() => {
  const mockSelectRun = vi.fn();
  const mockInputRun = vi.fn();
  return { mockSelectRun, mockInputRun };
});

vi.mock('enquirer', () => ({
  default: {
    Select: function MockSelect() { return { run: mockSelectRun }; },
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
  };
});

vi.mock('../../../src/constants/index.js', () => ({
  CONFIG_PATH: '/mock/.clawt/config.json',
  DEFAULT_CONFIG: {
    autoDeleteBranch: false,
    claudeCodeCommand: 'claude',
    autoPullPush: false,
    confirmDestructiveOps: true,
    maxConcurrency: 0,
    terminalApp: 'auto',
  },
  CONFIG_DESCRIPTIONS: {
    autoDeleteBranch: '自动删除分支',
    claudeCodeCommand: 'Claude Code CLI 命令',
    autoPullPush: '自动 pull/push',
    confirmDestructiveOps: '破坏性操作确认',
    maxConcurrency: '最大并发数',
    terminalApp: '终端应用',
  },
  CONFIG_DEFINITIONS: {
    autoDeleteBranch: { defaultValue: false, description: '自动删除分支' },
    claudeCodeCommand: { defaultValue: 'claude', description: 'Claude Code CLI 命令' },
    autoPullPush: { defaultValue: false, description: '自动 pull/push' },
    confirmDestructiveOps: { defaultValue: true, description: '破坏性操作确认' },
    maxConcurrency: { defaultValue: 0, description: '最大并发数' },
    terminalApp: { defaultValue: 'auto', description: '终端应用', allowedValues: ['auto', 'iterm2', 'terminal'] },
  },
  MESSAGES: {
    CONFIG_RESET_SUCCESS: '配置已恢复为默认值',
    DESTRUCTIVE_OP_CANCELLED: '已取消操作',
    CONFIG_SET_SUCCESS: (key: string, value: string) => `✓ ${key} 已设置为 ${value}`,
    CONFIG_GET_VALUE: (key: string, value: string) => `${key} = ${value}`,
    CONFIG_INVALID_KEY: (key: string, validKeys: string[]) =>
      `无效的配置项: ${key}\n可用的配置项: ${validKeys.join(', ')}`,
    CONFIG_INVALID_BOOLEAN: (key: string) =>
      `配置项 ${key} 为布尔类型，仅接受 true 或 false`,
    CONFIG_INVALID_NUMBER: (key: string) =>
      `配置项 ${key} 为数字类型，请输入有效的数字`,
    CONFIG_INVALID_ENUM: (key: string, validValues: readonly string[]) =>
      `配置项 ${key} 仅接受以下值: ${validValues.join(', ')}`,
    CONFIG_SELECT_PROMPT: '选择要修改的配置项',
    CONFIG_INPUT_PROMPT: (key: string) => `输入 ${key} 的新值`,
    CONFIG_MISSING_VALUE: (key: string) => `缺少配置值，用法: clawt config set ${key} <value>`,
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
    autoDeleteBranch: false,
    claudeCodeCommand: 'claude',
    autoPullPush: false,
    confirmDestructiveOps: true,
    maxConcurrency: 0,
    terminalApp: 'auto',
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
