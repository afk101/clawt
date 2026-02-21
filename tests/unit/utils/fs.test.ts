import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  rmdirSync: vi.fn(),
}));

import { existsSync, mkdirSync, readdirSync, rmdirSync } from 'node:fs';
import { ensureDir, removeEmptyDir } from '../../../src/utils/fs.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedMkdirSync = vi.mocked(mkdirSync);
const mockedReaddirSync = vi.mocked(readdirSync);
const mockedRmdirSync = vi.mocked(rmdirSync);

describe('ensureDir', () => {
  it('目录不存在时创建', () => {
    mockedExistsSync.mockReturnValue(false);
    ensureDir('/tmp/test-dir');
    expect(mockedMkdirSync).toHaveBeenCalledWith('/tmp/test-dir', { recursive: true });
  });

  it('目录已存在时不操作', () => {
    mockedExistsSync.mockReturnValue(true);
    ensureDir('/tmp/test-dir');
    expect(mockedMkdirSync).not.toHaveBeenCalled();
  });
});

describe('removeEmptyDir', () => {
  it('空目录删除返回 true', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReaddirSync.mockReturnValue([]);
    expect(removeEmptyDir('/tmp/empty-dir')).toBe(true);
    expect(mockedRmdirSync).toHaveBeenCalledWith('/tmp/empty-dir');
  });

  it('非空目录不删除返回 false', () => {
    mockedExistsSync.mockReturnValue(true);
    // @ts-expect-error readdirSync 返回的类型比较复杂，这里简化处理
    mockedReaddirSync.mockReturnValue(['file.txt']);
    expect(removeEmptyDir('/tmp/non-empty-dir')).toBe(false);
    expect(mockedRmdirSync).not.toHaveBeenCalled();
  });

  it('目录不存在时返回 false', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(removeEmptyDir('/tmp/no-dir')).toBe(false);
    expect(mockedReaddirSync).not.toHaveBeenCalled();
  });
});
