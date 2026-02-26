/**
 * 自动补全引擎核心逻辑
 * 提供文件路径补全、特殊参数补全、命令树遍历等功能
 */

import { Command } from 'commander';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

import { getProjectWorktrees } from './worktree.js';
import { CONFIG_DEFINITIONS } from '../constants/config.js';

/**
 * 补全文件路径，支持子目录递归浏览
 * 根据用户已输入的部分路径，列出匹配的文件和子目录
 * @param {string} partial - 用户当前输入的部分路径
 * @returns {string[]} 匹配的候选路径列表
 */
export function completeFilePath(partial: string): string[] {
  const cwd = process.cwd();
  // 判断输入是否包含目录前缀（如 "tasks/" 或 "tasks/my"）
  const hasDir = partial.includes('/');
  const searchDir = hasDir ? join(cwd, dirname(partial)) : cwd;
  const prefix = hasDir ? basename(partial) : partial;

  if (!existsSync(searchDir)) {
    return [];
  }

  const entries = readdirSync(searchDir);
  const results: string[] = [];
  // 相对路径前缀，用于拼接输出
  const dirPrefix = hasDir ? dirname(partial) + '/' : '';

  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    // 跳过隐藏文件和目录
    if (entry.startsWith('.')) continue;

    const fullPath = join(searchDir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        // 目录：返回带尾部斜杠的路径，便于用户继续补全
        results.push(dirPrefix + entry + '/');
      } else if (stat.isFile()) {
        // 文件：直接作为候选项（不限制后缀，与 clawt run -f 行为一致）
        results.push(dirPrefix + entry);
      }
    } catch {
      // 忽略无法访问的文件（权限不足等）
    }
  }

  return results;
}

/**
 * 尝试对特殊参数进行动态补全（分支名、文件路径、配置键）
 * 如果当前上下文匹配某种特殊参数，则直接输出候选项并返回 true
 * @param {string} previousWord - 当前光标前一个词
 * @param {string} currentWord - 当前正在输入的词
 * @param {string[]} words - 完整的命令行词数组
 * @returns {boolean} 是否已处理该补全
 */
export function tryCompleteSpecialArg(previousWord: string, currentWord: string, words: string[]): boolean {
  // 分支名补全
  if (previousWord === '-b' || previousWord === '--branch') {
    try {
      const worktrees = getProjectWorktrees();
      const branches = worktrees.map(wt => wt.branch);
      console.log(branches.filter(b => b.startsWith(currentWord)).join('\n'));
    } catch {
      // 忽略可能的异常，例如非 git 仓库环境
    }
    return true;
  }

  // 文件路径补全
  if (previousWord === '-f' || previousWord === '--file') {
    try {
      const candidates = completeFilePath(currentWord);
      console.log(candidates.join('\n'));
    } catch {
      // 忽略可能的读取异常
    }
    return true;
  }

  // config set/get 配置键补全
  if (previousWord === 'set' || previousWord === 'get') {
    if (words.includes('config')) {
      const keys = Object.keys(CONFIG_DEFINITIONS);
      console.log(keys.filter(k => k.startsWith(currentWord)).join('\n'));
      return true;
    }
  }

  return false;
}

/**
 * 根据命令树遍历当前层级，生成子命令和选项候选项
 * @param {Command} program - 根命令实例
 * @param {string[]} words - 完整的命令行词数组
 * @param {number} cword - 当前光标所在词的索引
 * @param {string} currentWord - 当前正在输入的词
 */
export function completeFromCommandTree(program: Command, words: string[], cword: number, currentWord: string): void {
  // 根据当前输入的命令上下文查找对应的 Commander.js 命令层级
  let currentCmd = program;
  for (let i = 1; i < cword; i++) {
    const word = words[i];
    const subCmd = currentCmd.commands.find(c => c.name() === word || c.aliases().includes(word));
    if (subCmd) {
      currentCmd = subCmd;
    }
  }

  const completions: string[] = [];

  // 如果当前正在输入选项，则提供该层级的可用选项
  if (currentWord.startsWith('-')) {
    currentCmd.options.forEach(opt => {
      if (opt.short && opt.short.startsWith(currentWord)) completions.push(opt.short);
      if (opt.long && opt.long.startsWith(currentWord)) completions.push(opt.long);
    });
  } else {
    // 否则提供该层级的可用子命令
    currentCmd.commands.forEach(cmd => {
      const name = cmd.name();
      if (name !== '_complete' && name.startsWith(currentWord)) {
        completions.push(name);
        cmd.aliases().forEach(alias => {
          if (alias.startsWith(currentWord)) {
            completions.push(alias);
          }
        });
      }
    });

    // 也提供可以接在命令后面的选项名（作为候选）
    if (!currentWord) {
      currentCmd.options.forEach(opt => {
        if (opt.long) completions.push(opt.long);
        else if (opt.short) completions.push(opt.short);
      });
    }
  }

  // 输出结果（去重并用换行符分隔）
  console.log(Array.from(new Set(completions)).join('\n'));
}

/**
 * 执行动态补全逻辑并输出候选项
 * @param {Command} program - 根命令实例
 * @param {string[]} args - 传递的上下文参数 (shell, cword, ...words)
 */
export function generateCompletions(program: Command, args: string[]): void {
  // args 格式预估: [shell, cword, word0, word1, ..., currentWord]
  const cword = parseInt(args[1], 10);
  const words = args.slice(2);
  const currentWord = words[cword] || '';
  const previousWord = cword > 0 ? words[cword - 1] : '';

  // 1. 尝试特殊参数动态补全
  if (tryCompleteSpecialArg(previousWord, currentWord, words)) {
    return;
  }

  // 2. 从命令树生成子命令和选项候选项
  completeFromCommandTree(program, words, cword, currentWord);
}
