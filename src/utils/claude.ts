import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ClawtError } from '../errors/index.js';
import { APPEND_SYSTEM_PROMPT, CLAUDE_PROJECTS_DIR } from '../constants/index.js';
import { getConfigValue } from './config.js';
import { printInfo, printWarning } from './formatter.js';
import { openCommandInNewTerminalTab } from './terminal.js';
import type { WorktreeInfo } from '../types/index.js';

/**
 * 将路径编码为 Claude Code 项目目录名
 * 规则：将所有非字母数字字符替换为 -（与 Claude Code 源码中的编码逻辑一致）
 * @param {string} absolutePath - 绝对路径
 * @returns {string} 编码后的目录名
 */
function encodeClaudeProjectPath(absolutePath: string): string {
  return absolutePath.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * 检测指定 worktree 路径是否存在 Claude Code 会话历史
 * 通过检查 ~/.claude/projects/<encoded-path>/ 下是否有 .jsonl 文件来判断
 * @param {string} worktreePath - worktree 的绝对路径
 * @returns {boolean} 是否存在会话历史
 */
export function hasClaudeSessionHistory(worktreePath: string): boolean {
  const encodedName = encodeClaudeProjectPath(worktreePath);
  const projectDir = join(CLAUDE_PROJECTS_DIR, encodedName);

  if (!existsSync(projectDir)) {
    return false;
  }

  const entries = readdirSync(projectDir);
  return entries.some((entry) => entry.endsWith('.jsonl'));
}

/**
 * 在指定 worktree 中启动 Claude Code CLI 交互式界面
 * 使用 spawnSync + inherit stdio，让用户直接与 Claude Code 交互
 * @param {WorktreeInfo} worktree - worktree 信息
 */
/**
 * @typedef {Object} LaunchClaudeOptions
 * @property {boolean} [autoContinue] - 是否自动检测历史会话并续接
 */
interface LaunchClaudeOptions {
  /** 是否自动检测历史会话并追加 --continue 参数 */
  autoContinue?: boolean;
}

export function launchInteractiveClaude(worktree: WorktreeInfo, options: LaunchClaudeOptions = {}): void {
  const commandStr = getConfigValue('claudeCodeCommand');
  const parts = commandStr.split(/\s+/).filter(Boolean);
  const cmd = parts[0];
  const args = [
    ...parts.slice(1),
    '--append-system-prompt',
    APPEND_SYSTEM_PROMPT,
  ];

  // 仅在启用 autoContinue 时检测历史会话并追加 --continue
  const hasPreviousSession = options.autoContinue === true && hasClaudeSessionHistory(worktree.path);
  if (hasPreviousSession) {
    args.push('--continue');
  }

  printInfo(`正在 worktree 中启动 Claude Code 交互式界面...`);
  printInfo(`  分支: ${worktree.branch}`);
  printInfo(`  路径: ${worktree.path}`);
  printInfo(`  指令: ${commandStr}`);
  if (options.autoContinue) {
    printInfo(`  模式: ${hasPreviousSession ? '继续上次对话' : '新对话'}`);
  }
  printInfo('');

  const result = spawnSync(cmd, args, {
    cwd: worktree.path,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new ClawtError(`启动 Claude Code 失败: ${result.error.message}`);
  }

  if (result.status !== null && result.status !== 0) {
    printWarning(`Claude Code 退出码: ${result.status}`);
  }
}

/**
 * 转义 shell 单引号
 * 将字符串中的单引号替换为 '\'' 以安全嵌入单引号包裹的 shell 字符串
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeShellSingleQuote(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * 构建在指定 worktree 中启动 Claude Code 的完整 shell 命令
 * 生成格式：cd <path> && <claudeCommand> --append-system-prompt '...' [--continue]
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {boolean} hasPreviousSession - 是否存在历史会话（由调用方预计算，避免重复 I/O）
 * @returns {string} 完整的 shell 命令字符串
 */
export function buildClaudeCommand(worktree: WorktreeInfo, hasPreviousSession: boolean): string {
  const commandStr = getConfigValue('claudeCodeCommand');
  const systemPrompt = APPEND_SYSTEM_PROMPT;

  const escapedPath = escapeShellSingleQuote(worktree.path);
  const escapedPrompt = escapeShellSingleQuote(systemPrompt);
  const continueFlag = hasPreviousSession ? ' --continue' : '';

  return `cd '${escapedPath}' && ${commandStr} --append-system-prompt '${escapedPrompt}'${continueFlag}`;
}

/**
 * 在新终端 Tab 中启动 Claude Code 交互式会话
 * 通过 AppleScript 打开独立终端 Tab，支持 Terminal.app 和 iTerm2
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {boolean} hasPreviousSession - 是否存在历史会话（由调用方预计算，避免重复 I/O）
 */
export function launchInteractiveClaudeInNewTerminal(worktree: WorktreeInfo, hasPreviousSession: boolean): void {
  const command = buildClaudeCommand(worktree, hasPreviousSession);
  const modeLabel = hasPreviousSession ? '继续' : '新对话';
  const tabTitle = `clawt: ${worktree.branch}`;

  openCommandInNewTerminalTab(command, tabTitle);
}
