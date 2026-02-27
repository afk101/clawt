import { existsSync, mkdirSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 确保目录存在，不存在则递归创建
 * @param {string} dirPath - 目录路径
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 如果目录为空则删除
 * @param {string} dirPath - 目录路径
 * @returns {boolean} 是否删除了目录
 */
export function removeEmptyDir(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return false;
  }
  const entries = readdirSync(dirPath);
  if (entries.length === 0) {
    rmdirSync(dirPath);
    return true;
  }
  return false;
}

/**
 * 递归计算目录占用的磁盘大小（字节）
 * @param {string} dirPath - 目录路径
 * @returns {number} 目录总大小（字节）
 */
export function calculateDirSize(dirPath: string): number {
  let totalSize = 0;

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          totalSize += calculateDirSize(fullPath);
        } else if (entry.isFile()) {
          totalSize += statSync(fullPath).size;
        }
      } catch {
        // 忽略无法访问的文件
      }
    }
  } catch {
    // 忽略无法读取的目录
  }

  return totalSize;
}
