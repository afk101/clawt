import { basename } from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { execCommand, execCommandAsync, execCommandWithInput } from './shell.js';
import { logger } from '../logger/index.js';
import { EXEC_MAX_BUFFER, AUTO_SAVE_COMMIT_MESSAGE_PREFIX } from '../constants/git.js';

/**
 * 获取 git common dir（用于判断是否为主 worktree）
 * @param {string} cwd - 工作目录
 * @returns {string} git common dir 路径
 */
export function getGitCommonDir(cwd?: string): string {
  return execCommand('git rev-parse --git-common-dir', { cwd });
}

/**
 * 判断当前是否在主 worktree 中
 * 条件：git rev-parse --git-common-dir === ".git"
 * @param {string} [cwd] - 工作目录
 * @returns {boolean} 是否在主 worktree 中
 */
export function isMainWorktree(cwd?: string): boolean {
  try {
    return getGitCommonDir(cwd) === '.git';
  } catch {
    return false;
  }
}

/**
 * 判断当前是否在 git 仓库中
 * @param {string} [cwd] - 工作目录
 * @returns {boolean} 是否在 git 仓库中
 */
export function isInsideGitRepo(cwd?: string): boolean {
  try {
    execCommand('git rev-parse --is-inside-work-tree', { cwd });
    return true;
  } catch {
    return false;
  }
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
 * 获取主 worktree 的绝对路径
 * 通过 git worktree list --porcelain 解析第一行（始终为主 worktree）
 * @param {string} [cwd] - 工作目录
 * @returns {string} 主 worktree 的绝对路径
 */
export function getMainWorktreePath(cwd?: string): string {
  const output = execCommand('git worktree list --porcelain', { cwd });
  const firstLine = output.split('\n')[0] || '';
  return firstLine.replace('worktree ', '');
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
 * 获取工作区状态（git status --porcelain）
 * @param {string} cwd - 工作目录
 * @returns {string} porcelain 格式输出，为空表示干净
 */
export function getStatusPorcelain(cwd?: string): string {
  return execCommand('git status --porcelain', { cwd });
}

/**
 * 异步获取工作区状态（git status --porcelain）
 * 用于并行收集多个 worktree 状态时避免串行阻塞
 * @param {string} cwd - 工作目录
 * @returns {Promise<string>} porcelain 格式输出，为空表示干净
 */
export async function getStatusPorcelainAsync(cwd?: string): Promise<string> {
  return execCommandAsync('git status --porcelain', { cwd });
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
 * git checkout-index -f -a，将暂存区内容强制写入工作区（覆盖工作区文件）
 * @param {string} [cwd] - 工作目录
 */
export function gitCheckoutIndexForce(cwd?: string): void {
  execCommand('git checkout-index -f -a', { cwd });
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
 * git stash drop stash@{index}
 * @param {number} index - stash 索引
 * @param {string} [cwd] - 工作目录
 */
export function gitStashDrop(index: number = 0, cwd?: string): void {
  execCommand(`git stash drop stash@{${index}}`, { cwd });
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
 * 解析 git diff --shortstat 输出，提取新增行数和删除行数
 * @param {string} output - shortstat 输出字符串
 * @returns {{ insertions: number; deletions: number }} 新增和删除行数
 */
export function parseShortStat(output: string): { insertions: number; deletions: number } {
  let insertions = 0;
  let deletions = 0;

  const insertMatch = output.match(/(\d+)\s+insertion/);
  if (insertMatch) {
    insertions = parseInt(insertMatch[1], 10);
  }

  const deleteMatch = output.match(/(\d+)\s+deletion/);
  if (deleteMatch) {
    deletions = parseInt(deleteMatch[1], 10);
  }

  return { insertions, deletions };
}

/**
 * 获取 worktree 中工作区和暂存区的变更统计
 * @param {string} worktreePath - worktree 目录路径
 * @returns {{ insertions: number; deletions: number }} 新增和删除行数
 */
export function getDiffStat(worktreePath: string): { insertions: number; deletions: number } {
  // 工作区和暂存区相对于 HEAD 的变更
  const output = execCommand('git diff --shortstat HEAD', { cwd: worktreePath });
  return parseShortStat(output);
}

/**
 * 异步获取 worktree 中工作区和暂存区的变更统计
 * 用于并行收集多个 worktree 的 diff 统计时避免串行阻塞
 * @param {string} worktreePath - worktree 目录路径
 * @returns {Promise<{ insertions: number; deletions: number }>} 新增和删除行数
 */
export async function getDiffStatAsync(worktreePath: string): Promise<{ insertions: number; deletions: number }> {
  const output = await execCommandAsync('git diff --shortstat HEAD', { cwd: worktreePath });
  return parseShortStat(output);
}

/**
 * 获取暂存区相对于 HEAD 的完整 diff（含二进制文件）
 * 注意：返回原始输出不做 trim，保留 patch 格式完整性
 * @param {string} [cwd] - 工作目录
 * @returns {Buffer} diff 原始输出（Buffer 格式，保留二进制数据完整性）
 */
export function gitDiffCachedBinary(cwd?: string): Buffer {
  logger.debug(`执行命令: git diff --cached --binary${cwd ? ` (cwd: ${cwd})` : ''}`);
  return execSync('git diff --cached --binary', {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: EXEC_MAX_BUFFER,
  });
}

/**
 * 将 patch 内容通过 stdin 应用到暂存区
 * @param {Buffer} patchContent - patch 内容（Buffer 格式）
 * @param {string} [cwd] - 工作目录
 */
export function gitApplyCachedFromStdin(patchContent: Buffer, cwd?: string): void {
  execCommandWithInput('git', ['apply', '--cached'], { input: patchContent, cwd });
}

/**
 * 获取当前 HEAD 的 commit hash
 * @param {string} [cwd] - 工作目录
 * @returns {string} commit hash
 */
export function getHeadCommitHash(cwd?: string): string {
  return execCommand('git rev-parse HEAD', { cwd });
}

/**
 * 获取目标分支相对于当前分支的已提交变更（含二进制文件）
 * 使用三点 diff（HEAD...branchName）获取自分叉点以来的变更
 * @param {string} branchName - 目标分支名
 * @param {string} [cwd] - 工作目录（应在主 worktree 中执行）
 * @returns {Buffer} diff 原始输出
 */
export function gitDiffBinaryAgainstBranch(branchName: string, cwd?: string): Buffer {
  logger.debug(`执行命令: git diff HEAD...${branchName} --binary${cwd ? ` (cwd: ${cwd})` : ''}`);
  return execSync(`git diff HEAD...${branchName} --binary`, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: EXEC_MAX_BUFFER,
  });
}

/**
 * 将 patch 内容通过 stdin 应用到工作目录（不带 --cached）
 * @param {Buffer} patchContent - patch 内容
 * @param {string} [cwd] - 工作目录
 */
export function gitApplyFromStdin(patchContent: Buffer, cwd?: string): void {
  execCommandWithInput('git', ['apply'], { input: patchContent, cwd });
}

/**
 * git reset --soft HEAD~<count>，撤销 commit 但保留变更在暂存区
 * @param {number} count - 撤销的 commit 数量
 * @param {string} [cwd] - 工作目录
 */
export function gitResetSoft(count: number = 1, cwd?: string): void {
  execCommand(`git reset --soft HEAD~${count}`, { cwd });
}

/**
 * 获取两个分支的分叉点（merge-base）
 * @param {string} branchA - 分支 A
 * @param {string} branchB - 分支 B
 * @param {string} [cwd] - 工作目录
 * @returns {string} merge-base 的 commit hash
 */
export function gitMergeBase(branchA: string, branchB: string, cwd?: string): string {
  return execCommand(`git merge-base ${branchA} ${branchB}`, { cwd });
}

/**
 * 检查目标分支相对于当前分支是否存在指定前缀的 commit message
 * 通过 git log HEAD..<branch> 遍历所有新增 commit 的 message
 * @param {string} branchName - 目标分支名
 * @param {string} messagePrefix - 要匹配的 commit message 前缀
 * @param {string} [cwd] - 工作目录
 * @returns {boolean} 是否存在匹配的 commit
 */
export function hasCommitWithMessage(branchName: string, messagePrefix: string, cwd?: string): boolean {
  try {
    const output = execCommand(`git log HEAD..${branchName} --format=%s`, { cwd });
    if (!output.trim()) return false;
    return output.trim().split('\n').some((msg) => msg.startsWith(messagePrefix));
  } catch {
    return false;
  }
}

/**
 * git reset --soft <commitHash>，将指定 commit 之后的所有提交撤销到暂存区
 * @param {string} commitHash - 目标 commit hash（reset 到此处）
 * @param {string} [cwd] - 工作目录
 */
export function gitResetSoftTo(commitHash: string, cwd?: string): void {
  execCommand(`git reset --soft ${commitHash}`, { cwd });
}

/**
 * 将当前暂存区内容写入 git tree 对象并返回其 hash
 * @param {string} [cwd] - 工作目录
 * @returns {string} tree 对象的 hash
 */
export function gitWriteTree(cwd?: string): string {
  return execCommand('git write-tree', { cwd });
}

/**
 * 将指定 tree 对象的内容载入暂存区（不影响工作目录）
 * @param {string} treeHash - tree 对象的 hash
 * @param {string} [cwd] - 工作目录
 */
export function gitReadTree(treeHash: string, cwd?: string): void {
  execCommand(`git read-tree ${treeHash}`, { cwd });
}

/**
 * 获取指定 commit 对应的 tree 对象 hash
 * @param {string} commitHash - commit hash
 * @param {string} [cwd] - 工作目录
 * @returns {string} tree 对象的 hash
 */
export function getCommitTreeHash(commitHash: string, cwd?: string): string {
  return execCommand(`git rev-parse ${commitHash}^{tree}`, { cwd });
}

/**
 * 获取两个 tree 对象之间的 diff（patch 格式，含二进制）
 * @param {string} baseTreeHash - 基准 tree hash
 * @param {string} targetTreeHash - 目标 tree hash
 * @param {string} [cwd] - 工作目录
 * @returns {Buffer} diff patch 内容
 */
export function gitDiffTree(baseTreeHash: string, targetTreeHash: string, cwd?: string): Buffer {
  logger.debug(`执行命令: git diff-tree -p --binary ${baseTreeHash} ${targetTreeHash}${cwd ? ` (cwd: ${cwd})` : ''}`);
  return execSync(`git diff-tree -p --binary ${baseTreeHash} ${targetTreeHash}`, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: EXEC_MAX_BUFFER,
  });
}

/**
 * 检测 patch 能否无冲突地应用到暂存区（干运行，不实际修改）
 * @param {Buffer} patchContent - patch 内容（Buffer 格式）
 * @param {string} [cwd] - 工作目录
 * @returns {boolean} patch 能否成功应用
 */
export function gitApplyCachedCheck(patchContent: Buffer, cwd?: string): boolean {
  try {
    execCommandWithInput('git', ['apply', '--cached', '--check'], { input: patchContent, cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取冲突文件列表
 * 通过 git status --porcelain 解析 UU/AA/DD 等冲突标记
 * @param {string} [cwd] - 工作目录
 * @returns {string[]} 冲突文件路径列表
 */
export function getConflictFiles(cwd?: string): string[] {
  const status = getStatusPorcelain(cwd);
  if (!status) return [];
  return status
    .split('\n')
    .filter((line) => /^(UU|AA|DD|DU|UD|AU|UA)/.test(line))
    .map((line) => line.slice(3));
}

/**
 * git add 指定文件
 * 使用 execFileSync 数组参数形式避免文件名中特殊字符导致的注入风险
 * @param {string[]} files - 文件路径列表
 * @param {string} [cwd] - 工作目录
 */
export function gitAddFiles(files: string[], cwd?: string): void {
  if (files.length === 0) return;
  const args = ['add', '--', ...files];
  logger.debug(`执行命令: git ${args.join(' ')}${cwd ? ` (cwd: ${cwd})` : ''}`);
  execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * git merge --continue（非交互式）
 * @param {string} [cwd] - 工作目录
 */
export function gitMergeContinue(cwd?: string): void {
  execCommand('GIT_EDITOR=true git merge --continue', { cwd });
}

/**
 * git merge --abort
 * @param {string} [cwd] - 工作目录
 */
export function gitMergeAbort(cwd?: string): void {
  execCommand('git merge --abort', { cwd });
}

/**
 * 生成完整的 auto-save commit message
 * @param {string} mainBranch - 主分支名（被合并的源分支）
 * @param {string} branch - 目标分支名（合并到的分支）
 * @returns {string} 完整的 commit message
 */
export function buildAutoSaveCommitMessage(mainBranch: string, branch: string): string {
  return `${AUTO_SAVE_COMMIT_MESSAGE_PREFIX} ${mainBranch} into ${branch}`;
}

/**
 * 批量检测文件是否被 .gitignore 忽略
 * 使用 git check-ignore 命令，退出码 1 表示无匹配（非错误）
 * @param {string[]} paths - 要检测的文件路径列表
 * @param {string} [cwd] - 工作目录
 * @returns {string[]} 被忽略的文件路径列表
 */
export function gitCheckIgnored(paths: string[], cwd?: string): string[] {
  if (paths.length === 0) return [];

  try {
    const output = execFileSync('git', ['check-ignore', '--', ...paths], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // git check-ignore 退出码 1 表示无匹配文件，属于正常情况
    return [];
  }
}
