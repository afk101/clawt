import type { Command } from 'commander';
import { Command as Cmd } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES, PROJECT_CONFIG_DEFINITIONS } from '../constants/index.js';
import type { InitOptions, ProjectConfig } from '../types/index.js';
import {
  runPreChecks,
  validateHeadExists,
  getCurrentBranch,
  loadProjectConfig,
  saveProjectConfig,
  requireProjectConfig,
  printSuccess,
  interactiveConfigEditor,
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

  // 注册 show 子命令：交互式查看和修改项目配置
  initCmd.addCommand(
    new Cmd('show')
      .description('交互式查看和修改项目配置')
      .action(async () => {
        await handleInitShow();
      }),
  );
}

/**
 * 处理 init show 子命令：交互式面板展示和修改项目配置
 */
async function handleInitShow(): Promise<void> {
  await runPreChecks({ requireMainWorktree: true, requireProjectConfig: true });
  const config = requireProjectConfig();

  logger.info('init show 命令执行，进入交互式项目配置');

  const { key, newValue } = await interactiveConfigEditor(
    config as Required<ProjectConfig>,
    PROJECT_CONFIG_DEFINITIONS,
    { selectPrompt: MESSAGES.INIT_SELECT_PROMPT },
  );

  // 合并修改后的值并持久化
  const updatedConfig: ProjectConfig = { ...config, [key]: newValue };
  saveProjectConfig(updatedConfig);

  printSuccess(MESSAGES.INIT_SET_SUCCESS(key as string, String(newValue)));
}

/**
 * 执行 init 命令的核心逻辑
 * 无论是否已初始化，始终执行设置/切换主工作分支
 * 有 -b 参数时：使用指定分支
 * 无 -b 参数时：使用当前分支
 * @param {InitOptions} options - 命令选项
 */
async function handleInit(options: InitOptions): Promise<void> {
  await runPreChecks({ requireMainWorktree: true });

  const existingConfig = loadProjectConfig();

  // 确定分支名：优先使用 -b 参数，否则使用当前分支
  if (!options.branch) {
    validateHeadExists();
  }
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
