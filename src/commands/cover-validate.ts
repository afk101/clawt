import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES, VALIDATE_BRANCH_PREFIX } from '../constants/index.js';
import {
  runPreChecks,
  getProjectName,
  getGitTopLevel,
  getCurrentBranch,
  getProjectWorktrees,
  findExactMatch,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  gitAddAll,
  gitWriteTree,
  gitReadTree,
  gitDiffTree,
  gitApplyFromStdin,
  printSuccess,
  printInfo,
  isWorkingDirClean,
  confirmAction,
} from '../utils/index.js';

/**
 * 注册 cover-validate 命令：将验证分支上的修改覆盖回目标 worktree
 * @param {Command} program - Commander 实例
 */
export function registerCoverValidateCommand(program: Command): void {
  program
    .command('cover')
    .description('将验证分支上的修改覆盖回目标 worktree（自动推导目标分支）')
    .action(async () => {
      await handleCoverValidate();
    });
}

/**
 * 从验证分支名中提取目标分支名
 * 验证分支名格式为 clawt-validate-<targetBranch>，去掉前缀即为目标分支名
 * @param {string} currentBranch - 当前分支名
 * @returns {string} 目标分支名
 */
export function extractTargetBranchName(currentBranch: string): string {
  return currentBranch.slice(VALIDATE_BRANCH_PREFIX.length);
}

/**
 * 在项目 worktree 列表中查找目标分支对应的 worktree 路径
 * @param {string} branchName - 目标分支名
 * @returns {string} 目标 worktree 的绝对路径
 * @throws {ClawtError} 目标 worktree 不存在时抛出
 */
export function findTargetWorktreePath(branchName: string): string {
  const worktrees = getProjectWorktrees();
  const match = findExactMatch(worktrees, branchName);
  if (!match) {
    throw new ClawtError(MESSAGES.COVER_VALIDATE_TARGET_NOT_FOUND(branchName));
  }
  return match.path;
}

/**
 * 计算验证分支上相对于快照的增量 patch
 * 操作序列：git write-tree（保存暂存区）→ git add . → git write-tree（获取工作区 tree）→ git read-tree（恢复暂存区）
 * 当 snapshotTreeHash 与当前 tree hash 相同时返回 null 表示无变更
 * @param {string} snapshotTreeHash - 快照中记录的 tree hash
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {{ patch: Buffer; currentTreeHash: string } | null} 增量 patch 和当前 tree hash，无变更时返回 null
 */
export function computeIncrementalPatch(snapshotTreeHash: string, mainWorktreePath: string): { patch: Buffer; currentTreeHash: string } | null {
  // 先保存当前暂存区的 tree hash，用于后续恢复
  const savedIndexTreeHash = gitWriteTree(mainWorktreePath);
  let currentTreeHash: string;

  try {
    gitAddAll(mainWorktreePath);
    currentTreeHash = gitWriteTree(mainWorktreePath);
  } finally {
    // 无论成功或失败，都通过 git read-tree 恢复原始暂存区状态
    gitReadTree(savedIndexTreeHash, mainWorktreePath);
  }

  // 快照 tree 与当前 tree 相同，无增量变更
  if (snapshotTreeHash === currentTreeHash) {
    return null;
  }

  const patch = gitDiffTree(snapshotTreeHash, currentTreeHash, mainWorktreePath);
  return { patch, currentTreeHash };
}

/**
 * 执行 cover-validate 命令的核心逻辑
 * 将验证分支上的增量修改（相对于 validate 快照）覆盖到目标 worktree 工作区
 */
async function handleCoverValidate(): Promise<void> {
  // 步骤 1：前置校验
  runPreChecks({ mainWorktree: true, headExists: true, projectConfig: true });
  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();
  const currentBranch = getCurrentBranch(mainWorktreePath);

  // 校验当前分支是验证分支
  if (!currentBranch.startsWith(VALIDATE_BRANCH_PREFIX)) {
    throw new ClawtError(MESSAGES.COVER_VALIDATE_NOT_ON_VALIDATE_BRANCH);
  }

  // 从验证分支名推导目标分支名
  const targetBranchName = extractTargetBranchName(currentBranch);
  logger.info(`cover-validate 命令执行，目标分支: ${targetBranchName}`);

  // 步骤 2：查找目标 worktree
  const targetWorktreePath = findTargetWorktreePath(targetBranchName);

  // 步骤 3：校验快照存在并读取
  if (!hasSnapshot(projectName, targetBranchName)) {
    throw new ClawtError(MESSAGES.COVER_VALIDATE_NO_SNAPSHOT(targetBranchName));
  }
  const { treeHash: snapshotTreeHash } = readSnapshot(projectName, targetBranchName);

  // 步骤 3.5：工作区干净时提示确认，避免误操作
  if (isWorkingDirClean(mainWorktreePath)) {
    printInfo(MESSAGES.COVER_VALIDATE_WORKING_DIR_CLEAN);
    const confirmed = await confirmAction('是否继续执行覆盖？');
    if (!confirmed) return;
  }

  // 步骤 4：计算增量 patch
  const result = computeIncrementalPatch(snapshotTreeHash, mainWorktreePath);
  if (!result) {
    printInfo(MESSAGES.COVER_VALIDATE_NO_CHANGES);
    return;
  }

  // 步骤 5：应用 patch 到目标 worktree
  try {
    gitApplyFromStdin(result.patch, targetWorktreePath);
  } catch (error) {
    logger.error(`cover-validate patch apply 失败: ${error}`);
    throw new ClawtError(MESSAGES.COVER_VALIDATE_APPLY_FAILED(targetBranchName));
  }

  // 步骤 6：更新快照 treeHash（使后续再次 cover 的基准正确），HEAD 和 stagedTreeHash 不变
  writeSnapshot(projectName, targetBranchName, result.currentTreeHash);

  printSuccess(MESSAGES.COVER_VALIDATE_SUCCESS(targetBranchName));
}
