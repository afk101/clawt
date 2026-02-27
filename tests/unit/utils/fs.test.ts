import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  rmdirSync: vi.fn(),
  statSync: vi.fn(),
}));

import { existsSync, mkdirSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { ensureDir, removeEmptyDir, calculateDirSize } from '../../../src/utils/fs.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedMkdirSync = vi.mocked(mkdirSync);
const mockedReaddirSync = vi.mocked(readdirSync);
const mockedRmdirSync = vi.mocked(rmdirSync);
const mockedStatSync = vi.mocked(statSync);

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

/**
 * 创建模拟的 Dirent 对象
 * @param {string} name - 文件/目录名
 * @param {'file' | 'directory'} type - 类型
 * @returns {import('node:fs').Dirent} 模拟的 Dirent 对象
 */
function createMockDirent(name: string, type: 'file' | 'directory') {
  return {
    name,
    isFile: () => type === 'file',
    isDirectory: () => type === 'directory',
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    parentPath: '',
    path: '',
  } as import('node:fs').Dirent;
}

describe('calculateDirSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空目录返回 0', () => {
    mockedReaddirSync.mockReturnValue([]);
    expect(calculateDirSize('/tmp/empty')).toBe(0);
  });

  it('只有文件时累加所有文件大小', () => {
    mockedReaddirSync.mockReturnValue([
      createMockDirent('a.txt', 'file'),
      createMockDirent('b.txt', 'file'),
    ]);
    mockedStatSync
      .mockReturnValueOnce({ size: 100 } as import('node:fs').Stats)
      .mockReturnValueOnce({ size: 200 } as import('node:fs').Stats);

    expect(calculateDirSize('/tmp/dir')).toBe(300);
  });

  it('递归计算子目录中的文件大小', () => {
    // 第一次调用：顶层目录包含一个文件和一个子目录
    mockedReaddirSync
      .mockReturnValueOnce([
        createMockDirent('file.txt', 'file'),
        createMockDirent('subdir', 'directory'),
      ])
      // 第二次调用：子目录包含一个文件
      .mockReturnValueOnce([
        createMockDirent('nested.txt', 'file'),
      ]);

    mockedStatSync
      .mockReturnValueOnce({ size: 500 } as import('node:fs').Stats)
      .mockReturnValueOnce({ size: 300 } as import('node:fs').Stats);

    expect(calculateDirSize('/tmp/dir')).toBe(800);
  });

  it('readdirSync 抛出异常时返回 0', () => {
    mockedReaddirSync.mockImplementation(() => {
      throw new Error('权限不足');
    });
    expect(calculateDirSize('/tmp/no-access')).toBe(0);
  });

  it('statSync 对个别文件抛出异常时跳过该文件继续计算', () => {
    mockedReaddirSync.mockReturnValue([
      createMockDirent('good.txt', 'file'),
      createMockDirent('bad.txt', 'file'),
      createMockDirent('ok.txt', 'file'),
    ]);
    mockedStatSync
      .mockReturnValueOnce({ size: 100 } as import('node:fs').Stats)
      .mockImplementationOnce(() => { throw new Error('无法访问'); })
      .mockReturnValueOnce({ size: 200 } as import('node:fs').Stats);

    expect(calculateDirSize('/tmp/dir')).toBe(300);
  });

  it('多层嵌套目录正确累加', () => {
    // 顶层：子目录 a
    mockedReaddirSync
      .mockReturnValueOnce([
        createMockDirent('a', 'directory'),
      ])
      // a 目录：文件 + 子目录 b
      .mockReturnValueOnce([
        createMockDirent('x.txt', 'file'),
        createMockDirent('b', 'directory'),
      ])
      // b 目录：一个文件
      .mockReturnValueOnce([
        createMockDirent('y.txt', 'file'),
      ]);

    mockedStatSync
      .mockReturnValueOnce({ size: 1000 } as import('node:fs').Stats)
      .mockReturnValueOnce({ size: 2000 } as import('node:fs').Stats);

    expect(calculateDirSize('/tmp/root')).toBe(3000);
  });

  it('只包含子目录（无直接文件）时正确递归', () => {
    mockedReaddirSync
      .mockReturnValueOnce([
        createMockDirent('sub', 'directory'),
      ])
      .mockReturnValueOnce([
        createMockDirent('inner.txt', 'file'),
      ]);

    mockedStatSync.mockReturnValueOnce({ size: 42 } as import('node:fs').Stats);

    expect(calculateDirSize('/tmp/dir')).toBe(42);
  });
});
