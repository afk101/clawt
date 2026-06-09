import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...actual,
    PROJECTS_CONFIG_DIR: '/tmp/clawt-projects',
  };
});

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  getWorktreeMetadataPath,
  loadWorktreeMetadata,
  removeWorktreeMetadata,
  saveWorktreeMetadata,
} from '../../../src/utils/worktree-metadata.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('worktree metadata', () => {
  it('生成项目 worktree 元数据路径', () => {
    expect(getWorktreeMetadataPath('demo', 'feature')).toBe('/tmp/clawt-projects/demo/worktrees/feature.json');
  });

  it('保存并读取来源分支元数据', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'feature',
      baseBranch: 'test',
      createdAt: '2026-06-09T10:30:00.000Z',
    }));

    saveWorktreeMetadata('demo', {
      branch: 'feature',
      baseBranch: 'test',
      createdAt: '2026-06-09T10:30:00.000Z',
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/clawt-projects/demo/worktrees/feature.json',
      expect.stringContaining('"baseBranch": "test"'),
      'utf-8',
    );
    expect(loadWorktreeMetadata('demo', 'feature')?.baseBranch).toBe('test');
  });

  it('元数据不存在时返回 null', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(loadWorktreeMetadata('demo', 'missing')).toBeNull();
  });

  it('removeWorktreeMetadata 正常删除文件', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    removeWorktreeMetadata('demo', 'feature');
    expect(rmSync).toHaveBeenCalledWith('/tmp/clawt-projects/demo/worktrees/feature.json');
  });

  it('removeWorktreeMetadata 文件不存在时不报错且不调用 rmSync', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    // 不应抛出异常
    expect(() => removeWorktreeMetadata('demo', 'missing')).not.toThrow();
    expect(rmSync).not.toHaveBeenCalled();
  });

  it('loadWorktreeMetadata JSON 损坏时返回 null', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('{ invalid json !!!');
    expect(loadWorktreeMetadata('demo', 'corrupt')).toBeNull();
  });

  it('loadWorktreeMetadata 元数据格式无效（缺少 baseBranch）时返回 null', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'feature',
      // 缺少 baseBranch 字段
      createdAt: '2026-06-09T10:30:00.000Z',
    }));
    expect(loadWorktreeMetadata('demo', 'feature')).toBeNull();
  });
});
