import { describe, it, expect } from 'vitest';
import { ENABLE_BRACKETED_PASTE, DISABLE_BRACKETED_PASTE, PASTE_THRESHOLD_MS } from '../../../src/constants/terminal.js';

describe('ENABLE_BRACKETED_PASTE', () => {
  it('值为启用 Bracketed Paste Mode 的 ANSI 转义序列', () => {
    expect(ENABLE_BRACKETED_PASTE).toBe('\x1b[?2004h');
  });

  it('以 ESC[ 开头', () => {
    expect(ENABLE_BRACKETED_PASTE.startsWith('\x1b[')).toBe(true);
  });
});

describe('DISABLE_BRACKETED_PASTE', () => {
  it('值为禁用 Bracketed Paste Mode 的 ANSI 转义序列', () => {
    expect(DISABLE_BRACKETED_PASTE).toBe('\x1b[?2004l');
  });

  it('以 ESC[ 开头', () => {
    expect(DISABLE_BRACKETED_PASTE.startsWith('\x1b[')).toBe(true);
  });
});

describe('ENABLE_BRACKETED_PASTE 与 DISABLE_BRACKETED_PASTE', () => {
  it('仅末尾字符不同（h vs l）', () => {
    expect(ENABLE_BRACKETED_PASTE.slice(0, -1)).toBe(DISABLE_BRACKETED_PASTE.slice(0, -1));
    expect(ENABLE_BRACKETED_PASTE.at(-1)).toBe('h');
    expect(DISABLE_BRACKETED_PASTE.at(-1)).toBe('l');
  });
});

describe('PASTE_THRESHOLD_MS', () => {
  it('值为 10', () => {
    expect(PASTE_THRESHOLD_MS).toBe(10);
  });

  it('是正整数', () => {
    expect(Number.isInteger(PASTE_THRESHOLD_MS)).toBe(true);
    expect(PASTE_THRESHOLD_MS).toBeGreaterThan(0);
  });
});
