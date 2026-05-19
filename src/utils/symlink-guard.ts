import { readdirSync, lstatSync, unlinkSync, readlinkSync } from 'node:fs';
import { join, relative, isAbsolute, resolve } from 'node:path';
import { logger } from '../logger/index.js';

/**
 * 检测路径是否为指向 worktree 外部的外部软链接
 * 外部软链接指目标路径不在当前 worktree 目录树内的符号链接
 * @param {string} linkPath - 软链接的绝对路径
 * @param {string} worktreeRoot - worktree 根目录的绝对路径
 * @returns {boolean} 是否为外部软链接
 */
function isExternalSymlink(linkPath: string, worktreeRoot: string): boolean {
  try {
    const target = readlinkSync(linkPath);
    // 解析软链接目标：如果是相对路径则基于链接所在目录解析
    const resolvedTarget = isAbsolute(target)
      ? target
      : resolve(join(worktreeRoot, target));

    // 判断目标是否在 worktree 目录树之外
    const relativePath = relative(worktreeRoot, resolvedTarget);
    return relativePath.startsWith('..') || isAbsolute(relativePath);
  } catch {
    return false;
  }
}

/**
 * 扫描目录中指向外部路径的软链接
 * 仅扫描顶层目录条目，不递归深入
 * @param {string} dir - 要扫描的目录绝对路径
 * @returns {string[]} 外部软链接的绝对路径列表
 */
export function findExternalSymlinks(dir: string): string[] {
  const externalSymlinks: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        const fullPath = join(dir, entry.name);
        if (isExternalSymlink(fullPath, dir)) {
          externalSymlinks.push(fullPath);
        }
      }
    }
  } catch {
    // 目录不可读时静默返回
  }

  return externalSymlinks;
}

/**
 * 移除目录中指向外部路径的软链接
 * 遍历顶层条目，删除所有指向 worktree 外部的软链接
 * @param {string} dir - 要清理的目录绝对路径
 * @returns {string[]} 被移除的软链接路径列表
 */
export function removeExternalSymlinks(dir: string): string[] {
  const removed: string[] = [];
  const symlinks = findExternalSymlinks(dir);

  for (const linkPath of symlinks) {
    try {
      unlinkSync(linkPath);
      removed.push(linkPath);
      logger.info(`已移除外部软链接: ${linkPath}`);
    } catch (error) {
      logger.warn(`移除外部软链接失败: ${linkPath} - ${error}`);
    }
  }

  return removed;
}
