import { existsSync, mkdirSync, readdirSync, rmdirSync } from 'node:fs';

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
