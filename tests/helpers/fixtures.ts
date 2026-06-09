import type { WorktreeInfo, WorktreeStatus } from '../../src/types/index.js';

/**
 * 创建测试用 WorktreeInfo
 * @param {Partial<WorktreeInfo>} overrides - 覆盖字段
 * @returns {WorktreeInfo} 测试数据
 */
export function createWorktreeInfo(overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    path: '/Users/test/.clawt/worktrees/my-project/feature-branch',
    branch: 'feature-branch',
    baseBranch: null,
    ...overrides,
  };
}

/**
 * 创建测试用 WorktreeStatus
 * @param {Partial<WorktreeStatus>} overrides - 覆盖字段
 * @returns {WorktreeStatus} 测试数据
 */
export function createWorktreeStatus(overrides: Partial<WorktreeStatus> = {}): WorktreeStatus {
  return {
    commitCount: 3,
    insertions: 42,
    deletions: 10,
    hasDirtyFiles: false,
    ...overrides,
  };
}

/**
 * 创建多个测试用 WorktreeInfo
 * @param {number} count - 数量
 * @returns {WorktreeInfo[]} 测试数据数组
 */
export function createWorktreeList(count: number): WorktreeInfo[] {
  return Array.from({ length: count }, (_, i) => createWorktreeInfo({
    path: `/Users/test/.clawt/worktrees/my-project/branch-${i + 1}`,
    branch: `branch-${i + 1}`,
  }));
}
