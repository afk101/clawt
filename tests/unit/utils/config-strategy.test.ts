import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...original,
    DEFAULT_CONFIG: {
      autoDeleteBranch: false,
      claudeCodeCommand: 'claude',
      autoPullPush: false,
      confirmDestructiveOps: true,
      maxConcurrency: 0,
      terminalApp: 'auto',
      autoUpdate: true,
    },
    CONFIG_DEFINITIONS: {
      autoDeleteBranch: { defaultValue: false, description: '自动删除分支' },
      claudeCodeCommand: { defaultValue: 'claude', description: 'Claude Code CLI 命令' },
      autoPullPush: { defaultValue: false, description: '自动 pull/push' },
      confirmDestructiveOps: { defaultValue: true, description: '破坏性操作确认' },
      maxConcurrency: { defaultValue: 0, description: '最大并发数' },
      terminalApp: { defaultValue: 'auto', description: '终端应用', allowedValues: ['auto', 'iterm2', 'terminal'] },
      autoUpdate: { defaultValue: true, description: '自动更新' },
    },
    MESSAGES: {
      CONFIG_INVALID_BOOLEAN: (key: string) =>
        `配置项 ${key} 为布尔类型，仅接受 true 或 false`,
      CONFIG_INVALID_NUMBER: (key: string) =>
        `配置项 ${key} 为数字类型，请输入有效的数字`,
      CONFIG_INVALID_ENUM: (key: string, validValues: readonly string[]) =>
        `配置项 ${key} 仅接受以下值: ${validValues.join(', ')}`,
      CONFIG_INPUT_PROMPT: (key: string) => `输入 ${key} 的新值`,
    },
  };
});

import {
  isValidConfigKey,
  getValidConfigKeys,
  parseConfigValue,
  promptConfigValue,
  formatConfigValue,
} from '../../../src/utils/config-strategy.js';

beforeEach(() => {
  mockSelectRun.mockReset();
  mockInputRun.mockReset();
});

describe('isValidConfigKey', () => {
  it('有效 key 返回 true', () => {
    expect(isValidConfigKey('autoDeleteBranch')).toBe(true);
    expect(isValidConfigKey('maxConcurrency')).toBe(true);
    expect(isValidConfigKey('terminalApp')).toBe(true);
  });

  it('无效 key 返回 false', () => {
    expect(isValidConfigKey('foobar')).toBe(false);
    expect(isValidConfigKey('')).toBe(false);
    expect(isValidConfigKey('AUTODELETE')).toBe(false);
  });
});

describe('getValidConfigKeys', () => {
  it('返回所有配置项名称', () => {
    const keys = getValidConfigKeys();
    expect(keys).toContain('autoDeleteBranch');
    expect(keys).toContain('claudeCodeCommand');
    expect(keys).toContain('autoPullPush');
    expect(keys).toContain('confirmDestructiveOps');
    expect(keys).toContain('maxConcurrency');
    expect(keys).toContain('terminalApp');
    expect(keys).toContain('autoUpdate');
    expect(keys).toHaveLength(7);
  });
});

describe('parseConfigValue', () => {
  describe('布尔类型策略', () => {
    it('解析 "true" 为 true', () => {
      const result = parseConfigValue('autoDeleteBranch', 'true');
      expect(result).toEqual({ success: true, value: true });
    });

    it('解析 "false" 为 false', () => {
      const result = parseConfigValue('autoDeleteBranch', 'false');
      expect(result).toEqual({ success: true, value: false });
    });

    it('无效布尔值返回错误', () => {
      const result = parseConfigValue('autoDeleteBranch', 'abc');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('布尔类型');
      }
    });
  });

  describe('数字类型策略', () => {
    it('解析有效数字', () => {
      const result = parseConfigValue('maxConcurrency', '4');
      expect(result).toEqual({ success: true, value: 4 });
    });

    it('解析 0', () => {
      const result = parseConfigValue('maxConcurrency', '0');
      expect(result).toEqual({ success: true, value: 0 });
    });

    it('无效数字返回错误', () => {
      const result = parseConfigValue('maxConcurrency', 'abc');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('数字类型');
      }
    });
  });

  describe('字符串 + 有 allowedValues 策略（枚举）', () => {
    it('有效枚举值通过校验', () => {
      const result = parseConfigValue('terminalApp', 'iterm2');
      expect(result).toEqual({ success: true, value: 'iterm2' });
    });

    it('所有枚举值均可接受', () => {
      expect(parseConfigValue('terminalApp', 'auto')).toEqual({ success: true, value: 'auto' });
      expect(parseConfigValue('terminalApp', 'terminal')).toEqual({ success: true, value: 'terminal' });
    });

    it('无效枚举值返回错误', () => {
      const result = parseConfigValue('terminalApp', 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('仅接受以下值');
      }
    });
  });

  describe('字符串 + 无 allowedValues 策略（自由输入）', () => {
    it('任意字符串值通过校验', () => {
      const result = parseConfigValue('claudeCodeCommand', 'cc');
      expect(result).toEqual({ success: true, value: 'cc' });
    });

    it('空字符串也通过校验', () => {
      const result = parseConfigValue('claudeCodeCommand', '');
      expect(result).toEqual({ success: true, value: '' });
    });
  });
});

describe('promptConfigValue', () => {
  it('布尔类型使用 Select 提示', async () => {
    mockSelectRun.mockResolvedValueOnce('true');
    const result = await promptConfigValue('autoDeleteBranch', false);
    expect(result).toBe(true);
    expect(mockSelectRun).toHaveBeenCalledTimes(1);
  });

  it('数字类型使用 Input 提示', async () => {
    mockInputRun.mockResolvedValueOnce('8');
    const result = await promptConfigValue('maxConcurrency', 0);
    expect(result).toBe(8);
    expect(mockInputRun).toHaveBeenCalledTimes(1);
  });

  it('字符串 + 有 allowedValues 使用 Select 提示', async () => {
    mockSelectRun.mockResolvedValueOnce('iterm2');
    const result = await promptConfigValue('terminalApp', 'auto');
    expect(result).toBe('iterm2');
    expect(mockSelectRun).toHaveBeenCalledTimes(1);
  });

  it('字符串 + 无 allowedValues 使用 Input 提示', async () => {
    mockInputRun.mockResolvedValueOnce('cc');
    const result = await promptConfigValue('claudeCodeCommand', 'claude');
    expect(result).toBe('cc');
    expect(mockInputRun).toHaveBeenCalledTimes(1);
  });
});

describe('formatConfigValue', () => {
  it('true 显示为绿色', () => {
    const result = formatConfigValue(true);
    expect(result).toContain('true');
  });

  it('false 显示为黄色', () => {
    const result = formatConfigValue(false);
    expect(result).toContain('false');
  });

  it('数字显示为 cyan', () => {
    const result = formatConfigValue(42);
    expect(result).toContain('42');
  });

  it('字符串显示为 cyan', () => {
    const result = formatConfigValue('hello');
    expect(result).toContain('hello');
  });
});
