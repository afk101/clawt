import { createRequire } from 'node:module';
import { Command } from 'commander';
import { ClawtError } from './errors/index.js';
import { logger, enableConsoleTransport } from './logger/index.js';
import { EXIT_CODES } from './constants/index.js';
import { printError, ensureClawtDirs, loadConfig, applyAliases, checkForUpdates } from './utils/index.js';
import { registerListCommand } from './commands/list.js';
import { registerCreateCommand } from './commands/create.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerRunCommand } from './commands/run.js';
import { registerResumeCommand } from './commands/resume.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerMergeCommand } from './commands/merge.js';
import { registerConfigCommand } from './commands/config.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerResetCommand } from './commands/reset.js';
import { registerStatusCommand } from './commands/status.js';
import { registerAliasCommand } from './commands/alias.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerCompletionCommand } from './commands/completion.js';
import { registerInitCommand } from './commands/init.js';

// 从 package.json 读取版本号，避免硬编码
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

// 确保全局目录结构存在
ensureClawtDirs();

const program = new Command();

program
  .name('clawt')
  .description('本地并行执行多个Claude Code Agent任务，融合 Git Worktree 与 Claude Code CLI 的命令行工具')
  .version(version)
  .option('--debug', '输出详细调试信息到终端');

// 在子命令 action 执行前检查 --debug 选项，按需启用控制台日志
program.hook('preAction', (thisCommand) => {
  if (thisCommand.opts().debug) {
    enableConsoleTransport();
  }
});

// 注册所有命令
registerListCommand(program);
registerCreateCommand(program);
registerRemoveCommand(program);
registerRunCommand(program);
registerResumeCommand(program);
registerValidateCommand(program);
registerMergeCommand(program);
registerConfigCommand(program);
registerSyncCommand(program);
registerResetCommand(program);
registerStatusCommand(program);
registerAliasCommand(program);
registerProjectsCommand(program);
registerCompletionCommand(program);
registerInitCommand(program);

// 加载配置并应用命令别名
const config = loadConfig();
applyAliases(program, config.aliases);

// 全局未捕获异常处理
process.on('uncaughtException', (error) => {
  if (error instanceof ClawtError) {
    printError(error.message);
    logger.error(error.message);
    process.exit(error.exitCode);
  }
  printError(error.message || '未知错误');
  logger.error(`未捕获异常: ${error.message}\n${error.stack}`);
  process.exit(EXIT_CODES.ERROR);
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  if (error instanceof ClawtError) {
    printError(error.message);
    logger.error(error.message);
    process.exit(error.exitCode);
  }
  printError(error.message || '未知错误');
  logger.error(`未处理的 Promise 拒绝: ${error.message}`);
  process.exit(EXIT_CODES.ERROR);
});

/**
 * 异步主入口函数
 * 执行命令解析后，根据配置项决定是否进行自动更新检查
 */
async function main(): Promise<void> {
  await program.parseAsync(process.argv);

  if (config.autoUpdate) {
    await checkForUpdates(version);
  }
}

main();
