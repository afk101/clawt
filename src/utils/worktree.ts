import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { WORKTREES_DIR } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { createWorktree as gitCreateWorktree, getProjectName, gitWorktreeList } from './git.js';
import { sanitizeBranchName, generateBranchNames, validateBranchesNotExist } from './branch.js';
import { ensureDir } from './fs.js';
import type { WorktreeInfo } from '../types/index.js';

/**
 * 获取当前项目的 worktree 存放目录
 * @returns {string} 项目 worktree 目录路径
 */
export function getProjectWorktreeDir(): string {
  const projectName = getProjectName();
  return join(WORKTREES_DIR, projectName);
}

/**
 * 批量创建 worktree（串行执行）
 * 包含完整的校验流程：分支名清理 → 分支存在性检查 → 创建
 * @param {string} branchName - 基础分支名
 * @param {number} count - 创建数量
 * @returns {WorktreeInfo[]} 创建的 worktree 信息列表
 */
export function createWorktrees(branchName: string, count: number): WorktreeInfo[] {
  // 1. 分支名清理
  const sanitized = sanitizeBranchName(branchName);

  // 2. 生成分支名列表
  const branchNames = generateBranchNames(sanitized, count);

  // 3. 校验所有分支是否都不存在（在创建任何 worktree 之前）
  validateBranchesNotExist(branchNames);

  // 4. 确保项目 worktree 目录存在
  const projectDir = getProjectWorktreeDir();
  ensureDir(projectDir);

  // 5. 串行创建 worktree
  const results: WorktreeInfo[] = [];
  for (const name of branchNames) {
    const worktreePath = join(projectDir, name);
    gitCreateWorktree(name, worktreePath);
    results.push({ path: worktreePath, branch: name });
    logger.info(`worktree 创建完成: ${worktreePath} (分支: ${name})`);
  }

  return results;
}

/**
 * 获取当前项目在 ~/.clawt/worktrees/<project>/ 下的所有 worktree
 * 通过与 git worktree list 交叉验证确认有效性
 * @returns {WorktreeInfo[]} 有效的 worktree 列表
 */
export function getProjectWorktrees(): WorktreeInfo[] {
  const projectDir = getProjectWorktreeDir();

  if (!existsSync(projectDir)) {
    return [];
  }

  // 获取 git worktree list 的输出，用于交叉验证
  const worktreeListOutput = gitWorktreeList();
  const registeredPaths = new Set(
    worktreeListOutput.split('\n').map((line) => line.split(/\s+/)[0]),
  );

  const entries = readdirSync(projectDir, { withFileTypes: true });
  const worktrees: WorktreeInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fullPath = join(projectDir, entry.name);
    // 交叉验证：路径必须在 git worktree list 中
    if (registeredPaths.has(fullPath)) {
      worktrees.push({
        path: fullPath,
        branch: entry.name,
      });
    }
  }

  return worktrees;
}
