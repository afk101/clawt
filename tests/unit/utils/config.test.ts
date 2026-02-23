import { describe, it, expect, vi } from 'vitest';

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock fs 工具
vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfig, getConfigValue, writeDefaultConfig, writeConfig, saveConfig, ensureClawtDirs, parseConcurrency } from '../../../src/utils/config.js';
import { DEFAULT_CONFIG } from '../../../src/constants/index.js';
import { ensureDir } from '../../../src/utils/fs.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedEnsureDir = vi.mocked(ensureDir);

describe('loadConfig', () => {
  it('配置文件不存在时返回默认配置', () => {
    mockedExistsSync.mockReturnValue(false);
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('配置文件存在时正确合并', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ autoDeleteBranch: true }));
    const config = loadConfig();
    expect(config.autoDeleteBranch).toBe(true);
    // 未覆盖的字段保持默认值
    expect(config.claudeCodeCommand).toBe(DEFAULT_CONFIG.claudeCodeCommand);
  });

  it('配置文件损坏时返回默认配置并重写', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('invalid json {{{');
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    // 应该重写默认配置
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });
});

describe('getConfigValue', () => {
  it('获取指定 key 的值', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ autoPullPush: true }));
    expect(getConfigValue('autoPullPush')).toBe(true);
  });

  it('未设置时返回默认值', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(getConfigValue('confirmDestructiveOps')).toBe(true);
  });
});

describe('writeDefaultConfig', () => {
  it('将默认配置写入配置文件', () => {
    writeDefaultConfig();
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(DEFAULT_CONFIG, null, 2),
      'utf-8',
    );
  });
});

describe('writeConfig', () => {
  it('将指定配置写入配置文件', () => {
    const customConfig = { ...DEFAULT_CONFIG, aliases: { ls: 'list' } };
    writeConfig(customConfig);
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(customConfig, null, 2),
      'utf-8',
    );
  });
});

describe('ensureClawtDirs', () => {
  it('确保三个全局目录存在', () => {
    ensureClawtDirs();
    expect(mockedEnsureDir).toHaveBeenCalledTimes(3);
  });
});

describe('parseConcurrency', () => {
  it('命令行参数 undefined 时返回配置值', () => {
    expect(parseConcurrency(undefined, 5)).toBe(5);
  });

  it('命令行参数为有效正整数时返回解析值', () => {
    expect(parseConcurrency('3', 0)).toBe(3);
  });

  it('命令行参数为 0 时返回 0（不限制）', () => {
    expect(parseConcurrency('0', 5)).toBe(0);
  });

  it('命令行参数为负数时抛出错误', () => {
    expect(() => parseConcurrency('-1', 0)).toThrow();
  });

  it('命令行参数为非数字时抛出错误', () => {
    expect(() => parseConcurrency('abc', 0)).toThrow();
  });
});

describe('saveConfig', () => {
  it('将配置对象写入配置文件', () => {
    const customConfig = { ...DEFAULT_CONFIG, autoDeleteBranch: true };
    saveConfig(customConfig);
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(customConfig, null, 2),
      'utf-8',
    );
  });
});
