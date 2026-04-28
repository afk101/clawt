import type { ProjectConfig, ProjectConfigDefinitions } from '../types/index.js';

/**
 * 项目级配置项完整定义（单一数据源）
 * 新增项目配置项时只需在此处维护，PROJECT_DEFAULT_CONFIG 和 PROJECT_CONFIG_DESCRIPTIONS 会自动同步
 */
export const PROJECT_CONFIG_DEFINITIONS: ProjectConfigDefinitions = {
  clawtMainWorkBranch: {
    defaultValue: '',
    description: '主 worktree 的工作分支名',
  },
  validateRunCommand: {
    defaultValue: undefined as unknown as string | undefined,
    description: 'validate 成功后自动执行的命令（-r 的默认值）',
  },
  postCreate: {
    defaultValue: undefined as unknown as string | undefined,
    description: 'worktree 创建后自动执行的命令，用于安装依赖等初始化操作',
  },
  claudeCodeCommand: {
    defaultValue: undefined as unknown as string | undefined,
    description: 'Claude Code CLI 启动指令（未设置时回退到全局配置）',
  },
};

/**
 * 从 PROJECT_CONFIG_DEFINITIONS 派生默认配置
 * @param {ProjectConfigDefinitions} definitions - 项目配置项完整定义
 * @returns {Required<ProjectConfig>} 默认项目配置对象
 */
function deriveDefaultConfig(definitions: ProjectConfigDefinitions): Required<ProjectConfig> {
  const entries = Object.entries(definitions).map(
    ([key, def]) => [key, def.defaultValue],
  );
  return Object.fromEntries(entries) as Required<ProjectConfig>;
}

/**
 * 从 PROJECT_CONFIG_DEFINITIONS 派生配置项描述映射
 * @param {ProjectConfigDefinitions} definitions - 项目配置项完整定义
 * @returns {Record<keyof Required<ProjectConfig>, string>} 配置项描述映射
 */
function deriveConfigDescriptions(definitions: ProjectConfigDefinitions): Record<keyof Required<ProjectConfig>, string> {
  const entries = Object.entries(definitions).map(
    ([key, def]) => [key, def.description],
  );
  return Object.fromEntries(entries) as Record<keyof Required<ProjectConfig>, string>;
}

/** 项目默认配置 */
export const PROJECT_DEFAULT_CONFIG: Required<ProjectConfig> = deriveDefaultConfig(PROJECT_CONFIG_DEFINITIONS);

/** 项目配置项描述映射 */
export const PROJECT_CONFIG_DESCRIPTIONS: Record<keyof Required<ProjectConfig>, string> = deriveConfigDescriptions(PROJECT_CONFIG_DEFINITIONS);
