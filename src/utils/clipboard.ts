import { spawnSync } from 'node:child_process';
import { logger } from '../logger/index.js';

/**
 * 根据当前操作系统获取剪贴板写入命令
 * @returns {{ command: string, args: string[] } | null} 剪贴板命令配置，不支持的平台返回 null
 */
function getClipboardCommand(): { command: string; args: string[] } | null {
  switch (process.platform) {
    case 'darwin':
      return { command: 'pbcopy', args: [] };
    case 'linux':
      return { command: 'xclip', args: ['-selection', 'clipboard'] };
    case 'win32':
      return { command: 'clip', args: [] };
    default:
      return null;
  }
}

/**
 * 将文本复制到系统剪贴板
 * 跨平台支持：macOS (pbcopy)、Linux (xclip)、Windows (clip)
 * 失败时静默返回 false，不影响主流程
 * @param {string} text - 要复制到剪贴板的文本
 * @returns {boolean} 复制是否成功
 */
export function copyToClipboard(text: string): boolean {
  try {
    const clipboardCmd = getClipboardCommand();
    if (!clipboardCmd) {
      logger.debug(`不支持的平台: ${process.platform}，跳过剪贴板复制`);
      return false;
    }

    const result = spawnSync(clipboardCmd.command, clipboardCmd.args, {
      input: text,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      logger.debug(`剪贴板命令执行失败，退出码: ${result.status}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.debug(`剪贴板复制异常: ${(error as Error).message}`);
    return false;
  }
}
