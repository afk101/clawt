import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// mock 依赖模块
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/utils/index.js', () => ({
  loadConfig: vi.fn(),
  writeDefaultConfig: vi.fn(),
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printSeparator: vi.fn(),
  confirmDestructiveAction: vi.fn(),
}));

vi.mock('../../../src/constants/index.js', () => ({
  CONFIG_PATH: '/mock/.clawt/config.json',
  DEFAULT_CONFIG: {
    claudeCodeCommand: 'claude',
    autoDeleteBranch: false,
    autoPullPush: false,
    confirmDestructiveOps: true,
  },
  CONFIG_DESCRIPTIONS: {
    claudeCodeCommand: 'Claude Code CLI 命令',
    autoDeleteBranch: '自动删除分支',
    autoPullPush: '自动 pull/push',
    confirmDestructiveOps: '破坏性操作确认',
  },
  MESSAGES: {
    CONFIG_RESET_SUCCESS: '配置已恢复为默认值',
    DESTRUCTIVE_OP_CANCELLED: '已取消操作',
  },
}));

import { registerConfigCommand } from '../../../src/commands/config.js';
import { loadConfig, writeDefaultConfig, printInfo, printSuccess, confirmDestructiveAction } from '../../../src/utils/index.js';

const mockedLoadConfig = vi.mocked(loadConfig);
const mockedWriteDefaultConfig = vi.mocked(writeDefaultConfig);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedConfirmDestructiveAction = vi.mocked(confirmDestructiveAction);

beforeEach(() => {
  mockedLoadConfig.mockReset();
  mockedWriteDefaultConfig.mockReset();
  mockedPrintInfo.mockReset();
  mockedPrintSuccess.mockReset();
  mockedConfirmDestructiveAction.mockReset();
});

describe('registerConfigCommand', () => {
  it('注册 config 命令和 config reset 子命令', () => {
    const program = new Command();
    registerConfigCommand(program);
    const configCmd = program.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();
    const resetCmd = configCmd!.commands.find((c) => c.name() === 'reset');
    expect(resetCmd).toBeDefined();
  });
});

describe('handleConfig（通过 action 间接测试）', () => {
  it('展示配置列表', () => {
    mockedLoadConfig.mockReturnValue({
      claudeCodeCommand: 'claude',
      autoDeleteBranch: false,
      autoPullPush: false,
      confirmDestructiveOps: true,
    });

    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    program.parse(['config'], { from: 'user' });

    expect(mockedLoadConfig).toHaveBeenCalled();
    // 应输出配置信息
    expect(mockedPrintInfo).toHaveBeenCalled();
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
