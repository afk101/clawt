import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_PATH, CLAWT_HOME, LOGS_DIR, WORKTREES_DIR, DEFAULT_CONFIG, MESSAGES } from '../constants/index.js';
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
}
