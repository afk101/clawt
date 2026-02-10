import { INVALID_BRANCH_CHARS, MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { printWarning } from './formatter.js';
import { checkBranchExists } from './git.js';
import { ClawtError } from '../errors/index.js';

/**
 * 将分支名中的非法字符替换为 '-'，并压缩连续 '-'、去除首尾 '-'
 * @param {string} branchName - 原始分支名
 * @returns {string} 清理后的合法分支名
 */
export function sanitizeBranchName(branchName: string): string {
  const sanitized = branchName
    .replace(INVALID_BRANCH_CHARS, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  if (sanitized !== branchName) {
    logger.warn(MESSAGES.BRANCH_SANITIZED(branchName, sanitized));
    printWarning(MESSAGES.BRANCH_SANITIZED(branchName, sanitized));
  }

  return sanitized;
}

/**
 * 根据基础分支名和数量生成分支名数组
 * n=1 时返回 [branchName]，n>1 时返回 [branchName-1, ..., branchName-n]
 * @param {string} branchName - 基础分支名
 * @param {number} count - 数量
 * @returns {string[]} 分支名数组
 */
export function generateBranchNames(branchName: string, count: number): string[] {
  if (count === 1) {
    return [branchName];
  }
  return Array.from({ length: count }, (_, i) => `${branchName}-${i + 1}`);
}

/**
 * 校验所有分支名是否都不存在，有任何一个存在则抛出错误
 * @param {string[]} branchNames - 分支名数组
 * @throws {ClawtError} 分支已存在时抛出
 */
export function validateBranchesNotExist(branchNames: string[]): void {
  for (const name of branchNames) {
    if (checkBranchExists(name)) {
      throw new ClawtError(MESSAGES.BRANCH_EXISTS(name));
    }
  }
}
