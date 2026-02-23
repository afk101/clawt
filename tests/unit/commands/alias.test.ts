import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// mock 依赖模块
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/utils/index.js', () => ({
  loadConfig: vi.fn(),
  writeConfig: vi.fn(),
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printSeparator: vi.fn(),
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    ALIAS_LIST_EMPTY: '(无别名)',
    ALIAS_LIST_TITLE: '当前别名列表：',
    ALIAS_SET_SUCCESS: (a: string, c: string) => `✓ 已设置别名: ${a} → ${c}`,
    ALIAS_REMOVE_SUCCESS: (a: string) => `✓ 已移除别名: ${a}`,
    ALIAS_NOT_FOUND: (a: string) => `别名 "${a}" 不存在`,
    ALIAS_CONFLICTS_BUILTIN: (a: string) => `别名 "${a}" 与内置命令冲突，不允许覆盖内置命令`,
    ALIAS_TARGET_NOT_FOUND: (c: string) => `目标命令 "${c}" 不存在，请指定已注册的内置命令名`,
  },
}));

import { registerAliasCommand } from '../../../src/commands/alias.js';
import { loadConfig, writeConfig, printInfo, printSuccess, printError } from '../../../src/utils/index.js';

const mockedLoadConfig = vi.mocked(loadConfig);
const mockedWriteConfig = vi.mocked(writeConfig);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintError = vi.mocked(printError);

beforeEach(() => {
  vi.clearAllMocks();
});

/** 构造默认配置 mock 数据 */
function mockDefaultConfig(aliases: Record<string, string> = {}) {
  return {
    autoDeleteBranch: false,
    claudeCodeCommand: 'claude',
    autoPullPush: false,
    confirmDestructiveOps: true,
    maxConcurrency: 0,
    terminalApp: 'auto',
    aliases,
  };
}

describe('registerAliasCommand', () => {
  it('注册 alias 命令及 list/set/remove 子命令', () => {
    const program = new Command();
    registerAliasCommand(program);
    const aliasCmd = program.commands.find((c) => c.name() === 'alias');
    expect(aliasCmd).toBeDefined();
    expect(aliasCmd!.commands.find((c) => c.name() === 'list')).toBeDefined();
    expect(aliasCmd!.commands.find((c) => c.name() === 'set')).toBeDefined();
    expect(aliasCmd!.commands.find((c) => c.name() === 'remove')).toBeDefined();
  });
});

describe('alias list（通过 action 间接测试）', () => {
  it('无别名时展示空提示', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig());

    const program = new Command();
    program.exitOverride();
    registerAliasCommand(program);
    program.parse(['alias'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalledWith('(无别名)');
  });

  it('通过 alias list 子命令展示别名列表', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig({ ls: 'list', rm: 'remove' }));

    const program = new Command();
    program.exitOverride();
    registerAliasCommand(program);
    program.parse(['alias', 'list'], { from: 'user' });

    // 应展示列表标题
    expect(mockedPrintInfo).toHaveBeenCalled();
    const calls = mockedPrintInfo.mock.calls.map((c) => c[0]);
    // 至少有一个调用包含别名信息
    expect(calls.some((c) => typeof c === 'string' && c.includes('ls'))).toBe(true);
  });
});

describe('alias set（通过 action 间接测试）', () => {
  it('别名与内置命令冲突时报错', () => {
    const program = new Command();
    program.exitOverride();
    program.command('list').action(() => {});
    registerAliasCommand(program);
    program.parse(['alias', 'set', 'list', 'create'], { from: 'user' });

    expect(mockedPrintError).toHaveBeenCalled();
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('目标命令不存在时报错', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig());

    const program = new Command();
    program.exitOverride();
    registerAliasCommand(program);
    program.parse(['alias', 'set', 'ls', 'nonexistent'], { from: 'user' });

    expect(mockedPrintError).toHaveBeenCalled();
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('正常设置别名', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig());

    const program = new Command();
    program.exitOverride();
    program.command('list').action(() => {});
    registerAliasCommand(program);
    program.parse(['alias', 'set', 'ls', 'list'], { from: 'user' });

    expect(mockedWriteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        aliases: { ls: 'list' },
      }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('覆盖已有别名', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig({ ls: 'list' }));

    const program = new Command();
    program.exitOverride();
    program.command('list').action(() => {});
    program.command('status').action(() => {});
    registerAliasCommand(program);
    program.parse(['alias', 'set', 'ls', 'status'], { from: 'user' });

    expect(mockedWriteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        aliases: { ls: 'status' },
      }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});

describe('alias remove（通过 action 间接测试）', () => {
  it('别名不存在时报错', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig());

    const program = new Command();
    program.exitOverride();
    registerAliasCommand(program);
    program.parse(['alias', 'remove', 'nonexistent'], { from: 'user' });

    expect(mockedPrintError).toHaveBeenCalled();
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('正常移除别名', () => {
    mockedLoadConfig.mockReturnValue(mockDefaultConfig({ ls: 'list' }));

    const program = new Command();
    program.exitOverride();
    registerAliasCommand(program);
    program.parse(['alias', 'remove', 'ls'], { from: 'user' });

    expect(mockedWriteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        aliases: {},
      }),
    );
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});
