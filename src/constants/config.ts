import type { ClawtConfig, ConfigDefinitions } from '../types/index.js';
import { VALID_TERMINAL_APPS } from './terminal.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 通过 clawt 启动的 Claude Code 非交互式会话（claude -p）的 entrypoint 标识
 * 设置为 'cli' 使 claude -p 启动的会话可以通过 --continue 恢复
 */
export const CLAUDE_CODE_ENTRYPOINT_VALUE = 'cli';

/**
 * 配置项完整定义（单一数据源）
 * 新增配置项时只需在此处维护，DEFAULT_CONFIG 和 CONFIG_DESCRIPTIONS 会自动同步
 */
export const CONFIG_DEFINITIONS: ConfigDefinitions = {
  language: {
    defaultValue: 'en',
    description: '界面语言：en（英文）、zh-CN（中文）',
    allowedValues: ['en', 'zh-CN'] as const,
  },
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
    description: '批量 resume 使用的终端应用：auto（自动检测）、iterm2、terminal、cmux（macOS）',
    allowedValues: VALID_TERMINAL_APPS,
  },
  resumeInPlace: {
    defaultValue: false,
    description: 'resume 单选时是否在当前终端就地打开，false 则通过 terminalApp 在新 Tab 中打开',
  },
  aliases: {
    defaultValue: {} as Record<string, string>,
    description: '命令别名映射',
  },
  autoUpdate: {
    defaultValue: true,
    description: '是否启用自动更新检查（每 24 小时检查一次 npm registry）',
  },
  conflictResolveMode: {
    defaultValue: 'ask',
    description: 'merge 冲突时的解决模式：ask（询问是否使用 AI）、auto（自动 AI 解决）、manual（手动解决）',
    allowedValues: ['ask', 'auto', 'manual'] as const,
  },
  conflictResolveTimeoutMs: {
    defaultValue: 900000,
    description: 'Claude Code 冲突解决超时时间（毫秒），默认 900000（15 分钟）',
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

/** 配置项英文描述映射 */
const CONFIG_DESCRIPTIONS_EN: Record<keyof ClawtConfig, string> = {
  language: 'Interface language: en (English), zh-CN (Chinese)',
  autoDeleteBranch: 'Whether to auto-delete the local branch when removing a worktree',
  claudeCodeCommand: 'Claude Code CLI launch command',
  autoPullPush: 'Whether to auto-run git pull and git push after merge',
  confirmDestructiveOps: 'Whether to prompt for confirmation before destructive operations (reset, validate --clean)',
  maxConcurrency: 'Default max concurrency for run command, 0 means unlimited',
  terminalApp: 'Terminal app for batch resume: auto (auto-detect), iterm2, terminal, cmux (macOS)',
  resumeInPlace: 'Whether to resume in current terminal (single select), false opens in new tab via terminalApp',
  aliases: 'Command alias mapping',
  autoUpdate: 'Whether to enable auto-update checks (every 24 hours via npm registry)',
  conflictResolveMode: 'Merge conflict resolution mode: ask (prompt for AI), auto (auto AI resolve), manual (manual resolve)',
  conflictResolveTimeoutMs: 'Claude Code conflict resolution timeout (ms), default 900000 (15 min)',
};

/**
 * 获取国际化配置项描述映射
 * @returns {Record<keyof ClawtConfig, string>} 当前语言的配置项描述映射
 */
export function getI18nConfigDescriptions(): Record<keyof ClawtConfig, string> {
  return getCurrentLanguage() === 'en' ? CONFIG_DESCRIPTIONS_EN : CONFIG_DESCRIPTIONS;
}
