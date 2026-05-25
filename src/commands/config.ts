import type { Command } from 'commander';
import { DEFAULT_CONFIG, CONFIG_DEFINITIONS, MESSAGES, CONFIG_ALIAS_DISABLED_HINT, getI18nConfigDescriptions } from '../constants/index.js';
import { logger } from '../logger/index.js';
import {
  loadConfig,
  saveConfig,
  writeDefaultConfig,
  printInfo,
  printSuccess,
  printError,
  confirmDestructiveAction,
  isValidConfigKey,
  getValidConfigKeys,
  parseConfigValue,
  interactiveConfigEditor,
} from '../utils/index.js';
import { getCurrentLanguage, resetLanguageCache } from '../utils/i18n.js';

/**
 * 注册 config 命令组：查看和管理全局配置
 * @param {Command} program - Commander 实例
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description(getCurrentLanguage() === 'en' ? 'Interactively view and modify global configuration' : '交互式查看和修改全局配置')
    .action(async () => {
      await handleConfigSet();
    });

  configCmd
    .command('reset')
    .description(getCurrentLanguage() === 'en' ? 'Reset configuration to default values' : '将配置恢复为默认值')
    .action(async () => {
      await handleConfigReset();
    });

  configCmd
    .command('set [key] [value]')
    .description(getCurrentLanguage() === 'en' ? 'Modify configuration (enter interactive mode without arguments)' : '修改配置项（无参数进入交互式配置）')
    .action(async (key?: string, value?: string) => {
      await handleConfigSet(key, value);
    });

  configCmd
    .command('get <key>')
    .description(getCurrentLanguage() === 'en' ? 'Get the value of a single configuration item' : '获取单个配置项的值')
    .action((key: string) => {
      handleConfigGet(key);
    });
}

/**
 * 执行 config reset 子命令的核心逻辑，将配置恢复为默认值
 */
async function handleConfigReset(): Promise<void> {
  logger.info('config reset 命令执行，恢复默认配置');

  const confirmed = await confirmDestructiveAction(
    'config reset',
    MESSAGES.CONFIG_RESET_WARNING,
  );

  if (!confirmed) {
    printInfo(MESSAGES.DESTRUCTIVE_OP_CANCELLED);
    return;
  }

  writeDefaultConfig();
  resetLanguageCache();
  printSuccess(MESSAGES.CONFIG_RESET_SUCCESS);
}

/**
 * 执行 config set 子命令：直接设置或交互式配置
 * @param {string} [key] - 配置项名称（可选，无参数进入交互式）
 * @param {string} [value] - 配置值（可选）
 */
async function handleConfigSet(key?: string, value?: string): Promise<void> {
  // 无参数进入交互式配置
  if (!key) {
    await handleInteractiveConfigSet();
    return;
  }

  // 校验 key 有效性
  if (!isValidConfigKey(key)) {
    printError(MESSAGES.CONFIG_INVALID_KEY(key, getValidConfigKeys()));
    return;
  }

  // 有 key 无 value 时提示缺少参数
  if (value === undefined) {
    printError(MESSAGES.CONFIG_MISSING_VALUE(key));
    return;
  }

  // 解析并校验值
  const result = parseConfigValue(key, value);
  if (!result.success) {
    printError(result.error);
    return;
  }

  // 加载、修改、持久化
  const config = loadConfig();
  (config as unknown as Record<string, unknown>)[key] = result.value;
  saveConfig(config);

  // 语言配置变更时刷新缓存，使后续消息立即使用新语言
  if (key === 'language') {
    resetLanguageCache();
  }

  logger.info(`config set 命令执行，设置 ${key} = ${String(result.value)}`);
  printSuccess(MESSAGES.CONFIG_SET_SUCCESS(key, String(result.value)));
}

/**
 * 交互式配置修改：列出所有配置项供用户选择并修改
 */
async function handleInteractiveConfigSet(): Promise<void> {
  const config = loadConfig();

  logger.info('config set 命令执行，进入交互式配置');

  // 构建对象类型配置项的禁用映射（如 aliases 需通过专用命令管理）
  const disabledKeys: Record<string, string> = {};
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (typeof DEFAULT_CONFIG[k as keyof typeof DEFAULT_CONFIG] === 'object') {
      disabledKeys[k] = CONFIG_ALIAS_DISABLED_HINT;
    }
  }

  // 使用 i18n 后的描述替换 CONFIG_DEFINITIONS 中的中文 description
  const i18nDescriptions = getI18nConfigDescriptions();
  const i18nDefinitions = Object.fromEntries(
    Object.entries(CONFIG_DEFINITIONS).map(([k, def]) => [k, { ...def, description: i18nDescriptions[k as keyof typeof i18nDescriptions] }]),
  ) as typeof CONFIG_DEFINITIONS;

  const { key, newValue } = await interactiveConfigEditor(config, i18nDefinitions, {
    disabledKeys,
  });

  // 持久化并提示成功
  (config as unknown as Record<string, unknown>)[key as string] = newValue;
  saveConfig(config);

  // 语言配置变更时刷新缓存，使后续消息立即使用新语言
  if (key === 'language') {
    resetLanguageCache();
  }

  printSuccess(MESSAGES.CONFIG_SET_SUCCESS(key as string, String(newValue)));
}

/**
 * 执行 config get 子命令：获取单个配置项的值
 * @param {string} key - 配置项名称
 */
function handleConfigGet(key: string): void {
  // 校验 key 有效性
  if (!isValidConfigKey(key)) {
    printError(MESSAGES.CONFIG_INVALID_KEY(key, getValidConfigKeys()));
    return;
  }

  const config = loadConfig();
  const value = config[key];

  logger.info(`config get 命令执行，获取 ${key} = ${String(value)}`);
  printInfo(MESSAGES.CONFIG_GET_VALUE(key, String(value)));
}
