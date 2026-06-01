import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import { getCurrentLanguage } from './i18n.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  gitAddAll,
  gitCommit,
  gitRestoreStaged,
  gitDiffBinaryAgainstBranch,
  gitApplyFromStdin,
  gitApplyCachedFromStdin,
  gitResetSoft,
  gitWriteTree,
  gitReadTree,
  getCommitTreeHash,
  gitDiffTree,
  gitApplyCachedCheck,
  getValidateBranchName,
  checkBranchExists,
  gitCheckout,
  getCurrentBranch,
  getHeadCommitHash,
  writeSnapshot,
  printWarning,
  gitCheckIgnored,
  execCommand,
} from './index.js';

/**
 * 根据冲突文件列表生成 git clean 清理命令
 * 按直接父目录去重，生成针对性的清理命令
 * @param {string[]} files - 冲突文件的相对路径列表
 * @returns {string[]} 清理命令列表
 */
function buildCleanCommands(files: string[]): string[] {
  const dirs = new Set<string>();
  for (const file of files) {
    const lastSlash = file.lastIndexOf('/');
    const dir = lastSlash > 0 ? file.substring(0, lastSlash) : '.';
    dirs.add(dir);
  }
  return Array.from(dirs).map(dir => `git clean -fdx ${dir}/`);
}

/**
 * 通过 patch 将目标分支的全量变更（已提交 + 未提交）迁移到主 worktree
 * 使用 git diff HEAD...branch --binary 获取变更，避免 stash 方式无法检测已提交 commit 的问题
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} branchName - 分支名
 * @param {boolean} hasUncommitted - 目标 worktree 是否有未提交修改
 * @returns {{ success: boolean }} patch 迁移结果
 */
export function migrateChangesViaPatch(targetWorktreePath: string, mainWorktreePath: string, branchName: string, hasUncommitted: boolean): { success: boolean } {
  let didTempCommit = false;

  try {
    // 如果有未提交修改，先做临时 commit 以便 diff 能捕获全部变更
    if (hasUncommitted) {
      gitAddAll(targetWorktreePath);
      gitCommit('clawt:temp-commit-for-validate', targetWorktreePath);
      didTempCommit = true;
    }

    // 先执行轻量检测：检测被 .gitignore 忽略的残留文件（幽灵文件），在 apply 之前拦截
    // 使用 --name-only 远比 --binary 便宜，检测到冲突时可跳过昂贵的 binary diff
    const ignoredFiles = detectIgnoredFilesInPatch(branchName, mainWorktreePath);
    if (ignoredFiles.length > 0) {
      const cleanCommands = buildCleanCommands(ignoredFiles);
      logger.warn(`检测到 ${ignoredFiles.length} 个被忽略的残留文件冲突`);
      printWarning(MESSAGES.VALIDATE_IGNORED_FILES_CONFLICT(ignoredFiles, cleanCommands));
      return { success: false };
    }

    // 在主 worktree 执行三点 diff，获取目标分支自分叉点以来的全量变更
    const patch = gitDiffBinaryAgainstBranch(branchName, mainWorktreePath);

    // 应用 patch 到主 worktree 工作目录
    if (patch.length > 0) {
      try {
        gitApplyFromStdin(patch, mainWorktreePath);
      } catch (error) {
        logger.warn(`patch apply 失败: ${error}`);
        printWarning(MESSAGES.VALIDATE_PATCH_APPLY_FAILED(branchName));
        return { success: false };
      }
    }

    return { success: true };
  } finally {
    // 确保临时 commit 一定会被撤销，恢复目标 worktree 原状
    // 每个操作独立 try-catch，避免前一个失败导致后续操作不执行
    if (didTempCommit) {
      try {
        gitResetSoft(1, targetWorktreePath);
      } catch (error) {
        logger.error(`撤销临时 commit 失败: ${error}`);
      }
      try {
        gitRestoreStaged(targetWorktreePath);
      } catch (error) {
        logger.error(`恢复暂存区失败: ${error}`);
      }
    }
  }
}

/**
 * 计算当前主 worktree 工作目录变更的 git tree hash
 * 操作序列：git add . → git write-tree → git restore --staged .
 * 仅计算 tree hash，不写入快照文件
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {string} 当前工作目录变更对应的 tree hash
 */
export function computeCurrentTreeHash(mainWorktreePath: string): string {
  gitAddAll(mainWorktreePath);
  const treeHash = gitWriteTree(mainWorktreePath);
  gitRestoreStaged(mainWorktreePath);
  return treeHash;
}

/**
 * 保存当前主 worktree 工作目录变更为 git tree 对象快照
 * 操作序列：git add . → git write-tree → git restore --staged .
 * 同时保存当前 HEAD commit hash，用于增量 validate 时对齐基准
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {string} [stagedTreeHash=''] - validate 结束时暂存区对应的 tree hash
 * @returns {string} 生成的 tree hash
 */
