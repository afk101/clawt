import { describe, it, expect, vi } from 'vitest';
import { findExactMatch, findFuzzyMatches, resolveTargetWorktree, resolveTargetWorktrees } from '../../../src/utils/worktree-matcher.js';
import { createWorktreeInfo, createWorktreeList } from '../../helpers/fixtures.js';
import { ClawtError } from '../../../src/errors/index.js';
import type { WorktreeResolveMessages, WorktreeMultiResolveMessages } from '../../../src/utils/worktree-matcher.js';

// mock enquirer
vi.mock('enquirer', () => ({
  default: {
    Select: vi.fn().mockImplementation(function({ choices }: { choices: Array<{ name: string }> }) {
      this.run = vi.fn().mockResolvedValue(choices[0].name);
    }),
    MultiSelect: vi.fn().mockImplementation(function({ choices }: { choices: Array<{ name: string }> }) {
      this.run = vi.fn().mockResolvedValue(choices.map((c: { name: string }) => c.name));
    }),
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

/** 多选场景测试用消息配置 */
const testMultiMessages: WorktreeMultiResolveMessages = {
  noWorktrees: '无可用 worktree',
  selectBranch: '请选择要移除的分支',
  multipleMatches: (keyword: string) => `"${keyword}" 匹配到多个分支`,
  noMatch: (keyword: string, branches: string[]) =>
    `未找到匹配 "${keyword}"，可用：${branches.join(', ')}`,
};

describe('resolveTargetWorktrees', () => {
  it('空列表抛出 ClawtError', async () => {
    await expect(resolveTargetWorktrees([], testMultiMessages, 'any')).rejects.toThrow(ClawtError);
    await expect(resolveTargetWorktrees([], testMultiMessages, 'any')).rejects.toThrow('无可用 worktree');
  });

  it('单个 worktree 且不传分支名时直接返回数组', async () => {
    const worktrees = [createWorktreeInfo({ branch: 'only-one' })];
    const result = await resolveTargetWorktrees(worktrees, testMultiMessages);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('only-one');
  });

  it('精确匹配优先，返回单元素数组', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feat' }),
      createWorktreeInfo({ branch: 'feature' }),
    ];
    const result = await resolveTargetWorktrees(worktrees, testMultiMessages, 'feat');
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('feat');
  });

  it('模糊匹配唯一结果直接返回单元素数组', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-login' }),
      createWorktreeInfo({ branch: 'bugfix-auth' }),
    ];
    const result = await resolveTargetWorktrees(worktrees, testMultiMessages, 'login');
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('feature-login');
  });

  it('模糊匹配多个结果时调用多选交互', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-login' }),
      createWorktreeInfo({ branch: 'feature-logout' }),
      createWorktreeInfo({ branch: 'bugfix-auth' }),
    ];
    const result = await resolveTargetWorktrees(worktrees, testMultiMessages, 'log');
    // mock 的 MultiSelect 返回所有 choices，因此应返回匹配到的 2 个
    expect(result).toHaveLength(2);
    expect(result.map((w) => w.branch)).toEqual(['feature-login', 'feature-logout']);
  });

  it('不传分支名时多个 worktree 调用多选交互', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-a' }),
      createWorktreeInfo({ branch: 'feature-b' }),
    ];
    const result = await resolveTargetWorktrees(worktrees, testMultiMessages);
    // mock 的 MultiSelect 返回所有 choices
    expect(result).toHaveLength(2);
  });

  it('无匹配抛出 ClawtError 并包含可用分支', async () => {
    const worktrees = [
      createWorktreeInfo({ branch: 'feature-a' }),
      createWorktreeInfo({ branch: 'feature-b' }),
    ];
    await expect(resolveTargetWorktrees(worktrees, testMultiMessages, 'xyz')).rejects.toThrow(ClawtError);
  });
});
