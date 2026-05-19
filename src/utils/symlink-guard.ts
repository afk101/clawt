import { readdirSync, lstatSync, unlinkSync, readlinkSync } from 'node:fs';
import { join, relative, isAbsolute, resolve } from 'node:path';
import { logger } from '../logger/index.js';

/**
 * 检测路径是否为指向 worktree 外部的外部软链接
 * @param {string} linkPath - 软链接的绝对路径
 * @param {string} worktreeRoot - worktree 根目录的绝对路径
 * @returns {boolean} 是否为外部软链接
 */
function isExternalSymlink(linkPath: string, worktreeRoot: string): boolean {
  try {
    const target = readlinkSync(linkPath);
    // 顶层软链接的相对路径基于 worktreeRoot 解析
    const resolvedTarget = isAbsolute(target)
      ? target
      : resolve(worktreeRoot, target);

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
 * 同一循环内边扫描边删除，缩小 TOCTOU 窗口；
 * 删除前用 lstatSync 确认目标仍是软链接，避免误删已被替换的普通文件
 * @param {string} dir - 要清理的目录绝对路径
 * @returns {string[]} 被移除的软链接路径列表
 */
export function removeExternalSymlinks(dir: string): string[] {
  const removed: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isSymbolicLink()) continue;

      const fullPath = join(dir, entry.name);
      if (!isExternalSymlink(fullPath, dir)) continue;

      try {
        // lstatSync 不跟随软链接，确认删除前仍是软链接而非被替换的普通文件
        const stat = lstatSync(fullPath);
        if (!stat.isSymbolicLink()) continue;

        unlinkSync(fullPath);
        removed.push(fullPath);
        logger.info(`已移除外部软链接: ${fullPath}`);
      } catch (error) {
        logger.warn(`移除外部软链接失败: ${fullPath} - ${error}`);
      }
    }
  } catch {
    // 目录不可读时静默返回
  }

  return removed;
}
