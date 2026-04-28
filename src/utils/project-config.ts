import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECTS_CONFIG_DIR, MESSAGES, PROJECT_CONFIG_DEFINITIONS } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { getProjectName, checkBranchExists } from './git.js';
import { ensureDir } from './fs.js';
import { getConfigValue } from './config.js';
import { safeStringify } from './json.js';
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
  writeFileSync(configPath, safeStringify({ ...config }, 2), 'utf-8');
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

/**
 * 守卫检测：仅验证配置中的主工作分支是否存在
 * 分支不存在 → 抛出 ClawtError（致命错误）
 * 适用于不需要分支一致性检测的场景（如 home 命令）
 * @param {string} [cwd] - 工作目录
 */
export function guardMainWorkBranchExists(cwd?: string): void {
  const config = requireProjectConfig();
  const mainBranch = config.clawtMainWorkBranch;

  if (!checkBranchExists(mainBranch, cwd)) {
    throw new ClawtError(MESSAGES.GUARD_BRANCH_NOT_EXISTS(mainBranch));
  }
}

/**
 * 从项目配置中获取 validate 成功后自动执行的命令
 * @returns {string | undefined} 配置的命令字符串，未配置时返回 undefined
 */
export function getValidateRunCommand(): string | undefined {
  const config = loadProjectConfig();
  return config?.validateRunCommand || undefined;
}

/**
 * 解析当前项目生效的 Claude Code 启动指令
 * 优先级：项目级配置 > 全局配置
 * @returns {string} 生效的 Claude Code 启动指令
 */
export function resolveClaudeCodeCommand(): string {
  const projectConfig = loadProjectConfig();
  if (projectConfig?.claudeCodeCommand) {
    return projectConfig.claudeCodeCommand;
  }
  return getConfigValue('claudeCodeCommand');
}

/**
 * 归一化项目配置：可选字段的空字符串等同于未设置，从对象中删除该键
 * 保持 JSON 文件整洁，避免出现 "field": "" 的冗余条目
 * @param {ProjectConfig} config - 原始项目配置
 * @param {string} key - 被修改的配置项键名
 * @param {unknown} value - 被修改的配置项新值
 * @returns {ProjectConfig} 归一化后的项目配置
 */
export function normalizeProjectConfig(config: ProjectConfig, key: string, value: unknown): ProjectConfig {
  if (value === '') {
    const def = PROJECT_CONFIG_DEFINITIONS[key as keyof typeof PROJECT_CONFIG_DEFINITIONS];
    if (def?.defaultValue === undefined) {
      const normalized = { ...config };
      delete (normalized as unknown as Record<string, unknown>)[key];
      return normalized;
    }
  }
  return config;
}
