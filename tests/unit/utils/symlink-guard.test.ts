import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeExternalSymlinks } from '../../../src/utils/symlink-guard.js';

/** 创建临时测试目录的唯一路径 */
function createTestDir(prefix: string): string {
  return join(tmpdir(), `clawt-test-symlink-${prefix}-${Date.now()}`);
}

describe('symlink-guard', () => {
  let worktreeDir: string;
  let externalDir: string;

  beforeEach(() => {
    worktreeDir = createTestDir('worktree');
    externalDir = createTestDir('external');
    mkdirSync(worktreeDir, { recursive: true });
    mkdirSync(externalDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(worktreeDir, { recursive: true, force: true });
    rmSync(externalDir, { recursive: true, force: true });
  });

  describe('removeExternalSymlinks', () => {
    it('应移除外部软链接并返回被移除的路径列表', () => {
      mkdirSync(join(externalDir, 'node_modules_real'), { recursive: true });
      symlinkSync(join(externalDir, 'node_modules_real'), join(worktreeDir, 'node_modules'));

      const removed = removeExternalSymlinks(worktreeDir);
      expect(removed).toHaveLength(1);
      expect(existsSync(join(worktreeDir, 'node_modules'))).toBe(false);
    });

    it('不应移除内部软链接', () => {
      mkdirSync(join(worktreeDir, 'target'), { recursive: true });
      symlinkSync(join(worktreeDir, 'target'), join(worktreeDir, 'link'));

      const removed = removeExternalSymlinks(worktreeDir);
      expect(removed).toHaveLength(0);
      expect(existsSync(join(worktreeDir, 'link'))).toBe(true);
    });

    it('应处理无软链接的目录', () => {
      const removed = removeExternalSymlinks(worktreeDir);
      expect(removed).toHaveLength(0);
    });

    it('应处理不存在的目录', () => {
      const removed = removeExternalSymlinks('/nonexistent/path/12345');
      expect(removed).toHaveLength(0);
    });

    it('应移除多个外部软链接', () => {
      mkdirSync(join(externalDir, 'target1'), { recursive: true });
      mkdirSync(join(externalDir, 'target2'), { recursive: true });

      symlinkSync(join(externalDir, 'target1'), join(worktreeDir, 'node_modules'));
      symlinkSync(join(externalDir, 'target2'), join(worktreeDir, '.venv'));

      const removed = removeExternalSymlinks(worktreeDir);
      expect(removed).toHaveLength(2);
      expect(existsSync(join(worktreeDir, 'node_modules'))).toBe(false);
      expect(existsSync(join(worktreeDir, '.venv'))).toBe(false);
    });
  });
});
