import { resolve, dirname, join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import { MESSAGES, TASK_TEMPLATE_OUTPUT_DIR, TASK_TEMPLATE_FILENAME_PREFIX, TASK_TEMPLATE_CONTENT } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { printSuccess, printHint, ensureDir, generateTaskFilename } from '../utils/index.js';

/**
 * 注册 tasks 命令组及其子命令
 * @param {Command} program - Commander 实例
 */
export function registerTasksCommand(program: Command): void {
  const taskCmd = program
    .command('tasks')
    .description('任务文件管理');

  taskCmd
    .command('init')
    .description('生成任务模板文件')
    .argument('[path]', '输出文件路径')
    .action(async (path?: string) => {
      // 未指定路径时，默认输出到 .clawt/tasks/ 目录下
      const filePath = path ?? join(TASK_TEMPLATE_OUTPUT_DIR, generateTaskFilename(TASK_TEMPLATE_FILENAME_PREFIX));
      await handleTasksInit(filePath);
    });
}

/**
 * 处理 tasks init 子命令：生成任务模板文件
 * @param {string} filePath - 输出文件路径
 */
async function handleTasksInit(filePath: string): Promise<void> {
  const absolutePath = resolve(filePath);

  logger.info(`tasks init 命令执行，目标文件: ${absolutePath}`);

  // 检查文件是否已存在
  if (existsSync(absolutePath)) {
    throw new ClawtError(MESSAGES.TASK_INIT_FILE_EXISTS(filePath));
  }

  // 确保父目录存在
  ensureDir(dirname(absolutePath));

  // 写入模板内容
  writeFileSync(absolutePath, TASK_TEMPLATE_CONTENT, 'utf-8');

  printSuccess(MESSAGES.TASK_INIT_SUCCESS(filePath));
  printHint(MESSAGES.TASK_INIT_HINT(filePath));
}
