import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// 使用 vi.hoisted 确保 TEST_META_DIR 在 vi.mock 工厂函数提升执行前已初始化
// vi.mock 会被 vitest 提升到文件顶部，直接引用外部 ESM 导入变量会导致 TDZ 错误
// vi.hoisted 内部使用 require 避免 ESM 提升依赖问题
const { TEST_META_DIR } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('node:os');
  return {
    TEST_META_DIR: nodePath.join(nodeOs.tmpdir(), `clawt-meta-test-${Date.now()}`),
  };
});

vi.mock('../../../src/constants/paths.js', () => ({
  WORKTREE_META_DIR: TEST_META_DIR,
}));

// mock logger，避免 logger/index.ts 顶层执行 mkdirSync(LOGS_DIR) 时因 LOGS_DIR 未 mock 而报错
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  getWorktreeMetaPath,
  writeWorktreeMeta,
  readWorktreeSourceBranch,
  removeWorktreeMeta,
  removeProjectWorktreeMeta,
} from '../../../src/utils/worktree-meta.js';

beforeEach(() => {
  mkdirSync(TEST_META_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_META_DIR, { recursive: true, force: true });
});

describe('getWorktreeMetaPath', () => {
  it('返回正确的 meta 文件路径', () => {
    const result = getWorktreeMetaPath('my-project', 'feature-login');
    expect(result).toBe(join(TEST_META_DIR, 'my-project', 'feature-login.json'));
  });
});

describe('writeWorktreeMeta', () => {
  it('写入 meta 文件，内容为 { sourceBranch }', () => {
    writeWorktreeMeta('my-project', 'feature-login', 'develop');
    const filePath = join(TEST_META_DIR, 'my-project', 'feature-login.json');
    expect(existsSync(filePath)).toBe(true);
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(content).toEqual({ sourceBranch: 'develop' });
  });

  it('目录不存在时自动创建', () => {
    writeWorktreeMeta('new-project', 'feature-x', 'main');
    expect(existsSync(join(TEST_META_DIR, 'new-project', 'feature-x.json'))).toBe(true);
  });
});

describe('readWorktreeSourceBranch', () => {
  it('读取已写入的来源分支名', () => {
    writeWorktreeMeta('my-project', 'feature-login', 'develop');
    const result = readWorktreeSourceBranch('my-project', 'feature-login');
    expect(result).toBe('develop');
  });

  it('文件不存在时返回 null', () => {
    const result = readWorktreeSourceBranch('my-project', 'no-such-branch');
    expect(result).toBeNull();
  });
});

describe('removeWorktreeMeta', () => {
  it('删除已存在的 meta 文件', () => {
    writeWorktreeMeta('my-project', 'feature-login', 'develop');
    removeWorktreeMeta('my-project', 'feature-login');
    expect(existsSync(join(TEST_META_DIR, 'my-project', 'feature-login.json'))).toBe(false);
  });

  it('文件不存在时不抛异常', () => {
    expect(() => removeWorktreeMeta('my-project', 'no-such-branch')).not.toThrow();
  });
});

describe('removeProjectWorktreeMeta', () => {
  it('删除整个项目的 meta 目录', () => {
    writeWorktreeMeta('my-project', 'feature-a', 'main');
    writeWorktreeMeta('my-project', 'feature-b', 'develop');
    removeProjectWorktreeMeta('my-project');
    expect(existsSync(join(TEST_META_DIR, 'my-project'))).toBe(false);
  });

  it('目录不存在时不抛异常', () => {
    expect(() => removeProjectWorktreeMeta('no-such-project')).not.toThrow();
  });
});
