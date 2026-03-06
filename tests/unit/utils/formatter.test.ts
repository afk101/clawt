import { describe, it, expect, vi } from 'vitest';
import { formatWorktreeStatus, printSuccess, printError, printWarning, printInfo, printSeparator, printDoubleSeparator, isWorktreeIdle, formatDuration, formatRelativeTime, formatDiskSize, formatLocalISOString, generateTaskFilename } from '../../../src/utils/formatter.js';
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

describe('formatRelativeTime', () => {
  it('不到 1 分钟时返回"刚刚"', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('刚刚');
  });

  it('数分钟前', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(date.toISOString())).toBe('5 分钟前');
  });

  it('数小时前', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date.toISOString())).toBe('3 小时前');
  });

  it('数天前', () => {
    const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date.toISOString())).toBe('7 天前');
  });

  it('数月前', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date.toISOString())).toBe('2 个月前');
  });

  it('数年前', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date.toISOString())).toBe('1 年前');
  });

  it('无效日期返回 null', () => {
    expect(formatRelativeTime('invalid-date')).toBeNull();
  });

  it('未来时间返回"刚刚"', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    expect(formatRelativeTime(future.toISOString())).toBe('刚刚');
  });
});

describe('formatDiskSize', () => {
  it('0 字节时返回 "0 B"', () => {
    expect(formatDiskSize(0)).toBe('0 B');
  });

  it('小于 1 KB 时以 B 为单位', () => {
    expect(formatDiskSize(1)).toBe('1 B');
    expect(formatDiskSize(512)).toBe('512 B');
    expect(formatDiskSize(1023)).toBe('1023 B');
  });

  it('恰好 1 KB 时返回 "1.0 KB"', () => {
    expect(formatDiskSize(1024)).toBe('1.0 KB');
  });

  it('KB 范围内保留一位小数', () => {
    expect(formatDiskSize(1536)).toBe('1.5 KB');
    expect(formatDiskSize(10240)).toBe('10.0 KB');
    expect(formatDiskSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('恰好 1 MB 时返回 "1.0 MB"', () => {
    expect(formatDiskSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('MB 范围内保留一位小数', () => {
    expect(formatDiskSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatDiskSize(256 * 1024 * 1024)).toBe('256.0 MB');
    expect(formatDiskSize(1024 * 1024 * 1024 - 1)).toBe('1024.0 MB');
  });

  it('恰好 1 GB 时返回 "1.0 GB"', () => {
    expect(formatDiskSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('GB 范围内保留一位小数', () => {
    expect(formatDiskSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
    expect(formatDiskSize(10 * 1024 * 1024 * 1024)).toBe('10.0 GB');
  });
});

describe('formatLocalISOString', () => {
  it('返回值包含日期和时间部分', () => {
    const date = new Date('2025-06-15T10:30:00Z');
    const result = formatLocalISOString(date);
    // 结果应符合 ISO 8601 带时区偏移的格式
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });

  it('返回值不以 Z 结尾（应包含时区偏移）', () => {
    const date = new Date();
    const result = formatLocalISOString(date);
    expect(result).not.toMatch(/Z$/);
  });

  it('时区偏移格式为 +HH:MM 或 -HH:MM', () => {
    const date = new Date();
    const result = formatLocalISOString(date);
    const tzPart = result.slice(-6);
    expect(tzPart).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it('时区偏移量与本机 getTimezoneOffset 一致', () => {
    const date = new Date('2025-01-01T12:00:00Z');
    const result = formatLocalISOString(date);
    const tzPart = result.slice(-6);
    const sign = tzPart[0];
    const hours = parseInt(tzPart.slice(1, 3), 10);
    const minutes = parseInt(tzPart.slice(4, 6), 10);

    // 从偏移字符串反推总分钟数
    const totalMinutesFromResult = (sign === '+' ? 1 : -1) * (hours * 60 + minutes);
    const expectedMinutes = -date.getTimezoneOffset();
    expect(totalMinutesFromResult).toBe(expectedMinutes);
  });

  it('不同日期对象产生不同的输出', () => {
    const date1 = new Date('2025-01-01T00:00:00Z');
    const date2 = new Date('2025-06-15T12:30:00Z');
    expect(formatLocalISOString(date1)).not.toBe(formatLocalISOString(date2));
  });

  it('毫秒部分被保留', () => {
    const date = new Date('2025-03-20T08:15:30.123Z');
    const result = formatLocalISOString(date);
    // 毫秒值应出现在结果中
    expect(result).toContain('.123');
  });
});

describe('generateTaskFilename', () => {
  it('生成格式为 prefix-YYYY-MM-DD-HH-mm-ss.md 的文件名', () => {
    const result = generateTaskFilename('clawt-tasks');
    expect(result).toMatch(/^clawt-tasks-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/);
  });

  it('使用自定义前缀', () => {
    const result = generateTaskFilename('my-prefix');
    expect(result).toMatch(/^my-prefix-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/);
  });

  it('文件名以 .md 结尾', () => {
    const result = generateTaskFilename('test');
    expect(result).toMatch(/\.md$/);
  });

  it('时间戳各段使用两位数字（年份除外）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T03:07:09'));
    const result = generateTaskFilename('clawt-tasks');
    expect(result).toBe('clawt-tasks-2026-01-05-03-07-09.md');
    vi.useRealTimers();
  });
});
