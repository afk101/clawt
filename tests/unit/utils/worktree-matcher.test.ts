import { describe, it, expect, vi } from 'vitest';
import { findExactMatch, findFuzzyMatches, resolveTargetWorktree } from '../../../src/utils/worktree-matcher.js';
import { createWorktreeInfo, createWorktreeList } from '../../helpers/fixtures.js';
import { ClawtError } from '../../../src/errors/index.js';
import type { WorktreeResolveMessages } from '../../../src/utils/worktree-matcher.js';

// mock enquirer
vi.mock('enquirer', () => ({
  default: {
    Select: vi.fn().mockImplementation(({ choices }: { choices: Array<{ name: string }> }) => ({
      run: vi.fn().mockResolvedValue(choices[0].name),
    })),
  },
}));

/** 测试用消息配置 */
const testMessages: WorktreeResolveMessages = {
  noWorktrees: '无可用 worktree',
  selectBranch: '请选择分支',
  multipleMatches: (keyword: string) => `"${keyword}" 匹配到多个分支`,
  noMatch: (keyword: string, branches: string[]) =>
    `未找到匹配 "${keyword}"，可用：${branches.join(', ')}`,
};

describe('findExactMatch', () => {
  it('精确匹配返回正确的 WorktreeInfo', () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-a' }),
      createWorktreeInfo({ branch: 'feature-b' }),
    ];
    const result = findExactMatch(worktrees, 'feature-b');
    expect(result).toBeDefined();
    expect(result!.branch).toBe('feature-b');
  });

  it('无匹配返回 undefined', () => {
    const worktrees = [createWorktreeInfo({ branch: 'feature-a' })];
    expect(findExactMatch(worktrees, 'feature-b')).toBeUndefined();
  });

  it('空列表返回 undefined', () => {
    expect(findExactMatch([], 'any')).toBeUndefined();
  });

  it('大小写敏感（精确匹配）', () => {
    const worktrees = [createWorktreeInfo({ branch: 'Feature-A' })];
    expect(findExactMatch(worktrees, 'feature-a')).toBeUndefined();
  });
});

describe('findFuzzyMatches', () => {
  it('子串匹配（大小写不敏感）', () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-login' }),
      createWorktreeInfo({ branch: 'feature-logout' }),
      createWorktreeInfo({ branch: 'bugfix-auth' }),
    ];
    const result = findFuzzyMatches(worktrees, 'LOG');
    expect(result).toHaveLength(2);
    expect(result.map((w) => w.branch)).toEqual(['feature-login', 'feature-logout']);
  });

  it('空列表返回空数组', () => {
    expect(findFuzzyMatches([], 'test')).toEqual([]);
  });

  it('无匹配返回空数组', () => {
    const worktrees = [createWorktreeInfo({ branch: 'feature-a' })];
    expect(findFuzzyMatches(worktrees, 'xyz')).toEqual([]);
  });

  it('全部匹配时返回全部', () => {
    const worktrees = createWorktreeList(3);
    const result = findFuzzyMatches(worktrees, 'branch');
    expect(result).toHaveLength(3);
  });
});

describe('resolveTargetWorktree', () => {
  it('空列表抛出 ClawtError', async () => {
    await expect(resolveTargetWorktree([], testMessages, 'any')).rejects.toThrow(ClawtError);
    await expect(resolveTargetWorktree([], testMessages, 'any')).rejects.toThrow('无可用 worktree');
  });

  it('单个 worktree 且不传分支名时直接返回', async () => {
    const worktrees = [createWorktreeInfo({ branch: 'only-one' })];
    const result = await resolveTargetWorktree(worktrees, testMessages);
    expect(result.branch).toBe('only-one');
  });

  it('精确匹配优先', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feat' }),
      createWorktreeInfo({ branch: 'feature' }),
    ];
    const result = await resolveTargetWorktree(worktrees, testMessages, 'feat');
    expect(result.branch).toBe('feat');
  });

  it('模糊匹配唯一结果直接返回', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-login' }),
      createWorktreeInfo({ branch: 'bugfix-auth' }),
    ];
    const result = await resolveTargetWorktree(worktrees, testMessages, 'login');
    expect(result.branch).toBe('feature-login');
  });

  it('无匹配抛出 ClawtError 并包含可用分支', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-a' }),
      createWorktreeInfo({ branch: 'feature-b' }),
    ];
    await expect(resolveTargetWorktree(worktrees, testMessages, 'xyz')).rejects.toThrow(ClawtError);
  });
});
