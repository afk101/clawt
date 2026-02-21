import { describe, it, expect, vi } from 'vitest';
import { formatWorktreeStatus, printSuccess, printError, printWarning, printInfo } from '../../../src/utils/formatter.js';
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
