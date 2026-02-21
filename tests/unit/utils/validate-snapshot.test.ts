import { describe, it, expect, vi } from 'vitest';

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
  rmdirSync: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock fs 工具
vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: vi.fn(),
}));

// mock 常量路径
vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...original,
    VALIDATE_SNAPSHOTS_DIR: '/tmp/test-snapshots',
  };
});

import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmdirSync } from 'node:fs';
import { ensureDir } from '../../../src/utils/fs.js';
import {
  getSnapshotPath,
  hasSnapshot,
  readSnapshot,
  readSnapshotTreeHash,
  writeSnapshot,
  removeSnapshot,
  removeProjectSnapshots,
  getProjectSnapshotBranches,
} from '../../../src/utils/validate-snapshot.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedUnlinkSync = vi.mocked(unlinkSync);
const mockedReaddirSync = vi.mocked(readdirSync);
const mockedRmdirSync = vi.mocked(rmdirSync);
const mockedEnsureDir = vi.mocked(ensureDir);

describe('getSnapshotPath', () => {
  it('路径拼接正确', () => {
    const path = getSnapshotPath('my-project', 'feature');
    expect(path).toBe('/tmp/test-snapshots/my-project/feature.tree');
  });
});

describe('hasSnapshot', () => {
  it('快照存在时返回 true', () => {
    mockedExistsSync.mockReturnValue(true);
    expect(hasSnapshot('proj', 'branch')).toBe(true);
  });

  it('快照不存在时返回 false', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(hasSnapshot('proj', 'branch')).toBe(false);
  });
});

describe('readSnapshot', () => {
  it('正常读取 treeHash 和 headCommitHash', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.tree')) return 'tree123\n';
      if (String(path).endsWith('.head')) return 'head456\n';
      return '';
    });
    const result = readSnapshot('proj', 'branch');
    expect(result.treeHash).toBe('tree123');
    expect(result.headCommitHash).toBe('head456');
  });

  it('文件不存在时返回空字符串', () => {
    mockedExistsSync.mockReturnValue(false);
    const result = readSnapshot('proj', 'branch');
    expect(result.treeHash).toBe('');
    expect(result.headCommitHash).toBe('');
  });
});

describe('readSnapshotTreeHash', () => {
  it('返回 treeHash', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.tree')) return 'tree789\n';
      if (String(path).endsWith('.head')) return 'head000\n';
      return '';
    });
    expect(readSnapshotTreeHash('proj', 'branch')).toBe('tree789');
  });
});

describe('writeSnapshot', () => {
  it('正确写入两个文件', () => {
    writeSnapshot('proj', 'branch', 'tree123', 'head456');
    expect(mockedEnsureDir).toHaveBeenCalledWith('/tmp/test-snapshots/proj');
    expect(mockedWriteFileSync).toHaveBeenCalledTimes(2);
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      '/tmp/test-snapshots/proj/branch.tree',
      'tree123',
      'utf-8',
    );
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      '/tmp/test-snapshots/proj/branch.head',
      'head456',
      'utf-8',
    );
  });
});

describe('removeSnapshot', () => {
  it('删除存在的文件', () => {
    mockedExistsSync.mockReturnValue(true);
    removeSnapshot('proj', 'branch');
    expect(mockedUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it('文件不存在时不抛错', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(() => removeSnapshot('proj', 'branch')).not.toThrow();
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});

describe('removeProjectSnapshots', () => {
  it('删除所有文件并删除空目录', () => {
    mockedExistsSync.mockReturnValue(true);
    // @ts-expect-error readdirSync 返回类型简化
    mockedReaddirSync.mockReturnValue(['branch.tree', 'branch.head']);
    removeProjectSnapshots('proj');
    expect(mockedUnlinkSync).toHaveBeenCalledTimes(2);
    expect(mockedRmdirSync).toHaveBeenCalledWith('/tmp/test-snapshots/proj');
  });

  it('项目目录不存在时不操作', () => {
    mockedExistsSync.mockReturnValue(false);
    removeProjectSnapshots('proj');
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});

describe('getProjectSnapshotBranches', () => {
  it('返回所有存在快照的分支名', () => {
    mockedExistsSync.mockReturnValue(true);
    // @ts-expect-error readdirSync 返回类型简化
    mockedReaddirSync.mockReturnValue(['feat-a.tree', 'feat-a.head', 'feat-b.tree', 'feat-b.head']);
    const result = getProjectSnapshotBranches('proj');
    expect(result).toEqual(['feat-a', 'feat-b']);
  });

  it('没有 .tree 文件时返回空数组', () => {
    mockedExistsSync.mockReturnValue(true);
    // @ts-expect-error readdirSync 返回类型简化
    mockedReaddirSync.mockReturnValue(['feat-a.head']);
    const result = getProjectSnapshotBranches('proj');
    expect(result).toEqual([]);
  });

  it('项目目录不存在时返回空数组', () => {
    mockedExistsSync.mockReturnValue(false);
    const result = getProjectSnapshotBranches('proj');
    expect(result).toEqual([]);
  });
});
