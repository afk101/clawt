import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock 常量模块
vi.mock('../../../src/constants/index.js', () => ({
  SELECTED_INDICATOR: '▶',
  UNSELECTED_INDICATOR: '  ',
  PANEL_DATE_SEPARATOR_PREFIX: '─',
  PANEL_SEPARATOR_MAX_WIDTH: 60,
  PANEL_DATE_COLOR: '#FF8C00',
  UNKNOWN_DATE_GROUP: 'UNKNOWN',
  VALIDATE_BRANCH_PREFIX: 'clawt-validate-',
  MESSAGES: {
    STATUS_CHANGE_COMMITTED: '已提交',
    STATUS_CHANGE_UNCOMMITTED: '未提交',
    STATUS_CHANGE_CONFLICT: '冲突',
    STATUS_CHANGE_CLEAN: '干净',
    STATUS_CREATED_AT: (relativeTime: string) => `创建于 ${relativeTime}`,
    STATUS_LAST_VALIDATED: (relativeTime: string) => `上次验证: ${relativeTime}`,
    STATUS_NOT_VALIDATED: '✗ 未验证',
  },
}));

// mock i18n 模块
vi.mock('../../../src/utils/i18n.js', () => ({
  getCurrentLanguage: vi.fn(() => 'zh'),
}));

// mock 消息常量
vi.mock('../../../src/constants/messages/index.js', () => ({
  PANEL_COMMITS_AHEAD: (count: number) => `${count} 个本地提交`,
  PANEL_COMMITS_BEHIND: (count: number) => `落后主分支 ${count} 个提交`,
  PANEL_SYNCED_WITH_MAIN: '与主分支同步',
  PANEL_FOOTER_SHORTCUTS: 'footer shortcuts',
  PANEL_FOOTER_COUNTDOWN: (s: number) => `${s}s`,
  PANEL_OVERFLOW_DOWN_HINT: '↓ more',
  PANEL_OVERFLOW_UP_HINT: '↑ more',
  PANEL_SNAPSHOT_SUMMARY: (total: number, orphaned: number) => `快照 ${total}/${orphaned}`,
  PANEL_NO_WORKTREES_MSG: 'no worktrees',
  PANEL_TITLE: (name: string) => `Title: ${name}`,
  PANEL_CONFIGURED_BRANCH: (branch: string) => `配置分支: ${branch}`,
  PANEL_CONFIGURED_BRANCH_DELETED: (branch: string) => `配置分支已删除: ${branch}`,
  PANEL_CONFIGURED_BRANCH_MISMATCH: (branch: string) => `配置分支不匹配: ${branch}`,
  PANEL_NOT_INITIALIZED: '未初始化',
  PANEL_UNKNOWN_DATE: '未知日期',
}));

// mock utils/index.js（仅 mock renderWorktreeBlock 用到的函数）
vi.mock('../../../src/utils/index.js', () => ({
  formatRelativeTime: vi.fn((iso: string) => iso ? '3 天前' : null),
  groupWorktreesByDate: vi.fn(() => new Map()),
  formatRelativeDate: vi.fn(() => '3 天前'),
}));

import { renderWorktreeBlock } from '../../../src/utils/interactive-panel-render.js';
import type { WorktreeDetailedStatus } from '../../../src/types/index.js';

describe('renderWorktreeBlock', () => {
  it('渲染包含来源分支行（baseBranch 有值）', () => {
    const wt: WorktreeDetailedStatus = {
      path: '/path/feature',
      branch: 'feature',
      baseBranch: 'test',
      changeStatus: 'clean',
      commitsAhead: 0,
      commitsBehind: 0,
      snapshotTime: null,
      insertions: 0,
      deletions: 0,
      createdAt: null,
    };

    const lines = renderWorktreeBlock(wt, false);
    const joined = lines.join('\n');
    expect(joined).toContain('来源分支: test');
  });

  it('渲染包含来源分支行（baseBranch 为 null 时显示未记录）', () => {
    const wt: WorktreeDetailedStatus = {
      path: '/path/feature',
      branch: 'feature',
      baseBranch: null,
      changeStatus: 'clean',
      commitsAhead: 0,
      commitsBehind: 0,
      snapshotTime: null,
      insertions: 0,
      deletions: 0,
      createdAt: null,
    };

    const lines = renderWorktreeBlock(wt, false);
    const joined = lines.join('\n');
    expect(joined).toContain('来源分支: 未记录');
  });

  it('来源分支行位于同步状态行之后、创建时间行之前', () => {
    const wt: WorktreeDetailedStatus = {
      path: '/path/feature',
      branch: 'feature',
      baseBranch: 'main',
      changeStatus: 'clean',
      commitsAhead: 0,
      commitsBehind: 0,
      snapshotTime: null,
      insertions: 0,
      deletions: 0,
      createdAt: '2026-02-20T14:30:00+08:00',
    };

    const lines = renderWorktreeBlock(wt, false);
    const joined = lines.join('\n');

    // 来源分支在同步状态之后
    const syncIdx = joined.indexOf('与主分支同步');
    const baseBranchIdx = joined.indexOf('来源分支: main');
    expect(syncIdx).toBeGreaterThanOrEqual(0);
    expect(baseBranchIdx).toBeGreaterThan(syncIdx);

    // 来源分支在创建时间之前
    const createdAtIdx = joined.indexOf('创建于');
    expect(createdAtIdx).toBeGreaterThan(baseBranchIdx);
  });
});
