import type { ClawtConfig, ConfigDefinitions } from '../types/index.js';
import { VALID_TERMINAL_APPS } from './terminal.js';

/** Claude Code 系统约束提示，禁止代码执行完成后构建项目验证 */
export const APPEND_SYSTEM_PROMPT =
  'After the code execution is completed, it is prohibited to build the project for verification.';

/**
 * 配置项完整定义（单一数据源）
 * 新增配置项时只需在此处维护，DEFAULT_CONFIG 和 CONFIG_DESCRIPTIONS 会自动同步
 */
export const CONFIG_DEFINITIONS: ConfigDefinitions = {
  autoDeleteBranch: {
    defaultValue: false,
    description: '移除 worktree 时是否自动删除对应本地分支',
  },
  claudeCodeCommand: {
    defaultValue: 'claude',
    description: 'Claude Code CLI 启动指令',
  },
  autoPullPush: {
    defaultValue: false,
    description: 'merge 成功后是否自动执行 git pull 和 git push',
  },
  confirmDestructiveOps: {
    defaultValue: true,
    description: '执行破坏性操作（reset、validate --clean）前是否提示确认',
  },
  maxConcurrency: {
    defaultValue: 0,
    description: 'run 命令默认最大并发数，0 表示不限制',
  },
  terminalApp: {
    defaultValue: 'auto',
    description: '批量 resume 使用的终端应用：auto（自动检测）、iterm2、terminal（macOS）',
    allowedValues: VALID_TERMINAL_APPS,
  },
  aliases: {
    defaultValue: {} as Record<string, string>,
    description: '命令别名映射',
  },
};

/**
 * 从 CONFIG_DEFINITIONS 派生默认配置
 * @param {ConfigDefinitions} definitions - 配置项完整定义
 * @returns {ClawtConfig} 默认配置对象
 */
function deriveDefaultConfig(definitions: ConfigDefinitions): ClawtConfig {
  const entries = Object.entries(definitions).map(
    ([key, def]) => [key, def.defaultValue],
  );
  return Object.fromEntries(entries) as ClawtConfig;
}

/**
 * 从 CONFIG_DEFINITIONS 派生配置项描述映射
 * @param {ConfigDefinitions} definitions - 配置项完整定义
 * @returns {Record<keyof ClawtConfig, string>} 配置项描述映射
 */
function deriveConfigDescriptions(definitions: ConfigDefinitions): Record<keyof ClawtConfig, string> {
  const entries = Object.entries(definitions).map(
    ([key, def]) => [key, def.description],
  );
  return Object.fromEntries(entries) as Record<keyof ClawtConfig, string>;
}

/** 默认配置 */
export const DEFAULT_CONFIG: ClawtConfig = deriveDefaultConfig(CONFIG_DEFINITIONS);

/** 配置项描述映射 */
export const CONFIG_DESCRIPTIONS: Record<keyof ClawtConfig, string> = deriveConfigDescriptions(CONFIG_DEFINITIONS);
