import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/git-core.js', async () => {
  const actual = await vi.importActual('../../../src/utils/git-core.js');
  return { ...actual, gitCheckIgnored: vi.fn() };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual('node:child_process');
  return { ...actual, execSync: vi.fn() };
});

import { detectIgnoredFilesInPatch } from '../../../src/utils/validate-core.js';
import { gitCheckIgnored } from '../../../src/utils/git-core.js';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const mockGitCheckIgnored = vi.mocked(gitCheckIgnored);
const mockExistsSync = vi.mocked(existsSync);
const mockExecSync = vi.mocked(execSync);

describe('detectIgnoredFilesInPatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无幽灵文件时返回空数组', () => {
    mockExecSync.mockReturnValue('src/a.ts\nsrc/b.ts\n');
    mockGitCheckIgnored.mockReturnValue([]);
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual([]);
  });

  it('检测到幽灵文件时返回文件列表', () => {
    mockExecSync.mockReturnValue('docs/superpowers/a.md\nsrc/b.ts\n');
    mockGitCheckIgnored.mockReturnValue(['docs/superpowers/a.md']);
    mockExistsSync.mockImplementation((p: string) => p === '/main/docs/superpowers/a.md');
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual(['docs/superpowers/a.md']);
  });

  it('被忽略但物理不存在的文件不包含在结果中', () => {
    mockExecSync.mockReturnValue('docs/superpowers/a.md\n');
    mockGitCheckIgnored.mockReturnValue(['docs/superpowers/a.md']);
    mockExistsSync.mockReturnValue(false);
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual([]);
  });

  it('git diff --name-only 失败时返回空数组（降级）', () => {
    mockExecSync.mockImplementation(() => { throw new Error('fatal'); });
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual([]);
  });
});
