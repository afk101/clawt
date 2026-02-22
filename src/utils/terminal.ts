import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { VALID_TERMINAL_APPS, ITERM2_APP_PATH } from '../constants/index.js';
import { getConfigValue } from './config.js';

/** 终端应用类型 */
type TerminalApp = 'iterm2' | 'terminal';

/**
 * 检测系统是否安装了 iTerm2
 * 通过检查 /Applications/iTerm.app 是否存在来判断
 * @returns {boolean} 是否安装了 iTerm2
 */
function isITerm2Installed(): boolean {
  return existsSync(ITERM2_APP_PATH);
}

/**
 * 检测当前使用的终端应用
 * 优先读取配置项 terminalApp；值为 'auto' 时优先检测 iTerm2 是否已安装，
 * 已安装则使用 iTerm2，否则降级到 Terminal.app
 * @returns {TerminalApp} 终端类型：'iterm2' 或 'terminal'
 */
export function detectTerminalApp(): TerminalApp {
  const configured = getConfigValue('terminalApp');

  // 配置了明确的终端类型，直接使用
  if (configured === 'iterm2' || configured === 'terminal') {
    return configured;
  }

  // 配置值无效时给出警告（auto 除外）
  if (!VALID_TERMINAL_APPS.includes(configured)) {
    logger.warn(`terminalApp 配置值 "${configured}" 无效，有效值: ${VALID_TERMINAL_APPS.join(', ')}，将使用自动检测`);
  }

  // auto 模式：优先检测 iTerm2 是否已安装
  if (isITerm2Installed()) {
    return 'iterm2';
  }
  return 'terminal';
}

/**
 * 转义 AppleScript 字符串中的特殊字符
 * 将反斜杠和双引号进行转义，防止注入
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeAppleScriptString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 构建 Terminal.app 的 AppleScript 脚本
 * 在当前窗口新建 Tab 并执行命令
 * @param {string} command - 要执行的 shell 命令
 * @param {string} title - Tab 标题
 * @returns {string} AppleScript 脚本内容
 */
function buildTerminalAppleScript(command: string, title: string): string {
  const escapedCommand = escapeAppleScriptString(command);
  const escapedTitle = escapeAppleScriptString(title);
  return `
tell application "Terminal"
  activate
  tell application "System Events" to tell process "Terminal" to keystroke "t" using command down
  delay 0.3
  do script "${escapedCommand}" in front window's selected tab
  set custom title of front window's selected tab to "${escapedTitle}"
end tell
  `.trim();
}

/**
 * 构建 iTerm2 的 AppleScript 脚本
 * 在当前窗口新建 Tab 并执行命令
 * @param {string} command - 要执行的 shell 命令
 * @param {string} title - Tab 标题
 * @returns {string} AppleScript 脚本内容
 */
function buildITermAppleScript(command: string, title: string): string {
  const escapedCommand = escapeAppleScriptString(command);
  const escapedTitle = escapeAppleScriptString(title);
  return `
tell application "iTerm"
  activate
  tell current window
    create tab with default profile
    tell current session
      set name to "${escapedTitle}"
      write text "${escapedCommand}"
    end tell
  end tell
end tell
  `.trim();
}

/**
 * 在新终端 Tab 中执行命令
 * 自动检测终端类型（iTerm2 / Terminal.app），通过 AppleScript 打开新 Tab
 * @param {string} command - 要执行的 shell 命令
 * @param {string} tabTitle - Tab 标题
 * @throws {ClawtError} 非 macOS 平台或 AppleScript 执行失败时抛出
 */
export function openCommandInNewTerminalTab(command: string, tabTitle: string): void {
  if (process.platform !== 'darwin') {
    throw new ClawtError('批量 resume 目前仅支持 macOS 平台（通过 AppleScript 打开终端 Tab）');
  }

  const terminalApp = detectTerminalApp();
  const script = terminalApp === 'iterm2'
    ? buildITermAppleScript(command, tabTitle)
    : buildTerminalAppleScript(command, tabTitle);

  logger.debug(`打开终端 Tab [${terminalApp}]: ${tabTitle}`);
  logger.debug(`执行命令: ${command}`);

  try {
    execFileSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Terminal.app 通过 System Events 模拟键盘操作需要辅助功能权限
    const accessibilityHint = terminalApp === 'terminal'
      ? '\n提示：Terminal.app 需要辅助功能权限，请在「系统设置 → 隐私与安全性 → 辅助功能」中授权终端应用'
      : '';
    throw new ClawtError(`打开终端 Tab 失败: ${message}${accessibilityHint}`);
  }
}
