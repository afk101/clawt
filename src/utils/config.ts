import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_PATH, CLAWT_HOME, LOGS_DIR, WORKTREES_DIR, DEFAULT_CONFIG, MESSAGES, PROJECTS_CONFIG_DIR } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { ensureDir } from './fs.js';
import { logger } from '../logger/index.js';
import type { ClawtConfig } from '../types/index.js';

/**
 * 加载全局配置，不存在则返回默认配置
 * 配置文件损坏或无法解析时，视为不存在，重新生成默认配置
 * @returns {ClawtConfig} 配置对象
 */
export function loadConfig(): ClawtConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    // 配置文件损坏或无法解析时，重新生成默认配置
    logger.warn(MESSAGES.CONFIG_CORRUPTED);
    writeDefaultConfig();
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 将指定配置对象写入配置文件
 * @param {ClawtConfig} config - 要写入的完整配置对象
 */
export function writeConfig(config: ClawtConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 将默认配置写入配置文件
 */
export function writeDefaultConfig(): void {
  writeConfig(DEFAULT_CONFIG);
}

/**
 * 将配置对象完整写入配置文件
 * @param {ClawtConfig} config - 要持久化的配置对象
 */
export function saveConfig(config: ClawtConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 获取配置中指定字段的值
 * @param {keyof ClawtConfig} key - 配置字段名
 * @returns {ClawtConfig[keyof ClawtConfig]} 配置值
 */
export function getConfigValue<K extends keyof ClawtConfig>(key: K): ClawtConfig[K] {
  const config = loadConfig();
  return config[key];
}

/**
 * 确保 clawt 全局目录结构存在
 */
export function ensureClawtDirs(): void {
  ensureDir(CLAWT_HOME);
  ensureDir(LOGS_DIR);
  ensureDir(WORKTREES_DIR);
  ensureDir(PROJECTS_CONFIG_DIR);
}

/**
 * 解析并发数参数
 * 优先级：命令行参数 > 全局配置 > 默认值 0
 * @param {string | undefined} optionValue - 命令行传入的并发数字符串
 * @param {number} configValue - 全局配置中的默认并发数
 * @returns {number} 解析后的并发数，0 表示不限制
 */
export function parseConcurrency(optionValue: string | undefined, configValue: number): number {
  if (optionValue === undefined) {
    return configValue;
  }

  const parsed = parseInt(optionValue, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new ClawtError(MESSAGES.CONCURRENCY_INVALID);
  }
  return parsed;
}
