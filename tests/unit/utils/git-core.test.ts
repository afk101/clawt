import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gitCheckIgnored } from '../../../src/utils/git-core.js';

// mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  exec: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
const mockExecFileSync = vi.mocked(execFileSync);

describe('gitCheckIgnored', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空数组输入时返回空数组', () => {
    const result = gitCheckIgnored([]);
    expect(result).toEqual([]);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('全部被忽略时返回全部路径', () => {
    mockExecFileSync.mockReturnValue('docs/superpowers/a.md\ndocs/superpowers/b.md\n');
    const result = gitCheckIgnored(['docs/superpowers/a.md', 'docs/superpowers/b.md']);
    expect(result).toEqual(['docs/superpowers/a.md', 'docs/superpowers/b.md']);
  });

  it('全部不被忽略时返回空数组', () => {
    // git check-ignore 无匹配时退出码为 1，execFileSync 抛出异常
    mockExecFileSync.mockImplementation(() => { throw new Error('exit code 1'); });
    const result = gitCheckIgnored(['src/index.ts']);
    expect(result).toEqual([]);
  });

  it('混合场景时仅返回被忽略的路径', () => {
    mockExecFileSync.mockReturnValue('docs/superpowers/a.md\n');
    const result = gitCheckIgnored(['docs/superpowers/a.md', 'src/index.ts']);
    expect(result).toEqual(['docs/superpowers/a.md']);
  });
});
