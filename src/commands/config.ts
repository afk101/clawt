import type { Command } from 'commander';
import chalk from 'chalk';
import { CONFIG_PATH, DEFAULT_CONFIG, CONFIG_DESCRIPTIONS } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { loadConfig, printInfo, printSeparator } from '../utils/index.js';
import type { ClawtConfig } from '../types/index.js';

/**
 * 注册 config 命令：查看全局配置
 * @param {Command} program - Commander 实例
 */
export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('查看全局配置')
    .action(() => {
      handleConfig();
    });
}

/**
 * 执行 config 命令的核心逻辑，读取并展示配置列表
 */
function handleConfig(): void {
  const config = loadConfig();

  logger.info('config 命令执行，展示全局配置');

  printInfo(`\n${chalk.dim('配置文件路径:')} ${CONFIG_PATH}\n`);
  printSeparator();

  const keys = Object.keys(DEFAULT_CONFIG) as Array<keyof ClawtConfig>;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = config[key];
    const description = CONFIG_DESCRIPTIONS[key];
    const formattedValue = formatConfigValue(value);

    // 第一个配置项前增加空行，与下横线前的空行对称
    if (i === 0) printInfo('');
    printInfo(`  ${chalk.bold(key)}: ${formattedValue}`);
    printInfo(`  ${chalk.dim(description)}`);
    // 配置项之间及最后一项与下横线之间保持统一空行间距
    printInfo('');
  }

  printSeparator();
}

/**
 * 格式化配置值的显示样式
 * @param {ClawtConfig[keyof ClawtConfig]} value - 配置值
 * @returns {string} 格式化后的字符串
 */
function formatConfigValue(value: ClawtConfig[keyof ClawtConfig]): string {
  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.yellow('false');
  }
  return chalk.cyan(String(value));
}
