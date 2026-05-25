import type { Command } from 'commander';
import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { loadConfig, writeConfig, printInfo, printSuccess, printError, printSeparator } from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 从 Commander 实例动态获取所有已注册的命令名
 * @param {Command} program - Commander 实例
 * @returns {string[]} 已注册的命令名列表
 */
function getRegisteredCommandNames(program: Command): string[] {
  return program.commands.map((cmd) => cmd.name());
}

/**
 * 校验别名名称是否与已注册命令冲突
 * @param {Command} program - Commander 实例
 * @param {string} alias - 别名
 * @returns {boolean} 是否冲突
 */
function isBuiltinCommand(program: Command, alias: string): boolean {
  return getRegisteredCommandNames(program).includes(alias);
}

/**
 * 列出所有已配置的别名
 */
function handleAliasList(): void {
  const config = loadConfig();
  const { aliases } = config;
  const entries = Object.entries(aliases);

  logger.debug('alias list 命令执行，展示别名列表');

  if (entries.length === 0) {
    printInfo(MESSAGES.ALIAS_LIST_EMPTY);
    return;
  }

  printInfo(`\n${MESSAGES.ALIAS_LIST_TITLE}\n`);
  printSeparator();

  for (const [alias, command] of entries) {
    printInfo(`  ${chalk.bold(alias)} → ${chalk.cyan(command)}`);
  }

  printInfo('');
  printSeparator();
}

/**
 * 设置命令别名
 * @param {Command} program - Commander 实例
 * @param {string} alias - 别名
 * @param {string} command - 目标命令名
 */
function handleAliasSet(program: Command, alias: string, command: string): void {
  logger.debug(`alias set 命令执行，别名: ${alias}，目标: ${command}`);

  // 校验别名不能与内置命令冲突
  if (isBuiltinCommand(program, alias)) {
    printError(MESSAGES.ALIAS_CONFLICTS_BUILTIN(alias));
    return;
  }

  // 校验目标命令必须是已注册的内置命令
  if (!isBuiltinCommand(program, command)) {
    printError(MESSAGES.ALIAS_TARGET_NOT_FOUND(command));
    return;
  }

  const config = loadConfig();
  config.aliases[alias] = command;
  writeConfig(config);

  printSuccess(MESSAGES.ALIAS_SET_SUCCESS(alias, command));
}

/**
 * 移除命令别名
 * @param {string} alias - 要移除的别名
 */
function handleAliasRemove(alias: string): void {
  logger.debug(`alias remove 命令执行，别名: ${alias}`);

  const config = loadConfig();

  if (!(alias in config.aliases)) {
    printError(MESSAGES.ALIAS_NOT_FOUND(alias));
    return;
  }

  delete config.aliases[alias];
  writeConfig(config);

  printSuccess(MESSAGES.ALIAS_REMOVE_SUCCESS(alias));
}

/**
 * 注册 alias 命令组：管理命令别名
 * @param {Command} program - Commander 实例
 */
export function registerAliasCommand(program: Command): void {
  const aliasCmd = program
    .command('alias')
    .description(getCurrentLanguage() === 'en' ? 'Manage command aliases (list / set / remove)' : '管理命令别名（列出 / 设置 / 移除）')
    .action(() => {
      handleAliasList();
    });

  aliasCmd
    .command('list')
    .description(getCurrentLanguage() === 'en' ? 'List all aliases' : '列出所有别名')
    .action(() => {
      handleAliasList();
    });

  aliasCmd
    .command('set <alias> <command>')
    .description(getCurrentLanguage() === 'en' ? 'Set a command alias' : '设置命令别名')
    .action((alias: string, command: string) => {
      handleAliasSet(program, alias, command);
    });

  aliasCmd
    .command('remove <alias>')
    .description(getCurrentLanguage() === 'en' ? 'Remove a command alias' : '移除命令别名')
    .action((alias: string) => {
      handleAliasRemove(alias);
    });
}
