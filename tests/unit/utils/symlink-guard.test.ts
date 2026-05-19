import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, symlinkSync, writeFileSync, existsSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findExternalSymlinks, removeExternalSymlinks } from '../../../src/utils/symlink-guard.js';

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

  describe('findExternalSymlinks', () => {
    it('应返回指向 worktree 外部的软链接', () => {
      const externalTarget = join(externalDir, 'node_modules_real');
      mkdirSync(externalTarget, { recursive: true });

      // 创建指向外部路径的软链接
      symlinkSync(externalTarget, join(worktreeDir, 'node_modules'));

      const result = findExternalSymlinks(worktreeDir);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(join(worktreeDir, 'node_modules'));
    });

    it('不应返回指向 worktree 内部的软链接', () => {
      const internalTarget = join(worktreeDir, 'packages_real');
      mkdirSync(internalTarget, { recursive: true });

      // 创建指向内部路径的软链接
      symlinkSync(internalTarget, join(worktreeDir, 'packages'));

      const result = findExternalSymlinks(worktreeDir);
      expect(result).toHaveLength(0);
    });

    it('应忽略普通文件和目录', () => {
      writeFileSync(join(worktreeDir, 'file.txt'), 'content');
      mkdirSync(join(worktreeDir, 'subdir'), { recursive: true });

      const result = findExternalSymlinks(worktreeDir);
      expect(result).toHaveLength(0);
    });

    it('应处理空目录', () => {
      const result = findExternalSymlinks(worktreeDir);
      expect(result).toHaveLength(0);
    });

    it('应处理不存在的目录', () => {
      const result = findExternalSymlinks('/nonexistent/path/12345');
      expect(result).toHaveLength(0);
    });

    it('应检测多个外部软链接', () => {
      mkdirSync(join(externalDir, 'target1'), { recursive: true });
      mkdirSync(join(externalDir, 'target2'), { recursive: true });

      symlinkSync(join(externalDir, 'target1'), join(worktreeDir, 'node_modules'));
      symlinkSync(join(externalDir, 'target2'), join(worktreeDir, '.venv'));

      const result = findExternalSymlinks(worktreeDir);
      expect(result).toHaveLength(2);
    });
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
  });
});
