import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock i18n 模块，使 getCurrentLanguage 返回 'zh-CN' 以匹配中文断言
vi.mock('../../../src/utils/i18n.js', () => ({
  getCurrentLanguage: vi.fn().mockReturnValue('zh-CN'),
  resetLanguageCache: vi.fn(),
  setCurrentLanguage: vi.fn(),
  createMessages: vi.fn((i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
    const result: any = {};
    for (const key of Object.keys(i18nMap)) {
      result[key] = i18nMap[key]['zh-CN'];
    }
    return result;
  }),
}));

import { MESSAGES } from '../../../src/constants/messages/index.js';

describe('MESSAGES', () => {
  describe('纯字符串消息', () => {
    const stringKeys = [
      'NOT_MAIN_WORKTREE',
      'NOT_GIT_REPO',
      'GIT_NOT_INSTALLED',
      'CLAUDE_NOT_INSTALLED',
      'NO_WORKTREES',
      'MAIN_WORKTREE_DIRTY',
      'TARGET_WORKTREE_CLEAN',
      'MERGE_CONFLICT',
      'COMMIT_MESSAGE_REQUIRED',
      'TARGET_WORKTREE_NO_CHANGES',
      'INTERRUPTED',
      'INTERRUPT_CONFIRM_CLEANUP',
      'INTERRUPT_KEPT',
      'CONFIG_CORRUPTED',
      'CONFIG_RESET_SUCCESS',
      'SEPARATOR',
      'DOUBLE_SEPARATOR',
      'WORKTREE_STATUS_UNAVAILABLE',
      'INCREMENTAL_VALIDATE_FALLBACK',
      'MERGE_SQUASH_PROMPT',
      'DESTRUCTIVE_OP_CANCELLED',
      'RESET_SUCCESS',
      'RESET_ALREADY_CLEAN',
      'RESUME_NO_WORKTREES',
      'RESUME_SELECT_BRANCH',
      'VALIDATE_NO_WORKTREES',
      'VALIDATE_SELECT_BRANCH',
      'MERGE_NO_WORKTREES',
      'MERGE_SELECT_BRANCH',
      'SYNC_NO_WORKTREES',
      'SYNC_SELECT_BRANCH',
      'PULL_CONFLICT',
      'PUSH_FAILED',
      'ALIAS_LIST_EMPTY',
      'ALIAS_LIST_TITLE',
    ] as const;

    it.each(stringKeys)('%s 是非空字符串', (key) => {
      const value = MESSAGES[key];
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    });
  });

  describe('模板函数消息', () => {
    it('TARGET_WORKTREE_DIRTY_NO_MESSAGE 包含 worktree 路径', () => {
      const result = MESSAGES.TARGET_WORKTREE_DIRTY_NO_MESSAGE('/path/to/wt');
      expect(result).toContain('/path/to/wt');
    });

    it('BRANCH_EXISTS 包含分支名', () => {
      const result = MESSAGES.BRANCH_EXISTS('feature-a');
      expect(result).toContain('feature-a');
    });

    it('BRANCH_EXISTS_USE_RESUME 包含分支名和 resume 提示', () => {
      const result = MESSAGES.BRANCH_EXISTS_USE_RESUME('feature-a');
      expect(result).toContain('feature-a');
      expect(result).toContain('resume');
    });

    it('BRANCH_NAME_EMPTY 包含原始分支名', () => {
      const result = MESSAGES.BRANCH_NAME_EMPTY('...');
      expect(result).toContain('...');
    });

    it('BRANCH_SANITIZED 包含原始名和转换后的名称', () => {
      const result = MESSAGES.BRANCH_SANITIZED('feat/test', 'feat-test');
      expect(result).toContain('feat/test');
      expect(result).toContain('feat-test');
    });

    it('WORKTREE_CREATED 包含数量', () => {
      const result = MESSAGES.WORKTREE_CREATED(3);
      expect(result).toContain('3');
    });

    it('WORKTREE_REMOVED 包含路径', () => {
      const result = MESSAGES.WORKTREE_REMOVED('/path/to/wt');
      expect(result).toContain('/path/to/wt');
    });

    it('WORKTREE_NOT_FOUND 包含名称', () => {
      const result = MESSAGES.WORKTREE_NOT_FOUND('test-branch');
      expect(result).toContain('test-branch');
    });

    it('VALIDATE_SUCCESS 包含分支名', () => {
      const result = MESSAGES.VALIDATE_SUCCESS('feature-x');
      expect(result).toContain('feature-x');
    });

    it('MERGE_SUCCESS 包含分支名和提交信息', () => {
      const result = MESSAGES.MERGE_SUCCESS('feat-a', 'fix bug', true);
      expect(result).toContain('feat-a');
      expect(result).toContain('fix bug');
      expect(result).toContain('已推送');
    });

    it('MERGE_SUCCESS 未推送时不包含推送提示', () => {
      const result = MESSAGES.MERGE_SUCCESS('feat-a', 'fix bug', false);
      expect(result).not.toContain('已推送');
    });

    it('MERGE_SUCCESS_NO_MESSAGE 包含分支名', () => {
      const result = MESSAGES.MERGE_SUCCESS_NO_MESSAGE('feat-a', false);
      expect(result).toContain('feat-a');
    });

    it('WORKTREE_CLEANED 包含分支名', () => {
      const result = MESSAGES.WORKTREE_CLEANED('feature-clean');
      expect(result).toContain('feature-clean');
    });

    it('INTERRUPT_AUTO_CLEANED 包含数量', () => {
      const result = MESSAGES.INTERRUPT_AUTO_CLEANED(2);
      expect(result).toContain('2');
    });

    it('INTERRUPT_CLEANED 包含数量', () => {
      const result = MESSAGES.INTERRUPT_CLEANED(5);
      expect(result).toContain('5');
    });

    it('INVALID_COUNT 包含无效值', () => {
      const result = MESSAGES.INVALID_COUNT('abc');
      expect(result).toContain('abc');
    });

    it('INCREMENTAL_VALIDATE_SUCCESS 包含分支名', () => {
      const result = MESSAGES.INCREMENTAL_VALIDATE_SUCCESS('dev');
      expect(result).toContain('dev');
    });

    it('VALIDATE_CLEANED 包含分支名', () => {
      const result = MESSAGES.VALIDATE_CLEANED('test');
      expect(result).toContain('test');
    });

    it('MERGE_VALIDATE_STATE_HINT 包含分支名', () => {
      const result = MESSAGES.MERGE_VALIDATE_STATE_HINT('feat');
      expect(result).toContain('feat');
    });

    it('SYNC_AUTO_COMMITTED 包含分支名', () => {
      const result = MESSAGES.SYNC_AUTO_COMMITTED('sync-branch');
      expect(result).toContain('sync-branch');
    });

    it('SYNC_MERGING 包含目标分支和主分支', () => {
      const result = MESSAGES.SYNC_MERGING('feature', 'main');
      expect(result).toContain('feature');
      expect(result).toContain('main');
    });

    it('SYNC_SUCCESS 包含目标分支和主分支', () => {
      const result = MESSAGES.SYNC_SUCCESS('feature', 'main');
      expect(result).toContain('feature');
      expect(result).toContain('main');
    });

    it('SYNC_CONFLICT 包含 worktree 路径', () => {
      const result = MESSAGES.SYNC_CONFLICT('/path/to/wt');
      expect(result).toContain('/path/to/wt');
    });

    it('VALIDATE_PATCH_APPLY_FAILED 包含分支名', () => {
      const result = MESSAGES.VALIDATE_PATCH_APPLY_FAILED('feat');
      expect(result).toContain('feat');
      expect(result).toContain('sync');
    });

    it('MERGE_SQUASH_COMMITTED 包含分支名', () => {
      const result = MESSAGES.MERGE_SQUASH_COMMITTED('feat');
      expect(result).toContain('feat');
    });

    it('MERGE_SQUASH_PENDING 包含路径和分支名', () => {
      const result = MESSAGES.MERGE_SQUASH_PENDING('/path/wt', 'feat');
      expect(result).toContain('/path/wt');
      expect(result).toContain('feat');
    });

    it('REMOVE_PARTIAL_FAILURE 包含失败信息', () => {
      const failures = [
        { path: '/path/a', error: '权限不足' },
        { path: '/path/b', error: '不存在' },
      ];
      const result = MESSAGES.REMOVE_PARTIAL_FAILURE(failures);
      expect(result).toContain('/path/a');
      expect(result).toContain('权限不足');
      expect(result).toContain('/path/b');
      expect(result).toContain('不存在');
    });

    it('RESUME_NO_MATCH 包含名称和分支列表', () => {
      const result = MESSAGES.RESUME_NO_MATCH('test', ['branch-1', 'branch-2']);
      expect(result).toContain('test');
      expect(result).toContain('branch-1');
      expect(result).toContain('branch-2');
    });

    it('RESUME_MULTIPLE_MATCHES 包含名称', () => {
      const result = MESSAGES.RESUME_MULTIPLE_MATCHES('feat');
      expect(result).toContain('feat');
    });

    it('VALIDATE_NO_MATCH 包含名称和分支列表', () => {
      const result = MESSAGES.VALIDATE_NO_MATCH('test', ['b1']);
      expect(result).toContain('test');
      expect(result).toContain('b1');
    });

    it('VALIDATE_MULTIPLE_MATCHES 包含名称', () => {
      const result = MESSAGES.VALIDATE_MULTIPLE_MATCHES('feat');
      expect(result).toContain('feat');
    });

    it('MERGE_NO_MATCH 包含名称和分支列表', () => {
      const result = MESSAGES.MERGE_NO_MATCH('test', ['b1']);
      expect(result).toContain('test');
      expect(result).toContain('b1');
    });

    it('MERGE_MULTIPLE_MATCHES 包含名称', () => {
      const result = MESSAGES.MERGE_MULTIPLE_MATCHES('feat');
      expect(result).toContain('feat');
    });

    it('SYNC_NO_MATCH 包含名称和分支列表', () => {
      const result = MESSAGES.SYNC_NO_MATCH('test', ['b1']);
      expect(result).toContain('test');
      expect(result).toContain('b1');
    });

    it('SYNC_MULTIPLE_MATCHES 包含名称', () => {
      const result = MESSAGES.SYNC_MULTIPLE_MATCHES('feat');
      expect(result).toContain('feat');
    });

    it('ALIAS_SET_SUCCESS 包含别名和命令', () => {
      const result = MESSAGES.ALIAS_SET_SUCCESS('ls', 'list');
      expect(result).toContain('ls');
      expect(result).toContain('list');
    });

    it('ALIAS_REMOVE_SUCCESS 包含别名', () => {
      const result = MESSAGES.ALIAS_REMOVE_SUCCESS('ls');
      expect(result).toContain('ls');
    });

    it('ALIAS_NOT_FOUND 包含别名', () => {
      const result = MESSAGES.ALIAS_NOT_FOUND('xxx');
      expect(result).toContain('xxx');
    });

    it('ALIAS_CONFLICTS_BUILTIN 包含别名', () => {
      const result = MESSAGES.ALIAS_CONFLICTS_BUILTIN('list');
      expect(result).toContain('list');
    });

    it('ALIAS_TARGET_NOT_FOUND 包含命令名', () => {
      const result = MESSAGES.ALIAS_TARGET_NOT_FOUND('xxx');
      expect(result).toContain('xxx');
    });
  });
});

