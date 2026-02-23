import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { VALIDATE_SNAPSHOTS_DIR } from '../constants/index.js';
import { ensureDir } from './fs.js';
import { logger } from '../logger/index.js';

/**
 * 获取指定项目和分支的 validate 快照 tree 文件路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} tree hash 文件的绝对路径
 */
export function getSnapshotPath(projectName: string, branchName: string): string {
  return join(VALIDATE_SNAPSHOTS_DIR, projectName, `${branchName}.tree`);
}

/**
 * 获取指定项目和分支的 validate 快照 head 文件路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} head commit hash 文件的绝对路径
 */
function getSnapshotHeadPath(projectName: string, branchName: string): string {
  return join(VALIDATE_SNAPSHOTS_DIR, projectName, `${branchName}.head`);
}

/**
 * 判断指定项目和分支是否存在 validate 快照
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {boolean} 快照是否存在
 */
export function hasSnapshot(projectName: string, branchName: string): boolean {
  return existsSync(getSnapshotPath(projectName, branchName));
}

/**
 * 获取指定项目和分支的 validate 快照文件修改时间
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string | null} ISO 8601 格式的修改时间，快照不存在时返回 null
 */
export function getSnapshotModifiedTime(projectName: string, branchName: string): string | null {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  if (!existsSync(snapshotPath)) return null;
  const stat = statSync(snapshotPath);
  return stat.mtime.toISOString();
}

/**
 * 读取指定项目和分支的 validate 快照中存储的 tree hash
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} tree 对象的 hash
 */
export function readSnapshotTreeHash(projectName: string, branchName: string): string {
  return readSnapshot(projectName, branchName).treeHash;
}

/**
 * 读取指定项目和分支的 validate 快照（tree hash + HEAD commit hash）
 * tree hash 从 .tree 文件读取，HEAD commit hash 从 .head 文件读取
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {{ treeHash: string; headCommitHash: string }} 快照数据
 */
export function readSnapshot(projectName: string, branchName: string): { treeHash: string; headCommitHash: string } {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  const headPath = getSnapshotHeadPath(projectName, branchName);
  logger.debug(`读取 validate 快照: ${snapshotPath}`);

  const treeHash = existsSync(snapshotPath) ? readFileSync(snapshotPath, 'utf-8').trim() : '';
  const headCommitHash = existsSync(headPath) ? readFileSync(headPath, 'utf-8').trim() : '';

  return { treeHash, headCommitHash };
}

/**
 * 写入 validate 快照内容（自动创建目录）
 * tree hash 写入 .tree 文件，HEAD commit hash 写入 .head 文件
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {string} treeHash - git tree 对象的 hash
 * @param {string} headCommitHash - 快照时主 worktree 的 HEAD commit hash
 */
export function writeSnapshot(projectName: string, branchName: string, treeHash: string, headCommitHash: string): void {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  const headPath = getSnapshotHeadPath(projectName, branchName);
  const snapshotDir = join(VALIDATE_SNAPSHOTS_DIR, projectName);
  ensureDir(snapshotDir);
  writeFileSync(snapshotPath, treeHash, 'utf-8');
  writeFileSync(headPath, headCommitHash, 'utf-8');
  logger.info(`已保存 validate 快照: ${snapshotPath}, ${headPath}`);
}

/**
 * 删除指定项目和分支的 validate 快照（.tree + .head）
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
export function removeSnapshot(projectName: string, branchName: string): void {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  const headPath = getSnapshotHeadPath(projectName, branchName);
  if (existsSync(snapshotPath)) {
    unlinkSync(snapshotPath);
    logger.info(`已删除 validate 快照: ${snapshotPath}`);
  }
  if (existsSync(headPath)) {
    unlinkSync(headPath);
    logger.info(`已删除 validate 快照: ${headPath}`);
  }
}

/**
 * 获取指定项目所有存在 validate 快照的分支名列表
 * 通过扫描快照目录下的 .tree 文件名提取
 * @param {string} projectName - 项目名
 * @returns {string[]} 存在快照的分支名列表
 */
export function getProjectSnapshotBranches(projectName: string): string[] {
  const projectDir = join(VALIDATE_SNAPSHOTS_DIR, projectName);
  if (!existsSync(projectDir)) {
    return [];
  }
  const files = readdirSync(projectDir);
  return files
    .filter((f: string) => f.endsWith('.tree'))
    .map((f: string) => f.replace(/\.tree$/, ''));
}

/**
 * 删除指定项目的所有 validate 快照
 * @param {string} projectName - 项目名
 */
export function removeProjectSnapshots(projectName: string): void {
  const projectDir = join(VALIDATE_SNAPSHOTS_DIR, projectName);
  if (!existsSync(projectDir)) {
    return;
  }

  const files = readdirSync(projectDir);
  for (const file of files) {
    unlinkSync(join(projectDir, file));
  }

  // 尝试删除空目录
  try {
    rmdirSync(projectDir);
  } catch {
    // 目录非空或其他原因，忽略
  }

  logger.info(`已删除项目 ${projectName} 的所有 validate 快照`);
}
