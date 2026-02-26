import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

import { MESSAGES } from '../constants/messages/index.js';
import { printSuccess, printInfo, printWarning, printError } from '../utils/index.js';
import { getBashScript, getZshScript } from '../utils/completion-scripts.js';
import { generateCompletions } from '../utils/completion-engine.js';

/**
 * 向文件中追加内容（如果不存在），或者创建新文件
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 要写入的文本内容
 */
function appendToFile(filePath: string, content: string): void {
  if (existsSync(filePath)) {
    const current = readFileSync(filePath, 'utf-8');
    if (current.includes('clawt completion')) {
      printInfo(MESSAGES.COMPLETION_INSTALL_EXISTS + ': ' + filePath);
      return;
    }
    content = current + content;
  }
  writeFileSync(filePath, content, 'utf-8');
  printSuccess(MESSAGES.COMPLETION_INSTALL_SUCCESS + ': ' + filePath);
  printInfo(MESSAGES.COMPLETION_INSTALL_RESTART(filePath));
}

/**
 * 自动安装补全脚本到用户的环境变量
 */
function installCompletions(): void {
  const shell = process.env.SHELL || '';
  const home = homedir();

  try {
    if (shell.includes('zsh')) {
      const rcPath = resolve(home, '.zshrc');
      const script = `\n# clawt completion\nsource <(clawt completion zsh)\n`;
      appendToFile(rcPath, script);
    } else if (shell.includes('bash')) {
      const rcPath = resolve(home, '.bashrc');
      // bash 3.2（macOS 默认版本）中 source <(...) 在子 shell 执行，complete 注册无法传递回父 shell
      // 使用 eval "$(...)" 确保在当前 shell 中执行
      const script = `\n# clawt completion\neval "$(clawt completion bash)"\n`;
      appendToFile(rcPath, script);
    } else {
      printWarning(MESSAGES.COMPLETION_INSTALL_UNKNOWN_SHELL);
    }
  } catch (error) {
    const filePath = shell.includes('zsh')
      ? resolve(home, '.zshrc')
      : resolve(home, '.bashrc');
    printError(MESSAGES.COMPLETION_INSTALL_WRITE_ERROR(filePath));
  }
}

/**
 * 注册自动补全命令
 * @param {Command} program - 根命令实例
 */
export function registerCompletionCommand(program: Command): void {
  const completionCommand = program
    .command('completion')
    .description(MESSAGES.COMPLETION_COMMAND_DESC);

  completionCommand
    .command('bash')
    .description(MESSAGES.COMPLETION_BASH_DESC)
    .action(() => {
      console.log(getBashScript());
    });

  completionCommand
    .command('zsh')
    .description(MESSAGES.COMPLETION_ZSH_DESC)
    .action(() => {
      console.log(getZshScript());
    });

  completionCommand
    .command('install')
    .description(MESSAGES.COMPLETION_INSTALL_DESC)
    .action(() => {
      installCompletions();
    });

  completionCommand
    .command('_complete [args...]')
    .allowUnknownOption()
    .description('内部使用的动态补全方法，不对外公开')
    .action((args: string[]) => {
      // args 中包含了: shell, cword, ...words
      if (!args || args.length < 2) return;
      generateCompletions(program, args);
    });
}
