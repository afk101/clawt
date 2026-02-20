import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmdirSync } from 'node:fs';
import { VALIDATE_SNAPSHOTS_DIR } from '../constants/index.js';
import { ensureDir } from './fs.js';
import { logger } from '../logger/index.js';

/**
 * 获取指定项目和分支的 validate 快照文件路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} tree hash 文件的绝对路径
 */
export function getSnapshotPath(projectName: string, branchName: string): string {
  return join(VALIDATE_SNAPSHOTS_DIR, projectName, `${branchName}.tree`);
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
 * 读取指定项目和分支的 validate 快照中存储的 tree hash
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} tree 对象的 hash
 */
export function readSnapshotTreeHash(projectName: string, branchName: string): string {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  logger.debug(`读取 validate 快照: ${snapshotPath}`);
  return readFileSync(snapshotPath, 'utf-8').trim();
}

/**
 * 写入 validate 快照内容（自动创建目录）
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {string} treeHash - git tree 对象的 hash
 */
export function writeSnapshot(projectName: string, branchName: string, treeHash: string): void {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  const snapshotDir = join(VALIDATE_SNAPSHOTS_DIR, projectName);
  ensureDir(snapshotDir);
  writeFileSync(snapshotPath, treeHash, 'utf-8');
  logger.info(`已保存 validate 快照: ${snapshotPath}`);
}

/**
 * 删除指定项目和分支的 validate 快照
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
export function removeSnapshot(projectName: string, branchName: string): void {
  const snapshotPath = getSnapshotPath(projectName, branchName);
  if (existsSync(snapshotPath)) {
    unlinkSync(snapshotPath);
    logger.info(`已删除 validate 快照: ${snapshotPath}`);
  }
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
