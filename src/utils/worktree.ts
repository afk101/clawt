import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { WORKTREES_DIR } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { createWorktree as gitCreateWorktree, getProjectName, gitWorktreeList, removeWorktreeByPath, deleteBranch, gitWorktreePrune, getCommitCountAhead, getDiffStat, isWorkingDirClean } from './git.js';
import { sanitizeBranchName, generateBranchNames, validateBranchesNotExist } from './branch.js';
import { ensureDir, removeEmptyDir } from './fs.js';
import { createValidateBranch, deleteValidateBranch } from './validate-branch.js';
import { getCurrentBranch } from './git-branch.js';
import { saveWorktreeMetadata, loadWorktreeMetadata, removeWorktreeMetadata } from './worktree-metadata.js';
import type { WorktreeInfo, WorktreeStatus } from '../types/index.js';

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

  // 4. 获取项目名并确保 worktree 目录存在
  const projectName = getProjectName();
  const projectDir = join(WORKTREES_DIR, projectName);
  ensureDir(projectDir);

  // 5. 记录当前分支作为来源分支
  const baseBranch = getCurrentBranch();

  // 6. 串行创建 worktree 及对应验证分支，并保存元数据
  const results: WorktreeInfo[] = [];
  for (const name of branchNames) {
    const worktreePath = join(projectDir, name);
    gitCreateWorktree(name, worktreePath);
    createValidateBranch(name);
    saveWorktreeMetadata(projectName, { branch: name, baseBranch, createdAt: new Date().toISOString() });
    results.push({ path: worktreePath, branch: name, baseBranch });
    logger.info(`worktree 创建完成: ${worktreePath} (分支: ${name})`);
  }

  return results;
}

/**
 * 根据独立分支名列表逐个创建 worktree（不自动编号）
 * 与 createWorktrees 不同，不使用 generateBranchNames 自动编号
 * 调用方负责分支名清理（sanitizeBranchName）
 * @param {string[]} branchNames - 已清理的分支名列表
 * @returns {WorktreeInfo[]} 创建的 worktree 信息列表
 */
export function createWorktreesByBranches(branchNames: string[]): WorktreeInfo[] {
  // 1. 校验所有分支是否都不存在
  validateBranchesNotExist(branchNames);

  // 2. 获取项目名并确保 worktree 目录存在
  const projectName = getProjectName();
  const projectDir = join(WORKTREES_DIR, projectName);
  ensureDir(projectDir);

  // 3. 记录当前分支作为来源分支
  const baseBranch = getCurrentBranch();

  // 4. 串行创建 worktree 及对应验证分支，并保存元数据
  const results: WorktreeInfo[] = [];
  for (const name of branchNames) {
    const worktreePath = join(projectDir, name);
    gitCreateWorktree(name, worktreePath);
    createValidateBranch(name);
    saveWorktreeMetadata(projectName, { branch: name, baseBranch, createdAt: new Date().toISOString() });
    results.push({ path: worktreePath, branch: name, baseBranch });
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
  const projectName = getProjectName();
  const projectDir = join(WORKTREES_DIR, projectName);

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
      // 读取来源分支元数据，无元数据时 baseBranch 为 null
      const metadata = loadWorktreeMetadata(projectName, entry.name);
      worktrees.push({
        path: fullPath,
        branch: entry.name,
        baseBranch: metadata?.baseBranch ?? null,
      });
    }
  }

  return worktrees;
}

/**
 * 批量清理 worktree 及对应分支
 * @param {WorktreeInfo[]} worktrees - 待清理的 worktree 列表
 */
export function cleanupWorktrees(worktrees: WorktreeInfo[]): void {
  const projectName = getProjectName();
  for (const wt of worktrees) {
    try {
      removeWorktreeByPath(wt.path);
      deleteBranch(wt.branch);
      deleteValidateBranch(wt.branch);
      // 删除来源分支元数据
      removeWorktreeMetadata(projectName, wt.branch);
      logger.info(`已清理 worktree 和分支: ${wt.branch}`);
    } catch (error) {
      logger.error(`清理 worktree 失败: ${wt.path} - ${error}`);
    }
  }
  gitWorktreePrune();
  const projectDir = join(WORKTREES_DIR, projectName);
  removeEmptyDir(projectDir);
}

/**
 * 获取 worktree 的变更统计信息
 * 聚合提交数、变更行数、未提交修改状态
 * @param {WorktreeInfo} worktree - worktree 信息
 * @returns {WorktreeStatus | null} 变更统计信息，获取失败时返回 null
 */
export function getWorktreeStatus(worktree: WorktreeInfo): WorktreeStatus | null {
  try {
    const commitCount = getCommitCountAhead(worktree.branch);
    const { insertions, deletions } = getDiffStat(worktree.path);
    const hasDirtyFiles = !isWorkingDirClean(worktree.path);

    return { commitCount, insertions, deletions, hasDirtyFiles };
  } catch (error) {
    logger.error(`获取 worktree 状态失败: ${worktree.path} - ${error}`);
    return null;
  }
}
