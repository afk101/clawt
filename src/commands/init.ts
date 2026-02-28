import type { Command } from 'commander';
import { Command as Cmd } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import type { InitOptions } from '../types/index.js';
import {
  validateMainWorktree,
  getCurrentBranch,
  loadProjectConfig,
  saveProjectConfig,
  requireProjectConfig,
  printSuccess,
  printInfo,
  safeStringify,
} from '../utils/index.js';

/**
 * 注册 init 命令：初始化项目级配置，设置主工作分支
 * @param {Command} program - Commander 实例
 */
export function registerInitCommand(program: Command): void {
  const initCmd = program
    .command('init')
    .description('初始化项目级配置，设置主工作分支')
    .option('-b, --branch <branchName>', '指定主工作分支名（默认使用当前分支）')
    .action(async (options: InitOptions) => {
      await handleInit(options);
    });

  // 注册 show 子命令：展示当前项目配置
  initCmd.addCommand(
    new Cmd('show')
      .description('展示当前项目的 init 配置')
      .action(() => {
        handleInitShow();
      }),
  );
}

/**
 * 处理 init show 子命令：以 JSON 格式展示当前项目完整配置
 */
function handleInitShow(): void {
  validateMainWorktree();
  const config = requireProjectConfig();
  const configJson = safeStringify(config);
  printInfo(MESSAGES.INIT_SHOW(configJson));
}

/**
 * 执行 init 命令的核心逻辑
 * 无论是否已初始化，始终执行设置/切换主工作分支
 * 有 -b 参数时：使用指定分支
 * 无 -b 参数时：使用当前分支
 * @param {InitOptions} options - 命令选项
 */
async function handleInit(options: InitOptions): Promise<void> {
  validateMainWorktree();

  const existingConfig = loadProjectConfig();

  // 确定分支名：优先使用 -b 参数，否则使用当前分支
  const branchName = options.branch || getCurrentBranch();

  logger.info(`init 命令执行，主工作分支: ${branchName}`);

  // 保存项目配置
  saveProjectConfig({ clawtMainWorkBranch: branchName });

  if (existingConfig) {
    printSuccess(MESSAGES.INIT_UPDATED(existingConfig.clawtMainWorkBranch, branchName));
  } else {
    printSuccess(MESSAGES.INIT_SUCCESS(branchName));
  }
}
