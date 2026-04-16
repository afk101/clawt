import { execCommand, execCommandAsync } from './shell.js';
import { logger } from '../logger/index.js';

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
 * 强制删除本地分支
 * @param {string} branchName - 分支名
 * @param {string} cwd - 工作目录
 */
export function deleteBranch(branchName: string, cwd?: string): void {
  logger.info(`删除分支: ${branchName}`);
  execCommand(`git branch -D ${branchName}`, { cwd });
}

/**
 * 检查目标分支相对于当前分支是否有本地提交
 * @param {string} branchName - 目标分支名
 * @param {string} cwd - 工作目录
 * @returns {boolean} 是否有本地提交
 */
export function hasLocalCommits(branchName: string, cwd?: string): boolean {
  try {
    const output = execCommand(`git log HEAD..${branchName} --oneline`, { cwd });
    return output.trim() !== '';
  } catch {
    return false;
  }
}

/**
 * 获取目标分支相对于当前分支的新增提交数
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录
 * @returns {number} 新增提交数
 */
export function getCommitCountAhead(branchName: string, cwd?: string): number {
  const output = execCommand(`git rev-list --count HEAD..${branchName}`, { cwd });
  return parseInt(output, 10) || 0;
}

/**
 * 获取目标分支落后于当前分支的提交数
 * 即当前分支有多少提交是目标分支没有的
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录
 * @returns {number} 落后的提交数
 */
export function getCommitCountBehind(branchName: string, cwd?: string): number {
  try {
    const output = execCommand(`git rev-list --count ${branchName}..HEAD`, { cwd });
    return parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * 解析 git rev-list --left-right --count 的输出
 * 输出格式：<left_count>\t<right_count>
 * left = HEAD 侧独有提交数（即 behind），right = branch 侧独有提交数（即 ahead）
 * @param {string} output - rev-list 命令输出
 * @returns {{ ahead: number; behind: number }} 领先和落后的提交数
 */
function parseDivergenceOutput(output: string): { ahead: number; behind: number } {
  const [leftStr, rightStr] = output.trim().split(/\s+/);
  return { ahead: parseInt(rightStr, 10) || 0, behind: parseInt(leftStr, 10) || 0 };
}

/**
 * 获取当前分支与目标分支的双向提交差异
 * 使用单条 git rev-list --left-right --count 命令同时获取领先和落后提交数，
 * 替代分别调用 getCommitCountAhead 和 getCommitCountBehind 两条命令
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录
 * @returns {{ ahead: number; behind: number }} 领先和落后的提交数
 */
export function getCommitDivergence(branchName: string, cwd?: string): { ahead: number; behind: number } {
  try {
    const output = execCommand(`git rev-list --left-right --count HEAD...${branchName}`, { cwd });
    return parseDivergenceOutput(output);
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

/**
 * 异步获取当前分支与目标分支的双向提交差异
 * 用于并行收集多个 worktree 的提交差异时避免串行阻塞
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录
 * @returns {Promise<{ ahead: number; behind: number }>} 领先和落后的提交数
 */
export async function getCommitDivergenceAsync(branchName: string, cwd?: string): Promise<{ ahead: number; behind: number }> {
  try {
    const output = await execCommandAsync(`git rev-list --left-right --count HEAD...${branchName}`, { cwd });
    return parseDivergenceOutput(output);
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

/**
 * 获取当前分支名
 * @param {string} [cwd] - 工作目录
 * @returns {string} 当前分支名
 */
export function getCurrentBranch(cwd?: string): string {
  return execCommand('git rev-parse --abbrev-ref HEAD', { cwd });
}

/**
 * 获取分支的创建时间（通过 reflog 获取分支创建时的时间戳）
 * reflog 的最后一条记录即为分支创建时的记录
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录
 * @returns {string | null} ISO 8601 格式的时间字符串，无法获取时返回 null
 */
export function getBranchCreatedAt(branchName: string, cwd?: string): string | null {
  try {
    const output = execCommand(`git reflog show ${branchName} --format=%cI`, { cwd });
    if (!output.trim()) return null;
    // 取最后一行，即分支创建时的 reflog 记录
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine || null;
  } catch {
    return null;
  }
}

/**
 * 切换到指定分支
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录
 */
export function gitCheckout(branchName: string, cwd?: string): void {
  execCommand(`git checkout ${branchName}`, { cwd });
}

/**
 * 创建本地分支（不切换）
 * @param {string} branchName - 新分支名
 * @param {string} [cwd] - 工作目录
 */
export function createBranch(branchName: string, cwd?: string): void {
  execCommand(`git branch ${branchName}`, { cwd });
}
