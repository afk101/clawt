import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock node:child_process
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock config
vi.mock('../../../src/utils/config.js', () => ({
  getConfigValue: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  isCmuxEnvironment,
  detectTerminalApp,
  openCommandInNewTerminalTab,
} from '../../../src/utils/terminal.js';
import { getConfigValue } from '../../../src/utils/config.js';

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedGetConfigValue = vi.mocked(getConfigValue);

describe('cmux 环境检测', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 每个测试前重置环境变量
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 测试后恢复原始环境变量
    process.env = originalEnv;
  });

  describe('isCmuxEnvironment', () => {
    it('CMUX_WORKSPACE_ID 存在时返回 true', () => {
      process.env.CMUX_WORKSPACE_ID = '6E83B1B3-5617-43F0-82FB-75F55E9F3F28';
      expect(isCmuxEnvironment()).toBe(true);
    });

    it('CMUX_WORKSPACE_ID 不存在时返回 false', () => {
      delete process.env.CMUX_WORKSPACE_ID;
      expect(isCmuxEnvironment()).toBe(false);
    });
  });
});

describe('终端检测优先级', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('明确配置 cmux 时返回 cmux', () => {
    mockedGetConfigValue.mockReturnValue('cmux');
    expect(detectTerminalApp()).toBe('cmux');
  });

  it('明确配置 iterm2 时返回 iterm2', () => {
    mockedGetConfigValue.mockReturnValue('iterm2');
    expect(detectTerminalApp()).toBe('iterm2');
  });

  it('明确配置 terminal 时返回 terminal', () => {
    mockedGetConfigValue.mockReturnValue('terminal');
    expect(detectTerminalApp()).toBe('terminal');
  });

  it('auto 模式下 cmux 环境优先级最高', () => {
    mockedGetConfigValue.mockReturnValue('auto');
    process.env.CMUX_WORKSPACE_ID = '6E83B1B3-5617-43F0-82FB-75F55E9F3F28'; // 在 cmux 环境中

    expect(detectTerminalApp()).toBe('cmux');
  });

  it('auto 模式下非 cmux 环境降级到 iTerm2', () => {
    mockedGetConfigValue.mockReturnValue('auto');
    mockedExistsSync.mockReturnValue(true); // iTerm2 已安装
    delete process.env.CMUX_WORKSPACE_ID; // 不在 cmux 环境中

    expect(detectTerminalApp()).toBe('iterm2');
  });

  it('auto 模式下无 iTerm2 时降级到 terminal', () => {
    mockedGetConfigValue.mockReturnValue('auto');
    mockedExistsSync.mockReturnValue(false); // iTerm2 未安装
    delete process.env.CMUX_WORKSPACE_ID; // 不在 cmux 环境中

    expect(detectTerminalApp()).toBe('terminal');
  });
});

describe('cmux surface 创建', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('成功创建 surface 并发送命令（简短格式输出）', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CMUX_WORKSPACE_ID = '6E83B1B3-5617-43F0-82FB-75F55E9F3F28';

    mockedGetConfigValue.mockReturnValue('cmux');
    mockedExecFileSync
      .mockReturnValueOnce('surface:24') // new-split 返回简短格式
      .mockReturnValueOnce(''); // send 返回

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).not.toThrow();

    // 验证 new-split 调用
    expect(mockedExecFileSync).toHaveBeenNthCalledWith(
      1,
      'cmux',
      ['new-split', 'right'],
      expect.objectContaining({ timeout: 5000 })
    );

    // 验证 send 调用（包含 \n 以自动执行）
    expect(mockedExecFileSync).toHaveBeenNthCalledWith(
      2,
      'cmux',
      ['send', '--surface', 'surface:24', 'claude\\n'],
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('成功创建 surface 并发送命令（带 OK 前缀输出）', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CMUX_WORKSPACE_ID = '6E83B1B3-5617-43F0-82FB-75F55E9F3F28';

    mockedGetConfigValue.mockReturnValue('cmux');
    mockedExecFileSync
      .mockReturnValueOnce('OK surface:24 pane:14 workspace:5') // new-split 返回带前缀格式
      .mockReturnValueOnce(''); // send 返回

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).not.toThrow();

    // 验证解析正确（包含 \n 以自动执行）
    expect(mockedExecFileSync).toHaveBeenNthCalledWith(
      2,
      'cmux',
      ['send', '--surface', 'surface:24', 'claude\\n'],
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('不在 cmux 环境中时抛出友好错误', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    delete process.env.CMUX_WORKSPACE_ID;

    mockedGetConfigValue.mockReturnValue('cmux');

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).toThrow(
      /当前不在 cmux 环境中/
    );
  });

  it('new-split 输出格式无法解析时抛出错误', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CMUX_WORKSPACE_ID = '6E83B1B3-5617-43F0-82FB-75F55E9F3F28';

    mockedGetConfigValue.mockReturnValue('cmux');
    mockedExecFileSync.mockReturnValueOnce('invalid output format');

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).toThrow(
      /无法解析 cmux new-split 输出/
    );
  });

  it('cmux CLI 执行失败时捕获并抛出错误', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CMUX_WORKSPACE_ID = '6E83B1B3-5617-43F0-82FB-75F55E9F3F28';

    mockedGetConfigValue.mockReturnValue('cmux');
    mockedExecFileSync.mockImplementation(() => {
      const error = new Error('spawn cmux ENOENT');
      throw error;
    });

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).toThrow(
      /在 cmux 中创建 surface 失败/
    );
  });

  it('非 macOS 平台抛出错误', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).toThrow(
      /仅支持 macOS 平台/
    );
  });
});

describe('向后兼容性', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('iTerm2 用户不受影响', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    delete process.env.CMUX_WORKSPACE_ID;

    mockedGetConfigValue.mockReturnValue('iterm2');
    mockedExecFileSync.mockReturnValue('');

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).not.toThrow();

    // 验证使用 osascript 执行 AppleScript
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'osascript',
      expect.arrayContaining([expect.stringContaining('-e')]),
      expect.any(Object)
    );
  });

  it('Terminal.app 用户不受影响', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    delete process.env.CMUX_WORKSPACE_ID;

    mockedGetConfigValue.mockReturnValue('terminal');
    mockedExecFileSync.mockReturnValue('');

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).not.toThrow();

    // 验证使用 osascript 执行 AppleScript
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'osascript',
      expect.arrayContaining([expect.stringContaining('-e')]),
      expect.any(Object)
    );
  });

  it('auto 模式下原有行为不变（无 cmux 环境时）', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    delete process.env.CMUX_WORKSPACE_ID;

    mockedGetConfigValue.mockReturnValue('auto');
    mockedExistsSync.mockReturnValue(true); // iTerm2 已安装
    mockedExecFileSync.mockReturnValue('');

    expect(() => openCommandInNewTerminalTab('claude', 'test-title')).not.toThrow();

    // 验证使用 iTerm2
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'osascript',
      expect.arrayContaining([expect.stringContaining('-e')]),
      expect.any(Object)
    );
  });
});
