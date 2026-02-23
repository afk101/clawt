import type { Command } from 'commander';
import type { ClawtConfig } from '../types/index.js';
import { logger } from '../logger/index.js';

/**
 * 根据配置中的别名映射，为已注册的命令添加 Commander.js 别名
 * @param {Command} program - Commander 实例
 * @param {ClawtConfig['aliases']} aliases - 别名映射
 */
export function applyAliases(program: Command, aliases: ClawtConfig['aliases']): void {
  for (const [alias, commandName] of Object.entries(aliases)) {
    const targetCmd = program.commands.find((cmd) => cmd.name() === commandName);
    if (targetCmd) {
      targetCmd.alias(alias);
      logger.debug(`已注册别名: ${alias} → ${commandName}`);
    } else {
      logger.warn(`别名 "${alias}" 的目标命令 "${commandName}" 不存在，已跳过`);
    }
  }
}