export function saveCurrentSnapshotTree(mainWorktreePath: string, projectName: string, branchName: string, stagedTreeHash = ''): string {
  gitAddAll(mainWorktreePath);
  const treeHash = gitWriteTree(mainWorktreePath);
  gitRestoreStaged(mainWorktreePath);
  const headCommitHash = getHeadCommitHash(mainWorktreePath);
  writeSnapshot(projectName, branchName, treeHash, headCommitHash, stagedTreeHash);
  return treeHash;
}

/**
 * 将旧快照载入暂存区（从 handleIncrementalValidate 步骤 6 提取）
 * 根据 HEAD 是否变化，选择不同的载入策略：
 * - HEAD 变化：将旧变更 patch 重放到当前 HEAD 暂存区上
 * - HEAD 未变化：直接 read-tree 旧快照
 * @param {string} oldTreeHash - 旧快照的 tree hash
 * @param {string} oldHeadCommitHash - 旧快照时的 HEAD commit hash
 * @param {string} currentHeadCommitHash - 当前的 HEAD commit hash
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {{ success: boolean; stagedTreeHash: string }} 载入结果
 */
export function loadOldSnapshotToStage(oldTreeHash: string, oldHeadCommitHash: string, currentHeadCommitHash: string, mainWorktreePath: string): { success: boolean; stagedTreeHash: string } {
  try {
    if (oldHeadCommitHash && oldHeadCommitHash !== currentHeadCommitHash) {
      // HEAD 发生了变化：
      // 将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上，
      // 避免新旧 tree 基准不同导致 diff 混入 HEAD 变化的内容
      const oldHeadTreeHash = getCommitTreeHash(oldHeadCommitHash, mainWorktreePath);
      const oldChangePatch = gitDiffTree(oldHeadTreeHash, oldTreeHash, mainWorktreePath);

      if (oldChangePatch.length > 0 && gitApplyCachedCheck(oldChangePatch, mainWorktreePath)) {
        // 无冲突：apply --cached 到当前 HEAD 暂存区
        gitApplyCachedFromStdin(oldChangePatch, mainWorktreePath);
        // 记录暂存区的 tree hash（gitWriteTree 不修改暂存区内容，仅生成 tree 对象）
        const stagedTreeHash = gitWriteTree(mainWorktreePath);
        return { success: true, stagedTreeHash };
      } else if (oldChangePatch.length > 0) {
        // 有冲突：降级为全量模式（暂存区保持为空）
        logger.warn(getCurrentLanguage() === 'en' ? 'Old changes patch conflicts with current HEAD, falling back to full mode' : '旧变更 patch 与当前 HEAD 冲突，降级为全量模式');
        return { success: false, stagedTreeHash: '' };
      }
      // oldChangePatch 为空表示旧变更为空，暂存区保持干净即可
      return { success: true, stagedTreeHash: '' };
    } else {
      // HEAD 未变化（或旧版快照无 HEAD 信息）：直接 read-tree 旧快照
      gitReadTree(oldTreeHash, mainWorktreePath);
      return { success: true, stagedTreeHash: oldTreeHash };
    }
  } catch (error) {
    // 旧 tree 对象无法读取（可能被 git gc 回收），降级为全量模式
    logger.warn(`增量 read-tree 失败: ${error}`);
    return { success: false, stagedTreeHash: '' };
  }
}

/**
 * 切换到验证分支（首次/增量 validate 共享逻辑）
 * 校验验证分支是否存在，若当前不在该分支则执行 checkout
 * @param {string} branchName - 原始分支名
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {string} 验证分支名
 */
export function switchToValidateBranch(branchName: string, mainWorktreePath: string): string {
  const validateBranchName = getValidateBranchName(branchName);
  if (!checkBranchExists(validateBranchName)) {
    throw new ClawtError(MESSAGES.VALIDATE_BRANCH_NOT_FOUND(validateBranchName, branchName));
  }
  const currentBranch = getCurrentBranch(mainWorktreePath);
  if (currentBranch !== validateBranchName) {
    gitCheckout(validateBranchName, mainWorktreePath);
  }
  return validateBranchName;
}

/**
 * 检测 patch 中被 .gitignore 忽略且物理存在于主 worktree 的文件（幽灵文件）
 * 这些文件会导致 git apply 失败（"已经存在于工作区中"）
 * @param {string} branchName - 目标分支名
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {string[]} 幽灵文件的相对路径列表
 */
export function detectIgnoredFilesInPatch(branchName: string, mainWorktreePath: string): string[] {
  try {
    const output = execCommand(`git diff --name-only HEAD...${branchName}`, { cwd: mainWorktreePath });
    const patchFiles = output.split('\n').filter(Boolean);
    if (patchFiles.length === 0) return [];

    // 筛选被 .gitignore 忽略且物理存在的文件（幽灵文件）
    return gitCheckIgnored(patchFiles, mainWorktreePath)
      .filter(file => existsSync(join(mainWorktreePath, file)));
  } catch {
    // diff 失败时跳过检测，降级为当前行为（让 apply 自行报错）
    return [];
  }
}
