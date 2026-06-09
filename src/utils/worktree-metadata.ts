import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECTS_CONFIG_DIR } from '../constants/index.js';
import { safeStringify } from './json.js';
import { ensureDir } from './fs.js';
import { logger } from '../logger/index.js';
import type { WorktreeMetadata } from '../types/worktree.js';

/**
 * 获取 worktree 元数据文件路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} 元数据文件路径
 */
export function getWorktreeMetadataPath(projectName: string, branchName: string): string {
  return join(PROJECTS_CONFIG_DIR, projectName, 'worktrees', `${branchName}.json`);
}

/**
 * 保存 worktree 来源分支元数据
 * @param {string} projectName - 项目名
 * @param {WorktreeMetadata} metadata - 元数据
 */
export function saveWorktreeMetadata(projectName: string, metadata: WorktreeMetadata): void {
  const metadataPath = getWorktreeMetadataPath(projectName, metadata.branch);
  const metadataDir = join(PROJECTS_CONFIG_DIR, projectName, 'worktrees');

  try {
    ensureDir(metadataDir);
    writeFileSync(metadataPath, safeStringify(metadata), 'utf-8');
  } catch (error) {
    logger.error(`保存 worktree 元数据失败: ${metadataPath}`, error);
    throw error;
  }
}

/**
 * 读取 worktree 来源分支元数据
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {WorktreeMetadata | null} 元数据，不存在或解析失败时返回 null
 */
export function loadWorktreeMetadata(projectName: string, branchName: string): WorktreeMetadata | null {
  const metadataPath = getWorktreeMetadataPath(projectName, branchName);

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content) as WorktreeMetadata;
  } catch (error) {
    logger.warn(`解析 worktree 元数据失败: ${metadataPath}`, error);
    return null;
  }
}

/**
 * 删除 worktree 来源分支元数据
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
export function removeWorktreeMetadata(projectName: string, branchName: string): void {
  const metadataPath = getWorktreeMetadataPath(projectName, branchName);

  try {
    if (existsSync(metadataPath)) {
      rmSync(metadataPath);
    }
  } catch (error) {
    logger.error(`删除 worktree 元数据失败: ${metadataPath}`, error);
  }
}
