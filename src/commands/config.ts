import type { Command } from 'commander';
import chalk from 'chalk';
import Enquirer from 'enquirer';
import { DEFAULT_CONFIG, CONFIG_DESCRIPTIONS, MESSAGES } from '../constants/index.js';
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
  promptConfigValue,
  formatConfigValue,
} from '../utils/index.js';
import type { ClawtConfig } from '../types/index.js';

/**
 * 注册 config 命令组：查看和管理全局配置
 * @param {Command} program - Commander 实例
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('交互式查看和修改全局配置')
    .action(async () => {
      await handleConfigSet();
    });

  configCmd
    .command('reset')
    .description('将配置恢复为默认值')
    .action(async () => {
      await handleConfigReset();
    });

  configCmd
    .command('set [key] [value]')
    .description('修改配置项（无参数进入交互式配置）')
    .action(async (key?: string, value?: string) => {
      await handleConfigSet(key, value);
    });

  configCmd
    .command('get <key>')
    .description('获取单个配置项的值')
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
    '当前配置将被覆盖为默认值',
  );

  if (!confirmed) {
    printInfo(MESSAGES.DESTRUCTIVE_OP_CANCELLED);
    return;
  }

  writeDefaultConfig();
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

  logger.info(`config set 命令执行，设置 ${key} = ${String(result.value)}`);
  printSuccess(MESSAGES.CONFIG_SET_SUCCESS(key, String(result.value)));
}

/**
 * 交互式配置修改：列出所有配置项供用户选择并修改
 */
async function handleInteractiveConfigSet(): Promise<void> {
  const config = loadConfig();
  const keys = Object.keys(DEFAULT_CONFIG) as Array<keyof ClawtConfig>;

  logger.info('config set 命令执行，进入交互式配置');

  // 构建选择列表，显示配置项名称、当前值和描述
  const choices = keys.map((k) => ({
    name: k,
    message: `${k}: ${formatConfigValue(config[k])}  ${chalk.dim(`— ${CONFIG_DESCRIPTIONS[k]}`)}`,
  }));

  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const selectedKey: keyof ClawtConfig = await new Enquirer.Select({
    message: MESSAGES.CONFIG_SELECT_PROMPT,
    choices,
  }).run();

  // 根据类型和 allowedValues 自动选择提示策略
  const currentValue = config[selectedKey];
  const newValue = await promptConfigValue(selectedKey, currentValue);

  // 持久化并提示成功
  (config as unknown as Record<string, unknown>)[selectedKey] = newValue;
  saveConfig(config);

  printSuccess(MESSAGES.CONFIG_SET_SUCCESS(selectedKey, String(newValue)));
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
