/**
 * postinstall 脚本：npm 全局安装后初始化 ~/.clawt/ 目录
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG, CLAWT_HOME, CONFIG_PATH, LOGS_DIR, WORKTREES_DIR } from '../src/constants/index.js';

/**
 * 确保目录存在，不存在则递归创建
 * @param {string} dirPath - 目录路径
 */
function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 读取已有的用户配置文件，解析失败时返回 null
 * @param {string} configPath - 配置文件路径
 * @returns {Record<string, unknown> | null} 解析后的配置对象，失败返回 null
 */
function loadExistingConfig(configPath: string): Record<string, unknown> | null {
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 将用户配置与默认配置合并：
 * - 新版本新增的 key → 使用默认值补充
 * - 用户已有的 key → 保留用户值不覆盖
 * - 新版本已移除的 key → 从用户配置中删除
 * @param {Record<string, unknown>} existing - 用户已有配置
 * @param {Record<string, unknown>} defaults - 新版本默认配置
 * @returns {Record<string, unknown>} 合并后的配置对象
 */
function mergeConfig(
  existing: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  // 以默认配置的 key 为基准，保留用户已有值，补充新增默认值
  for (const key of Object.keys(defaults)) {
    merged[key] = key in existing ? existing[key] : defaults[key];
  }

  // 默认配置中不存在的 key 不会被带入，即完成了旧配置的清理

  return merged;
}

/**
 * 写入配置文件并输出提示
 * @param {string} configPath - 配置文件路径
 * @param {Record<string, unknown>} config - 配置对象
 * @param {string} message - 输出的提示信息
 */
function writeConfig(configPath: string, config: Record<string, unknown>, message: string): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(message);
}

/**
 * 同步配置文件：不存在则创建，已存在则合并
 * @param {string} configPath - 配置文件路径
 * @param {Record<string, unknown>} defaultConfig - 默认配置
 */
function syncConfig(configPath: string, defaultConfig: Record<string, unknown>): void {
  const existing = loadExistingConfig(configPath);

  if (!existing) {
    writeConfig(configPath, defaultConfig, `✓ 已创建默认配置文件: ${configPath}`);
    return;
  }

  const merged = mergeConfig(existing, defaultConfig);

  // 仅在配置发生变化时才写入
  if (JSON.stringify(existing) !== JSON.stringify(merged)) {
    writeConfig(configPath, merged, `✓ 已更新配置文件: ${configPath}`);
  }
}

/**
 * 初始化 ~/.clawt/ 目录结构和默认配置
 */
function init(): void {
  ensureDirectory(CLAWT_HOME);
  ensureDirectory(LOGS_DIR);
  ensureDirectory(WORKTREES_DIR);

  syncConfig(CONFIG_PATH, DEFAULT_CONFIG as unknown as Record<string, unknown>);

  console.log('✓ clawt 初始化完成');
}

init();
