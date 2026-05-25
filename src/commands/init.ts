import type { Command } from 'commander';
import { Command as Cmd } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES, PROJECT_CONFIG_DEFINITIONS, getI18nProjectConfigDescriptions } from '../constants/index.js';
import type { InitOptions, InitShowOptions, ProjectConfig } from '../types/index.js';
import {
  runPreChecks,
  validateHeadExists,
  getCurrentBranch,
  loadProjectConfig,
  saveProjectConfig,
  requireProjectConfig,
  printSuccess,
  interactiveConfigEditor,
  safeStringify,
  normalizeProjectConfig,
} from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 注册 init 命令：初始化项目级配置，设置主工作分支
 * @param {Command} program - Commander 实例
 */
export function registerInitCommand(program: Command): void {
  const initCmd = program
    .command('init')
    .description(getCurrentLanguage() === 'en' ? 'Initialize project configuration and set the main work branch' : '初始化项目级配置，设置主工作分支')
    .option('-b, --branch <branchName>', getCurrentLanguage() === 'en' ? 'Specify the main work branch name (defaults to current branch)' : '指定主工作分支名（默认使用当前分支）')
    .action(async (options: InitOptions) => {
      await handleInit(options);
    });

  // 注册 show 子命令：交互式查看和修改项目配置（支持 --json 格式输出）
  initCmd.addCommand(
    new Cmd('show')
      .description(getCurrentLanguage() === 'en' ? 'Interactively view and modify project configuration (supports --json output)' : '交互式查看和修改项目配置（支持 --json 格式输出）')
      .option('--json', getCurrentLanguage() === 'en' ? 'Output in JSON format' : '以 JSON 格式输出')
      .action(async (options: InitShowOptions) => {
        await handleInitShow(options);
      }),
  );
}

/**
 * 处理 init show 子命令：交互式面板展示和修改项目配置
 * @param {InitShowOptions} options - 子命令选项
 */
async function handleInitShow(options: InitShowOptions): Promise<void> {
  await runPreChecks({ requireMainWorktree: true, requireProjectConfig: true });
  const config = requireProjectConfig();

  // --json 模式：直接输出 JSON 格式配置，跳过交互式流程
  if (options.json) {
    printInitShowAsJson(config);
    return;
  }

  logger.info('init show 命令执行，进入交互式项目配置');

  // 使用 i18n 后的描述替换 PROJECT_CONFIG_DEFINITIONS 中的中文 description
  const i18nDescriptions = getI18nProjectConfigDescriptions();
  const i18nDefinitions = Object.fromEntries(
    Object.entries(PROJECT_CONFIG_DEFINITIONS).map(([k, def]) => [k, { ...def, description: i18nDescriptions[k as keyof typeof i18nDescriptions] }]),
  ) as typeof PROJECT_CONFIG_DEFINITIONS;

  const { key, newValue } = await interactiveConfigEditor(
    config as Required<ProjectConfig>,
    i18nDefinitions,
    { selectPrompt: MESSAGES.INIT_SELECT_PROMPT },
  );

  // 合并修改后的值并持久化
  const mergedConfig: ProjectConfig = { ...config, [key]: newValue };
  const updatedConfig = normalizeProjectConfig(mergedConfig, key as string, newValue);
  saveProjectConfig(updatedConfig);

  printSuccess(MESSAGES.INIT_SET_SUCCESS(key as string, String(newValue)));
}

/**
 * 以 JSON 格式输出项目配置
 * @param {ProjectConfig} config - 项目配置对象
 */
function printInitShowAsJson(config: ProjectConfig): void {
  console.log(safeStringify({ ...config }));
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

  // 合并现有配置，仅更新 clawtMainWorkBranch
  const updatedConfig: ProjectConfig = {
    ...existingConfig,
    clawtMainWorkBranch: branchName,
  };
  saveProjectConfig(updatedConfig);

  if (existingConfig) {
    printSuccess(MESSAGES.INIT_UPDATED(existingConfig.clawtMainWorkBranch, branchName));
  } else {
    printSuccess(MESSAGES.INIT_SUCCESS(branchName));
  }
}
