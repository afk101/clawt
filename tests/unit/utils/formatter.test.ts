import { describe, it, expect, vi } from 'vitest';
import { formatWorktreeStatus, printSuccess, printError, printWarning, printInfo, printSeparator, printDoubleSeparator, isWorktreeIdle, formatDuration } from '../../../src/utils/formatter.js';
import { createWorktreeStatus } from '../../helpers/fixtures.js';

describe('formatWorktreeStatus', () => {
  it('有 insertions 和 deletions 时正确格式化', () => {
    const status = createWorktreeStatus({ commitCount: 5, insertions: 100, deletions: 20 });
    const result = formatWorktreeStatus(status);
    expect(result).toContain('5 个提交');
    expect(result).toContain('+100');
    expect(result).toContain('-20');
  });

  it('无变更时显示"无变更"', () => {
    const status = createWorktreeStatus({ insertions: 0, deletions: 0 });
    const result = formatWorktreeStatus(status);
    expect(result).toContain('无变更');
  });

  it('hasDirtyFiles 时显示"(未提交修改)"', () => {
    const status = createWorktreeStatus({ hasDirtyFiles: true });
    const result = formatWorktreeStatus(status);
    expect(result).toContain('(未提交修改)');
  });

  it('hasDirtyFiles 为 false 时不显示"(未提交修改)"', () => {
    const status = createWorktreeStatus({ hasDirtyFiles: false });
    const result = formatWorktreeStatus(status);
    expect(result).not.toContain('(未提交修改)');
  });

  it('仅有 insertions 时不显示"无变更"', () => {
    const status = createWorktreeStatus({ insertions: 10, deletions: 0 });
    const result = formatWorktreeStatus(status);
    expect(result).not.toContain('无变更');
    expect(result).toContain('+10');
    expect(result).toContain('-0');
  });
});

describe('isWorktreeIdle', () => {
  it('全部为零且无未提交修改时返回 true', () => {
    const status = createWorktreeStatus({ commitCount: 0, insertions: 0, deletions: 0, hasDirtyFiles: false });
    expect(isWorktreeIdle(status)).toBe(true);
  });

  it('有提交时返回 false', () => {
    const status = createWorktreeStatus({ commitCount: 1, insertions: 0, deletions: 0, hasDirtyFiles: false });
    expect(isWorktreeIdle(status)).toBe(false);
  });

  it('有 insertions 时返回 false', () => {
    const status = createWorktreeStatus({ commitCount: 0, insertions: 1, deletions: 0, hasDirtyFiles: false });
    expect(isWorktreeIdle(status)).toBe(false);
  });

  it('有 deletions 时返回 false', () => {
    const status = createWorktreeStatus({ commitCount: 0, insertions: 0, deletions: 1, hasDirtyFiles: false });
    expect(isWorktreeIdle(status)).toBe(false);
  });

  it('有未提交修改时返回 false', () => {
    const status = createWorktreeStatus({ commitCount: 0, insertions: 0, deletions: 0, hasDirtyFiles: true });
    expect(isWorktreeIdle(status)).toBe(false);
  });
});

describe('printSeparator', () => {
  it('调用 console.log 输出分隔线', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printSeparator();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('printDoubleSeparator', () => {
  it('调用 console.log 输出粗分隔线', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printDoubleSeparator();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('print 函数', () => {
  it('printSuccess 调用 console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printSuccess('成功消息');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('成功消息');
  });

  it('printError 调用 console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printError('错误消息');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('错误消息');
  });

  it('printWarning 调用 console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printWarning('警告消息');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('警告消息');
  });

  it('printInfo 调用 console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printInfo('普通消息');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('普通消息');
  });
});

describe('formatDuration', () => {
  it('小于 60 秒时显示秒数（保留一位小数）', () => {
    expect(formatDuration(5200)).toBe('5.2s');
  });

  it('0 毫秒时显示 0.0s', () => {
    expect(formatDuration(0)).toBe('0.0s');
  });

  it('59.9 秒时仍显示秒数', () => {
    expect(formatDuration(59900)).toBe('59.9s');
  });

  it('大于等于 60 秒时显示分秒格式', () => {
    expect(formatDuration(83000)).toBe('1m23s');
  });

  it('整分钟时秒数补零', () => {
    expect(formatDuration(120000)).toBe('2m00s');
  });

  it('大数值时正确格式化', () => {
    expect(formatDuration(3661000)).toBe('61m01s');
  });
});
