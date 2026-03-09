import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock getProjectName 返回固定项目名
vi.mock('../../../src/utils/git.js', () => ({
  getProjectName: vi.fn().mockReturnValue('test-project'),
}));

// mock SESSIONS_DIR 使用临时目录，使用 /tmp 下的固定路径避免 hoisting 问题
vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  const os = await import('node:os');
  const path = await import('node:path');
  return {
    ...actual,
    SESSIONS_DIR: path.join(os.tmpdir(), 'clawt-session-test'),
    SESSION_FILE_EXTENSION: '.session',
  };
});

import {
  getSessionFilePath,
  saveSessionId,
  loadSessionId,
  removeSessionId,
  persistSessionIds,
} from '../../../src/utils/session.js';

/** 测试用 session 目录，与 mock 中的值保持一致 */
const TEST_SESSIONS_DIR = join(tmpdir(), 'clawt-session-test');

beforeEach(() => {
  // 确保测试目录干净
  if (existsSync(TEST_SESSIONS_DIR)) {
    rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
  }
});

afterEach(() => {
  // 清理测试目录
  if (existsSync(TEST_SESSIONS_DIR)) {
    rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
  }
});

describe('getSessionFilePath', () => {
  it('返回正确的 session 文件路径', () => {
    const result = getSessionFilePath('feature-branch');
    expect(result).toBe(join(TEST_SESSIONS_DIR, 'test-project', 'feature-branch.session'));
  });
});

describe('saveSessionId', () => {
  it('保存 session_id 到文件', () => {
    const sessionId = 'abc-123-def-456';
    saveSessionId('feature', sessionId);

    const filePath = getSessionFilePath('feature');
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe(sessionId);
  });

  it('覆盖已有的 session_id', () => {
    saveSessionId('feature', 'old-id');
    saveSessionId('feature', 'new-id');

    const filePath = getSessionFilePath('feature');
    expect(readFileSync(filePath, 'utf-8')).toBe('new-id');
  });
});

describe('loadSessionId', () => {
  it('读取已保存的 session_id', () => {
    saveSessionId('feature', 'test-session-id');
    expect(loadSessionId('feature')).toBe('test-session-id');
  });

  it('文件不存在时返回 null', () => {
    expect(loadSessionId('nonexistent')).toBeNull();
  });

  it('文件为空时返回 null', () => {
    const filePath = getSessionFilePath('empty-branch');
    const dir = join(filePath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, '', 'utf-8');

    expect(loadSessionId('empty-branch')).toBeNull();
  });

  it('文件只有空白时返回 null', () => {
    const filePath = getSessionFilePath('whitespace-branch');
    const dir = join(filePath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, '  \n  ', 'utf-8');

    expect(loadSessionId('whitespace-branch')).toBeNull();
  });
});

describe('removeSessionId', () => {
  it('删除已有的 session 文件', () => {
    saveSessionId('feature', 'test-id');
    const filePath = getSessionFilePath('feature');
    expect(existsSync(filePath)).toBe(true);

    removeSessionId('feature');
    expect(existsSync(filePath)).toBe(false);
  });

  it('文件不存在时静默忽略', () => {
    expect(() => removeSessionId('nonexistent')).not.toThrow();
  });
});

describe('persistSessionIds', () => {
  it('批量保存成功任务的 session_id', () => {
    const results = [
      {
        task: 'task1',
        branch: 'branch-1',
        worktreePath: '/path/branch-1',
        success: true,
        result: { session_id: 'session-1', is_error: false, duration_ms: 1000, duration_api_ms: 800, num_turns: 1, result: 'done', stop_reason: 'end', total_cost_usd: 0.01, usage: {}, type: 'result', subtype: 'success' },
      },
      {
        task: 'task2',
        branch: 'branch-2',
        worktreePath: '/path/branch-2',
        success: true,
        result: { session_id: 'session-2', is_error: false, duration_ms: 2000, duration_api_ms: 1600, num_turns: 2, result: 'done', stop_reason: 'end', total_cost_usd: 0.02, usage: {}, type: 'result', subtype: 'success' },
      },
    ];

    persistSessionIds(results as any);

    expect(loadSessionId('branch-1')).toBe('session-1');
    expect(loadSessionId('branch-2')).toBe('session-2');
  });

  it('跳过失败的任务', () => {
    const results = [
      {
        task: 'task1',
        branch: 'branch-ok',
        worktreePath: '/path/branch-ok',
        success: true,
        result: { session_id: 'session-ok', is_error: false, duration_ms: 1000, duration_api_ms: 800, num_turns: 1, result: 'done', stop_reason: 'end', total_cost_usd: 0.01, usage: {}, type: 'result', subtype: 'success' },
      },
      {
        task: 'task2',
        branch: 'branch-fail',
        worktreePath: '/path/branch-fail',
        success: false,
        result: null,
        error: '任务执行失败',
      },
    ];

    persistSessionIds(results as any);

    expect(loadSessionId('branch-ok')).toBe('session-ok');
    expect(loadSessionId('branch-fail')).toBeNull();
  });

  it('跳过无 session_id 的成功任务', () => {
    const results = [
      {
        task: 'task1',
        branch: 'branch-no-session',
        worktreePath: '/path/branch-no-session',
        success: true,
        result: { is_error: false, duration_ms: 1000, duration_api_ms: 800, num_turns: 1, result: 'done', stop_reason: 'end', total_cost_usd: 0.01, usage: {}, type: 'result', subtype: 'success' },
      },
    ];

    persistSessionIds(results as any);

    expect(loadSessionId('branch-no-session')).toBeNull();
  });

  it('空结果数组不报错', () => {
    expect(() => persistSessionIds([])).not.toThrow();
  });
});
