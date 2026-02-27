import { describe, it, expect, vi } from 'vitest';
import { findExactMatch, findFuzzyMatches, resolveTargetWorktree, resolveTargetWorktrees, groupWorktreesByDate, buildGroupedChoices, buildGroupMembershipMap } from '../../../src/utils/worktree-matcher.js';
import { createWorktreeInfo, createWorktreeList } from '../../helpers/fixtures.js';
import { ClawtError } from '../../../src/errors/index.js';
import { SELECT_ALL_NAME, GROUP_SELECT_ALL_PREFIX, UNKNOWN_DATE_GROUP } from '../../../src/constants/index.js';
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

// mock getBranchCreatedAt，分组测试中按需控制返回值
vi.mock('../../../src/utils/git.js', () => ({
  getBranchCreatedAt: vi.fn().mockReturnValue(null),
}));

// mock node:fs 的 statSync，分组测试中按需控制返回值
vi.mock('node:fs', () => ({
  statSync: vi.fn().mockReturnValue({ birthtime: new Date('2026-02-27T10:00:00') }),
}));

import { statSync } from 'node:fs';
const mockedStatSync = vi.mocked(statSync);

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

describe('groupWorktreesByDate', () => {
  it('多日期分组：不同日期的分支被正确分组，最新日期在前', () => {
    const worktrees = [
      createWorktreeInfo({ path: '/worktrees/feature-auth', branch: 'feature-auth' }),
      createWorktreeInfo({ path: '/worktrees/feature-login', branch: 'feature-login' }),
      createWorktreeInfo({ path: '/worktrees/bugfix-nav', branch: 'bugfix-nav' }),
    ];

    mockedStatSync
      .mockReturnValueOnce({ birthtime: new Date('2026-02-26T10:00:00') } as any)
      .mockReturnValueOnce({ birthtime: new Date('2026-02-26T14:00:00') } as any)
      .mockReturnValueOnce({ birthtime: new Date('2026-02-25T09:00:00') } as any);

    const groups = groupWorktreesByDate(worktrees);
    const keys = [...groups.keys()];

    // 最新日期在前
    expect(keys).toEqual(['2026-02-26', '2026-02-25']);
    // 2026-02-26 组有 2 个分支
    expect(groups.get('2026-02-26')).toHaveLength(2);
    expect(groups.get('2026-02-26')!.map((wt) => wt.branch)).toEqual(['feature-auth', 'feature-login']);
    // 2026-02-25 组有 1 个分支
    expect(groups.get('2026-02-25')).toHaveLength(1);
    expect(groups.get('2026-02-25')![0].branch).toBe('bugfix-nav');
  });

  it('statSync 异常时归入"未知日期"组', () => {
    const worktrees = [
      createWorktreeInfo({ path: '/worktrees/feature-auth', branch: 'feature-auth' }),
      createWorktreeInfo({ path: '/worktrees/old-branch', branch: 'old-branch' }),
    ];

    mockedStatSync
      .mockReturnValueOnce({ birthtime: new Date('2026-02-26T10:00:00') } as any)
      .mockImplementationOnce(() => { throw new Error('ENOENT'); });

    const groups = groupWorktreesByDate(worktrees);
    const keys = [...groups.keys()];

    // 未知日期在最后
    expect(keys).toEqual(['2026-02-26', UNKNOWN_DATE_GROUP]);
    expect(groups.get(UNKNOWN_DATE_GROUP)).toHaveLength(1);
    expect(groups.get(UNKNOWN_DATE_GROUP)![0].branch).toBe('old-branch');
  });

  it('单日期分组：所有分支同一天', () => {
    const worktrees = [
      createWorktreeInfo({ path: '/worktrees/feature-a', branch: 'feature-a' }),
      createWorktreeInfo({ path: '/worktrees/feature-b', branch: 'feature-b' }),
    ];

    mockedStatSync
      .mockReturnValueOnce({ birthtime: new Date('2026-02-26T10:00:00') } as any)
      .mockReturnValueOnce({ birthtime: new Date('2026-02-26T15:00:00') } as any);

    const groups = groupWorktreesByDate(worktrees);
    const keys = [...groups.keys()];

    expect(keys).toEqual(['2026-02-26']);
    expect(groups.get('2026-02-26')).toHaveLength(2);
  });
});

describe('buildGroupedChoices', () => {
  it('构建的 choices 包含全局全选、分隔线、组全选和分支', () => {
    const groups = new Map<string, Array<{ path: string; branch: string }>>([
      ['2026-02-26', [
        createWorktreeInfo({ branch: 'feature-auth' }),
        createWorktreeInfo({ branch: 'feature-login' }),
      ]],
      [UNKNOWN_DATE_GROUP, [
        createWorktreeInfo({ branch: 'old-branch' }),
      ]],
    ]);

    const choices = buildGroupedChoices(groups);

    // 全局全选在顶部
    expect(choices[0]).toEqual({ name: SELECT_ALL_NAME, message: '[select-all]' });

    // 第一组分隔线
    expect(choices[1]).toHaveProperty('role', 'separator');

    // 第一组组全选
    expect(choices[2]).toEqual({
      name: `${GROUP_SELECT_ALL_PREFIX}2026-02-26`,
      message: '[select-all: 2026-02-26]',
    });

    // 第一组分支
    expect(choices[3]).toEqual({ name: 'feature-auth', message: 'feature-auth' });
    expect(choices[4]).toEqual({ name: 'feature-login', message: 'feature-login' });

    // 未知日期组分隔线（含 chalk 高亮，使用 stringContaining 匹配）
    expect(choices[5]).toHaveProperty('role', 'separator');
    expect((choices[5] as { message: string }).message).toContain('未知日期');

    // 未知日期组全选
    expect(choices[6]).toEqual({
      name: `${GROUP_SELECT_ALL_PREFIX}${UNKNOWN_DATE_GROUP}`,
      message: `[select-all: ${UNKNOWN_DATE_GROUP}]`,
    });

    // 未知日期组分支
    expect(choices[7]).toEqual({ name: 'old-branch', message: 'old-branch' });
  });
});

describe('buildGroupMembershipMap', () => {
  it('构建组全选 name 到分支 name 列表的正确映射', () => {
    const groups = new Map<string, Array<{ path: string; branch: string }>>([
      ['2026-02-26', [
        createWorktreeInfo({ branch: 'feature-auth' }),
        createWorktreeInfo({ branch: 'feature-login' }),
      ]],
      ['2026-02-25', [
        createWorktreeInfo({ branch: 'bugfix-nav' }),
      ]],
    ]);

    const membershipMap = buildGroupMembershipMap(groups);

    expect(membershipMap.get(`${GROUP_SELECT_ALL_PREFIX}2026-02-26`)).toEqual(['feature-auth', 'feature-login']);
    expect(membershipMap.get(`${GROUP_SELECT_ALL_PREFIX}2026-02-25`)).toEqual(['bugfix-nav']);
  });
});
