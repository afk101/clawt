import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import { truncateToTerminalWidth } from '../../../src/utils/progress-render.js';

describe('truncateToTerminalWidth', () => {
  describe('纯文本截断', () => {
    it('文本未超限时原样返回', () => {
      const text = 'hello world';
      const result = truncateToTerminalWidth(text, 20);
      expect(result).toBe('hello world');
    });

    it('文本恰好等于宽度时原样返回', () => {
      const text = 'abcde';
      const result = truncateToTerminalWidth(text, 5);
      expect(result).toBe('abcde');
    });

    it('文本超限时截断到指定宽度', () => {
      const text = 'hello world, this is a long string';
      const result = truncateToTerminalWidth(text, 11);
      // 截断后追加 ANSI 重置序列
      expect(result).toBe('hello world\x1B[0m');
    });

    it('空字符串直接返回', () => {
      const result = truncateToTerminalWidth('', 10);
      expect(result).toBe('');
    });

    it('宽度为 0 时返回空内容加重置', () => {
      const result = truncateToTerminalWidth('abc', 0);
      expect(result).toBe('\x1B[0m');
    });
  });

  describe('含 ANSI 颜色码的截断', () => {
    it('含颜色的文本未超限时原样返回', () => {
      // chalk.red('hi') 的可见宽度只有 2
      const text = chalk.red('hi');
      const result = truncateToTerminalWidth(text, 10);
      expect(result).toBe(text);
    });

    it('含颜色的文本超限时正确截断', () => {
      // 构造一个已知可见宽度的带颜色字符串
      const text = chalk.red('abcdefghij'); // 可见宽度 10
      const result = truncateToTerminalWidth(text, 5);
      // 截断后的可见内容应只有 5 个字符
      const stripped = result.replace(/\x1B\[[0-9;]*m/g, '');
      expect(stripped.length).toBe(5);
      expect(stripped).toBe('abcde');
    });

    it('多段颜色混合时正确截断', () => {
      const text = chalk.red('abc') + chalk.green('defgh');
      const result = truncateToTerminalWidth(text, 5);
      const stripped = result.replace(/\x1B\[[0-9;]*m/g, '');
      expect(stripped.length).toBe(5);
      expect(stripped).toBe('abcde');
    });

    it('截断后追加 ANSI 重置序列', () => {
      const text = chalk.red('abcdefghij');
      const result = truncateToTerminalWidth(text, 5);
      // 应以 \x1B[0m 结尾
      expect(result).toMatch(/\x1B\[0m$/);
    });
  });

  describe('中文/宽字符截断', () => {
    it('中文字符占 2 列宽度', () => {
      const text = '你好世界测试';
      const result = truncateToTerminalWidth(text, 8);
      // 4 个中文字符 = 8 列宽
      const stripped = result.replace(/\x1B\[[0-9;]*m/g, '');
      expect(stripped).toBe('你好世界');
    });

    it('宽度刚好不够放下一个中文字符时不截断一半', () => {
      const text = '你好世界';
      const result = truncateToTerminalWidth(text, 5);
      // 5 列只能放 2 个中文字符（4列），第 3 个字符需要 6 列放不下
      const stripped = result.replace(/\x1B\[[0-9;]*m/g, '');
      expect(stripped).toBe('你好');
    });

    it('中英混合文本正确截断', () => {
      const text = 'hi你好world';
      const result = truncateToTerminalWidth(text, 6);
      // 'h'=1, 'i'=1, '你'=2, '好'=2 => 总计 6
      const stripped = result.replace(/\x1B\[[0-9;]*m/g, '');
      expect(stripped).toBe('hi你好');
    });
  });
});
