import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ClawtError } from '../errors/index.js';
import { logger } from '../logger/index.js';
import { VALID_TERMINAL_APPS, ITERM2_APP_PATH, MESSAGES } from '../constants/index.js';
import { getConfigValue } from './config.js';
import { getCurrentLanguage } from './i18n.js';

/** 终端应用类型 */
type TerminalApp = 'iterm2' | 'terminal' | 'cmux';

/**
 * 检测系统是否安装了 iTerm2
 * 通过检查 /Applications/iTerm.app 是否存在来判断
 * @returns {boolean} 是否安装了 iTerm2
 */
function isITerm2Installed(): boolean {
  return existsSync(ITERM2_APP_PATH);
}

/**
 * 检测当前是否在 cmux 环境中运行
 * 通过检查环境变量 CMUX_WORKSPACE_ID 是否存在来判断
 * @returns {boolean} 是否在 cmux 环境中
 */
export function isCmuxEnvironment(): boolean {
  return !!process.env.CMUX_WORKSPACE_ID;
}

/**
 * 检测当前使用的终端应用
 * 优先读取配置项 terminalApp；值为 'auto' 时按以下顺序检测：
 * 1. cmux 环境（通过 CMUX_WORKSPACE_ID 环境变量）
 * 2. iTerm2 是否已安装
 * 3. 降级到 Terminal.app
 * @returns {TerminalApp} 终端类型：'iterm2'、'terminal' 或 'cmux'
 */
export function detectTerminalApp(): TerminalApp {
  const configured = getConfigValue('terminalApp');

  // 配置了明确的终端类型，直接使用
  if (configured === 'iterm2' || configured === 'terminal' || configured === 'cmux') {
    return configured;
  }

  // 配置值无效时给出警告（auto 除外）
  if (!VALID_TERMINAL_APPS.includes(configured)) {
    logger.warn(`terminalApp 配置值 "${configured}" 无效，有效值: ${VALID_TERMINAL_APPS.join(', ')}，将使用自动检测`);
  }

  // auto 模式：优先检测 cmux 环境
  if (isCmuxEnvironment()) {
    return 'cmux';
  }

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
 * 在当前 cmux workspace 中分割创建新 surface 并执行命令
 * @param {string} command - 要执行的 shell 命令
 * @param {string} title - surface 标题（用于日志）
 * @throws {ClawtError} 不在 cmux 环境中或 CLI 执行失败时抛出
 */
function openCommandInCmuxSurface(command: string, title: string): void {
  // 环境检查：只需要检查 WORKSPACE_ID
  if (!isCmuxEnvironment()) {
    throw new ClawtError(
      MESSAGES.NOT_IN_CMUX
    );
  }

  logger.debug(`在 cmux 中创建新 surface: ${title}`);
  logger.debug(`执行命令: ${command}`);

  try {
    // 步骤 1：分割创建新 surface（利用默认值机制）
    const newSurfaceResult = execFileSync('cmux', [
      'new-split',
      'right',  // 在右侧创建新 surface
    ], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,  // 5秒超时
    });

    logger.debug(`new-split 输出: ${newSurfaceResult}`);

    // 步骤 2：解析输出获取新 surface ID
    // 输出格式可能是：
    // - "surface:24"（简短引用）
    // - "OK surface:24 pane:14 workspace:5"（带 OK 前缀）
    // 需要灵活匹配
    const match = newSurfaceResult.match(/(?:OK\s+)?(surface:\d+)/i);
    if (!match) {
      throw new Error(getCurrentLanguage() === 'en' ? `Failed to parse cmux new-split output: ${newSurfaceResult}` : `无法解析 cmux new-split 输出: ${newSurfaceResult}`);
    }
    const surfaceRef = match[1];

    logger.debug(`已创建 surface: ${surfaceRef}`);

    // 步骤 3：向新 surface 发送命令（追加 \n 自动执行）
    execFileSync('cmux', [
      'send',
      '--surface', surfaceRef,
      `${command}\\n`,  // 追加换行符以自动执行命令
    ], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });

    logger.debug(`已向 ${surfaceRef} 发送命令`);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ClawtError(getCurrentLanguage() === 'en' ? `Failed to create surface in cmux: ${message}` : `在 cmux 中创建 surface 失败: ${message}`);
  }
}

/**
 * 执行 AppleScript 脚本
 * @param {string} script - AppleScript 内容
 * @param {TerminalApp} terminalApp - 终端类型（'iterm2' 或 'terminal'）
 * @throws {ClawtError} AppleScript 执行失败时抛出
 */
function executeAppleScript(script: string, terminalApp: 'iterm2' | 'terminal'): void {
  logger.debug(`打开终端 Tab [${terminalApp}]`);
  logger.debug(`执行 AppleScript`);

  try {
    execFileSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const accessibilityHint = terminalApp === 'terminal'
      ? MESSAGES.TERMINAL_ACCESSIBILITY_HINT
      : '';
    throw new ClawtError(getCurrentLanguage() === 'en' ? `Failed to open terminal tab: ${message}${accessibilityHint}` : `打开终端 Tab 失败: ${message}${accessibilityHint}`);
  }
}

/**
 * 在新终端 Tab 或 cmux Surface 中执行命令
 * 自动检测终端类型（cmux / iTerm2 / Terminal.app）
 * - cmux：在当前 pane 创建新 surface
 * - iTerm2 / Terminal.app：通过 AppleScript 打开新 Tab
 * @param {string} command - 要执行的 shell 命令
 * @param {string} tabTitle - Tab 或 surface 标题
 * @throws {ClawtError} 非 macOS 平台或终端打开失败时抛出
 */
export function openCommandInNewTerminalTab(command: string, tabTitle: string): void {
  if (process.platform !== 'darwin') {
    throw new ClawtError(MESSAGES.BATCH_RESUME_MACOS_ONLY);
  }

  const terminalApp = detectTerminalApp();

  switch (terminalApp) {
    case 'cmux':
      openCommandInCmuxSurface(command, tabTitle);
      break;
    case 'iterm2':
      const itermScript = buildITermAppleScript(command, tabTitle);
      executeAppleScript(itermScript, 'iterm2');
      break;
    case 'terminal':
      const terminalScript = buildTerminalAppleScript(command, tabTitle);
      executeAppleScript(terminalScript, 'terminal');
      break;
    default:
      throw new ClawtError(getCurrentLanguage() === 'en' ? `Unsupported terminal type: ${terminalApp}` : `不支持的终端类型: ${terminalApp}`);
  }
}
