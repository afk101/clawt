import * as readline from 'node:readline';
import chalk from 'chalk';
import stringWidth from 'string-width';
import {
  ENABLE_BRACKETED_PASTE,
  DISABLE_BRACKETED_PASTE,
  PASTE_THRESHOLD_MS,
} from '../constants/index.js';

/**
 * 在终端中渲染当前输入内容（支持多行显示）
 * @param {string} buffer - 当前输入缓冲区
 * @param {number} cursorPos - 光标在 buffer 中的位置
 * @param {number} renderedLineCount - 上一次渲染占用的行数，用于清除
 * @param {string} prompt - 提示文字
 * @returns {number} 本次渲染占用的行数
 */
function renderInput(
  buffer: string,
  cursorPos: number,
  renderedLineCount: number,
  prompt: string,
): number {
  const stdout = process.stdout;

  // 清除之前渲染的内容
  if (renderedLineCount > 0) {
    // 光标移到第一行
    if (renderedLineCount > 1) {
      stdout.write(`\x1b[${renderedLineCount - 1}A`);
    }
    stdout.write('\r');
    for (let i = 0; i < renderedLineCount; i++) {
      stdout.write('\x1b[2K'); // 清除整行
      if (i < renderedLineCount - 1) {
        stdout.write('\x1b[1B'); // 下移一行
      }
    }
    // 回到第一行
    if (renderedLineCount > 1) {
      stdout.write(`\x1b[${renderedLineCount - 1}A`);
    }
    stdout.write('\r');
  }

  // 渲染提示文字和内容
  const display = prompt + buffer;
  const lines = display.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) stdout.write('\n');
    stdout.write(lines[i]);
  }

  // 计算光标应该在的位置（使用 stringWidth 正确处理中文等全角字符的终端显示宽度）
  const beforeCursor = prompt + buffer.substring(0, cursorPos);
  const cursorLines = beforeCursor.split('\n');
  const cursorLineIndex = cursorLines.length - 1;
  const cursorCol = stringWidth(cursorLines[cursorLineIndex]);

  // 将光标移动到正确位置
  const totalLines = lines.length;
  const lineDiff = totalLines - 1 - cursorLineIndex;
  if (lineDiff > 0) {
    stdout.write(`\x1b[${lineDiff}A`);
  }
  // 先回到行首，cursorCol > 0 时再向右移动
  // 注意：ANSI CUF（\x1b[nC）参数为 0 时等同于 1，所以 cursorCol 为 0 时不能发送移动指令
  stdout.write('\r');
  if (cursorCol > 0) {
    stdout.write(`\x1b[${cursorCol}C`);
  }

  return totalLines;
}

/**
 * 多行交互式输入框
 * 支持粘贴多行文本（通过 Bracketed Paste Mode 检测），回车键确认提交
 * @param {string} message - 提示信息
 * @returns {Promise<string>} 用户输入的文本内容
 */
export function multilineInput(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const prompt = chalk.green('? ') + chalk.bold(message) + ' ';

    if (!stdin.isTTY) {
      reject(new Error('当前环境不支持交互式输入'));
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    readline.emitKeypressEvents(stdin);

    // 启用 Bracketed Paste Mode
    process.stdout.write(ENABLE_BRACKETED_PASTE);

    let buffer = '';
    let cursorPos = 0;
    let isPasting = false;
    let lastKeypressTime = 0;
    let renderedLineCount = 0;

    // 初始渲染
    renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);

    /**
     * 清理终端状态并恢复
     */
    function cleanup(): void {
      stdin.removeListener('keypress', handler);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write(DISABLE_BRACKETED_PASTE);
      // 移动光标到最后一行末尾并换行
      const lines = (prompt + buffer).split('\n');
      const currentBeforeCursor = (prompt + buffer.substring(0, cursorPos)).split('\n');
      const currentLine = currentBeforeCursor.length - 1;
      const lastLine = lines.length - 1;
      if (lastLine > currentLine) {
        process.stdout.write(`\x1b[${lastLine - currentLine}B`);
      }
      process.stdout.write('\n');
    }

    /**
     * 处理键盘按键事件
     * @param {string | undefined} ch - 按下的字符
     * @param {readline.Key} key - 按键信息
     */
    function handler(ch: string | undefined, key: readline.Key): void {
      const now = Date.now();
      const delta = now - lastKeypressTime;
      lastKeypressTime = now;

      // Bracketed Paste Mode 的开始/结束标记
      if (key.name === 'paste-start') {
        isPasting = true;
        return;
      }
      if (key.name === 'paste-end') {
        isPasting = false;
        renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        return;
      }

      // Ctrl+C：取消输入
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('用户取消输入'));
        return;
      }

      // 回车键处理
      if (key.name === 'return') {
        // Shift+Enter 或 Alt+Enter → 手动换行
        // 终端中 Alt 键通过 ESC 前缀编码，Node.js readline 将其解析为 key.meta = true
        // 部分终端（如 macOS iTerm2）Shift+Enter 也会发送 ESC + \r，同样触发 key.meta
        if (key.meta) {
          buffer = buffer.substring(0, cursorPos) + '\n' + buffer.substring(cursorPos);
          cursorPos++;
          renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
          return;
        }
        // 粘贴中的回车 → 换行
        if (isPasting || delta < PASTE_THRESHOLD_MS) {
          buffer = buffer.substring(0, cursorPos) + '\n' + buffer.substring(cursorPos);
          cursorPos++;
          if (!isPasting) {
            renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
          }
          return;
        }
        // 用户手动按回车 → 提交
        cleanup();
        resolve(buffer);
        return;
      }

      // 退格键
      if (key.name === 'backspace') {
        if (cursorPos > 0) {
          buffer = buffer.substring(0, cursorPos - 1) + buffer.substring(cursorPos);
          cursorPos--;
          renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        }
        return;
      }

      // Delete 键
      if (key.name === 'delete') {
        if (cursorPos < buffer.length) {
          buffer = buffer.substring(0, cursorPos) + buffer.substring(cursorPos + 1);
          renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        }
        return;
      }

      // 方向键：左
      if (key.name === 'left') {
        if (cursorPos > 0) {
          cursorPos--;
          renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        }
        return;
      }

      // 方向键：右
      if (key.name === 'right') {
        if (cursorPos < buffer.length) {
          cursorPos++;
          renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        }
        return;
      }

      // Home 键 / Ctrl+A：移动到行首
      if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
        cursorPos = 0;
        renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        return;
      }

      // End 键 / Ctrl+E：移动到行尾
      if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
        cursorPos = buffer.length;
        renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        return;
      }

      // 普通字符输入
      if (ch && !key.ctrl && !key.meta) {
        buffer = buffer.substring(0, cursorPos) + ch + buffer.substring(cursorPos);
        cursorPos += ch.length;
        if (!isPasting) {
          renderedLineCount = renderInput(buffer, cursorPos, renderedLineCount, prompt);
        }
        return;
      }
    }

    stdin.on('keypress', handler);
  });
}
