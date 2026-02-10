import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_PATH, CLAWT_HOME, LOGS_DIR, WORKTREES_DIR, DEFAULT_CONFIG } from '../constants/index.js';
import { ensureDir } from './fs.js';
import type { ClawtConfig } from '../types/index.js';

/**
 * 加载全局配置，不存在则返回默认配置
 * @returns {ClawtConfig} 配置对象
 */
export function loadConfig(): ClawtConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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
