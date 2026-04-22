import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { WORKTREE_META_DIR } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { ensureDir } from './fs.js';
import { safeStringify } from './json.js';

/**
 * 获取 worktree meta 文件的绝对路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} meta 文件绝对路径
 */
export function getWorktreeMetaPath(projectName: string, branchName: string): string {
  return join(WORKTREE_META_DIR, projectName, `${branchName}.json`);
}

/**
 * 写入 worktree 来源分支 meta 文件
 * 若目录不存在则自动创建
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名（目标 worktree 的分支）
 * @param {string} sourceBranch - 来源主分支名
 */
export function writeWorktreeMeta(projectName: string, branchName: string, sourceBranch: string): void {
  const filePath = getWorktreeMetaPath(projectName, branchName);
  ensureDir(dirname(filePath));
  // safeStringify 传 indent=0 以紧凑格式写入，meta 文件无需人工阅读格式化
  writeFileSync(filePath, safeStringify({ sourceBranch }, 0), 'utf-8');
  logger.info(`写入 worktree meta: ${filePath} (来源分支: ${sourceBranch})`);
}

/**
 * 读取 worktree 来源分支名
 * 文件不存在（老 worktree）时返回 null
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string | null} 来源分支名，文件不存在时返回 null
 */
export function readWorktreeSourceBranch(projectName: string, branchName: string): string | null {
  const filePath = getWorktreeMetaPath(projectName, branchName);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8')) as { sourceBranch?: string };
    return content.sourceBranch ?? null;
  } catch {
    return null;
  }
}

/**
 * 删除单个 worktree 的 meta 文件
 * 文件不存在时静默跳过
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
export function removeWorktreeMeta(projectName: string, branchName: string): void {
  const filePath = getWorktreeMetaPath(projectName, branchName);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    logger.info(`删除 worktree meta: ${filePath}`);
  }
}

/**
 * 删除整个项目的 worktree meta 目录
 * 目录不存在时静默跳过
 * @param {string} projectName - 项目名
 */
export function removeProjectWorktreeMeta(projectName: string): void {
  const projectDir = join(WORKTREE_META_DIR, projectName);
  if (existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true, force: true });
    logger.info(`删除项目 worktree meta 目录: ${projectDir}`);
  }
}
