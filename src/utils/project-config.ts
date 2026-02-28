import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECTS_CONFIG_DIR, MESSAGES } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { getProjectName } from './git.js';
import { ensureDir } from './fs.js';
import type { ProjectConfig } from '../types/index.js';

/**
 * 获取项目配置文件路径
 * @param {string} projectName - 项目名
 * @returns {string} 配置文件路径
 */
export function getProjectConfigPath(projectName: string): string {
  return join(PROJECTS_CONFIG_DIR, projectName, 'config.json');
}

/**
 * 加载当前项目的配置
 * @returns {ProjectConfig | null} 项目配置，不存在时返回 null
 */
export function loadProjectConfig(): ProjectConfig | null {
  const projectName = getProjectName();
  const configPath = getProjectConfigPath(projectName);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ProjectConfig;
  } catch (error) {
    logger.warn(`项目配置文件解析失败: ${error}`);
    return null;
  }
}

/**
 * 保存项目配置
 * @param {ProjectConfig} config - 要保存的项目配置
 */
export function saveProjectConfig(config: ProjectConfig): void {
  const projectName = getProjectName();
  const configPath = getProjectConfigPath(projectName);
  // 确保项目子目录存在
  const projectDir = join(PROJECTS_CONFIG_DIR, projectName);
  ensureDir(projectDir);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  logger.info(`项目配置已保存: ${configPath}`);
}

/**
 * 获取当前项目配置，不存在则抛出错误
 * @returns {ProjectConfig} 项目配置
 */
export function requireProjectConfig(): ProjectConfig {
  const config = loadProjectConfig();
  if (!config) {
    throw new ClawtError(MESSAGES.PROJECT_NOT_INITIALIZED);
  }
  // 校验配置文件中是否包含 clawtMainWorkBranch 字段
  if (!config.clawtMainWorkBranch) {
    throw new ClawtError(MESSAGES.PROJECT_CONFIG_MISSING_BRANCH);
  }
  return config;
}

/**
 * 从项目配置中获取主工作分支名
 * @returns {string} 主工作分支名
 */
export function getMainWorkBranch(): string {
  const config = requireProjectConfig();
  return config.clawtMainWorkBranch;
}