/**
 * 英文版消息测试
 * 使用 vi.resetModules + vi.doMock 动态切换语言为 en，
 * 然后重新加载 MESSAGES 模块验证英文版消息内容
 */
describe('MESSAGES — 英文版', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('纯字符串消息在英文版下返回英文文本', async () => {
    vi.doMock('../../../src/utils/i18n.js', () => ({
      getCurrentLanguage: () => 'en',
      resetLanguageCache: vi.fn(),
      setCurrentLanguage: vi.fn(),
      createMessages: (i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
        const result: any = {};
        for (const key of Object.keys(i18nMap)) {
          result[key] = i18nMap[key]['en'];
        }
        return result;
      },
    }));

    const { MESSAGES: EN_MESSAGES } = await import('../../../src/constants/messages/index.js');

    // 验证部分关键纯字符串消息是英文而非中文
    expect(EN_MESSAGES.NO_WORKTREES).toBe('(No worktrees)');
    expect(EN_MESSAGES.MAIN_WORKTREE_DIRTY).toBe('Main worktree has uncommitted changes. Please resolve first');
    expect(EN_MESSAGES.MERGE_CONFLICT).toContain('Merge has conflicts');
    expect(EN_MESSAGES.DESTRUCTIVE_OP_CANCELLED).toBe('Operation cancelled');
    expect(EN_MESSAGES.CONFIG_CORRUPTED).toContain('Config file corrupted');
    expect(EN_MESSAGES.PULL_CONFLICT).toContain('Conflict during auto-pull');
    expect(EN_MESSAGES.PUSH_FAILED).toContain('Auto-push failed');
    expect(EN_MESSAGES.ALIAS_LIST_EMPTY).toBe('(No aliases)');
    expect(EN_MESSAGES.ALIAS_LIST_TITLE).toBe('Current aliases:');
  });

  it('模板函数消息在英文版下返回英文文本', async () => {
    vi.doMock('../../../src/utils/i18n.js', () => ({
      getCurrentLanguage: () => 'en',
      resetLanguageCache: vi.fn(),
      setCurrentLanguage: vi.fn(),
      createMessages: (i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
        const result: any = {};
        for (const key of Object.keys(i18nMap)) {
          result[key] = i18nMap[key]['en'];
        }
        return result;
      },
    }));

    const { MESSAGES: EN_MESSAGES } = await import('../../../src/constants/messages/index.js');

    // MERGE_SUCCESS 英文版用 "Pushed to remote" 而非 "已推送"
    expect(EN_MESSAGES.MERGE_SUCCESS('feat-a', 'fix bug', true)).toContain('Pushed to remote');
    expect(EN_MESSAGES.MERGE_SUCCESS('feat-a', 'fix bug', false)).not.toContain('Pushed to remote');

    // BRANCH_EXISTS 英文版包含 "already exists"
    expect(EN_MESSAGES.BRANCH_EXISTS('feature-a')).toContain('already exists');

    // WORKTREE_CREATED 英文版用 "Created" 而非 "已创建"
    expect(EN_MESSAGES.WORKTREE_CREATED(3)).toContain('Created');

    // ALIAS_SET_SUCCESS 英文版用 "Alias set" 而非 "已设置别名"
    expect(EN_MESSAGES.ALIAS_SET_SUCCESS('ls', 'list')).toContain('Alias set');
  });
});
