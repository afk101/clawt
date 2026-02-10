import { basename } from 'node:path';
import { execCommand } from './shell.js';
import { logger } from '../logger/index.js';

/**
 * 获取 git common dir（用于判断是否为主 worktree）
 * @param {string} cwd - 工作目录
 * @returns {string} git common dir 路径
 */
export function getGitCommonDir(cwd?: string): string {
  return execCommand('git rev-parse --git-common-dir', { cwd });
}

/**
 * 获取 git 仓库根目录的绝对路径
 * @param {string} cwd - 工作目录
 * @returns {string} 仓库根目录路径
 */
export function getGitTopLevel(cwd?: string): string {
  return execCommand('git rev-parse --show-toplevel', { cwd });
}

/**
 * 获取项目名（仓库根目录名称）
 * @param {string} cwd - 工作目录
 * @returns {string} 项目名
 */
export function getProjectName(cwd?: string): string {
  const topLevel = getGitTopLevel(cwd);
  return basename(topLevel);
}

/**
 * 检查本地分支是否存在
 * @param {string} branchName - 分支名
 * @param {string} cwd - 工作目录
 * @returns {boolean} 分支是否存在
 */
export function checkBranchExists(branchName: string, cwd?: string): boolean {
  try {
    execCommand(`git show-ref --verify refs/heads/${branchName}`, { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建 worktree 并同时创建新分支
 * @param {string} branchName - 新分支名
 * @param {string} worktreePath - worktree 目录路径
 * @param {string} cwd - 工作目录
 */
export function createWorktree(branchName: string, worktreePath: string, cwd?: string): void {
  logger.info(`创建 worktree: ${worktreePath}`);
  execCommand(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd });
}

/**
 * 强制移除 worktree
 * @param {string} worktreePath - worktree 目录路径
 * @param {string} cwd - 工作目录
 */
export function removeWorktreeByPath(worktreePath: string, cwd?: string): void {
  logger.info(`移除 worktree: ${worktreePath}`);
  execCommand(`git worktree remove -f "${worktreePath}"`, { cwd });
}

/**
 * 强制删除本地分支
 * @param {string} branchName - 分支名
 * @param {string} cwd - 工作目录
 */
export function deleteBranch(branchName: string, cwd?: string): void {
  logger.info(`删除分支: ${branchName}`);
  execCommand(`git branch -D ${branchName}`, { cwd });
}

/**
 * 获取工作区状态（git status --porcelain）
 * @param {string} cwd - 工作目录
 * @returns {string} porcelain 格式输出，为空表示干净
 */
export function getStatusPorcelain(cwd?: string): string {
  return execCommand('git status --porcelain', { cwd });
}

/**
 * 判断工作区是否干净
 * @param {string} cwd - 工作目录
 * @returns {boolean} 是否干净
 */
export function isWorkingDirClean(cwd?: string): boolean {
  return getStatusPorcelain(cwd) === '';
}

/**
 * git add 所有文件
 * @param {string} cwd - 工作目录
 */
export function gitAddAll(cwd?: string): void {
  execCommand('git add .', { cwd });
}

/**
 * git commit
 * @param {string} message - 提交信息
 * @param {string} cwd - 工作目录
 */
export function gitCommit(message: string, cwd?: string): void {
  execCommand(`git commit -m '${message.replace(/'/g, "'\\''")}'`, { cwd });
}

/**
 * git merge
 * @param {string} branchName - 要合并的分支名
 * @param {string} cwd - 工作目录
 */
export function gitMerge(branchName: string, cwd?: string): void {
  execCommand(`git merge ${branchName}`, { cwd });
}

/**
 * 检查是否有合并冲突
 * @param {string} cwd - 工作目录
 * @returns {boolean} 是否有冲突
 */
export function hasMergeConflict(cwd?: string): boolean {
  const status = getStatusPorcelain(cwd);
  // UU = 双方修改冲突, AA = 双方新增冲突, DD = 双方删除
  return status.split('\n').some((line) => /^(UU|AA|DD|DU|UD|AU|UA)/.test(line));
}

/**
 * git pull
 * @param {string} cwd - 工作目录
 */
export function gitPull(cwd?: string): void {
  execCommand('git pull', { cwd });
}

/**
 * git push
 * @param {string} cwd - 工作目录
 */
export function gitPush(cwd?: string): void {
  execCommand('git push', { cwd });
}

/**
 * git reset --hard HEAD
 * @param {string} cwd - 工作目录
 */
export function gitResetHard(cwd?: string): void {
  execCommand('git reset --hard HEAD', { cwd });
}

/**
 * git clean -fd（删除未跟踪文件）
 * @param {string} cwd - 工作目录
 */
export function gitCleanForce(cwd?: string): void {
  execCommand('git clean -fd', { cwd });
}

/**
 * git stash push -m <message>
 * @param {string} message - stash 消息
 * @param {string} cwd - 工作目录
 */
export function gitStashPush(message: string, cwd?: string): void {
  execCommand(`git stash push -m "${message}"`, { cwd });
}

/**
 * git stash apply
 * @param {string} cwd - 工作目录
 */
export function gitStashApply(cwd?: string): void {
  execCommand('git stash apply', { cwd });
}

/**
 * git stash pop stash@{index}
 * @param {number} index - stash 索引
 * @param {string} cwd - 工作目录
 */
export function gitStashPop(index: number = 0, cwd?: string): void {
  execCommand(`git stash pop stash@{${index}}`, { cwd });
}

/**
 * git stash list
 * @param {string} cwd - 工作目录
 * @returns {string} stash 列表输出
 */
export function gitStashList(cwd?: string): string {
  try {
    return execCommand('git stash list', { cwd });
  } catch {
    return '';
  }
}

/**
 * git restore --staged .
 * @param {string} cwd - 工作目录
 */
export function gitRestoreStaged(cwd?: string): void {
  execCommand('git restore --staged .', { cwd });
}

/**
 * 获取 git worktree list 的输出
 * @param {string} cwd - 工作目录
 * @returns {string} worktree 列表
 */
export function gitWorktreeList(cwd?: string): string {
  return execCommand('git worktree list', { cwd });
}

/**
 * 执行 git worktree prune
 * @param {string} cwd - 工作目录
 */
export function gitWorktreePrune(cwd?: string): void {
  execCommand('git worktree prune', { cwd });
}
