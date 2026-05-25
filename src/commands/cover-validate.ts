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
  gitCheckoutIndexForce,
  gitCleanForce,
  printSuccess,
  printInfo,
  isWorkingDirClean,
  confirmAction,
} from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 注册 cover-validate 命令：将验证分支上的修改覆盖回目标 worktree
 * @param {Command} program - Commander 实例
 */
export function registerCoverValidateCommand(program: Command): void {
  program
    .command('cover')
    .description(getCurrentLanguage() === 'en' ? 'Overwrite changes from the validation branch back to the target worktree (auto-detect target branch)' : '将验证分支上的修改覆盖回目标 worktree（自动推导目标分支）')
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
 * 计算验证分支当前的 tree hash（保存并恢复暂存区状态）
 * 操作序列：git write-tree（保存暂存区）→ git add . → git write-tree（获取工作区 tree）→ git read-tree（恢复暂存区）
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {string} 当前工作区对应的 tree hash
 */
export function computeWorktreeTreeHash(mainWorktreePath: string): string {
  const savedIndexTreeHash = gitWriteTree(mainWorktreePath);
  let currentTreeHash: string;

  try {
    gitAddAll(mainWorktreePath);
    currentTreeHash = gitWriteTree(mainWorktreePath);
  } finally {
    gitReadTree(savedIndexTreeHash, mainWorktreePath);
  }

  return currentTreeHash;
}

/**
 * 执行 cover-validate 命令的核心逻辑
 * 将验证分支上的增量修改（相对于 validate 快照）覆盖到目标 worktree 工作区
 */
async function handleCoverValidate(): Promise<void> {
  // 步骤 1：前置校验
  await runPreChecks({ requireMainWorktree: true, requireHead: true, requireProjectConfig: true });
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
    const confirmed = await confirmAction(getCurrentLanguage() === 'en' ? 'Proceed with cover?' : '是否继续执行覆盖？');
    if (!confirmed) return;
  }

  // 步骤 4：计算当前 tree hash
  const currentTreeHash = computeWorktreeTreeHash(mainWorktreePath);

  if (snapshotTreeHash === currentTreeHash) {
    printInfo(MESSAGES.COVER_VALIDATE_NO_CHANGES);
    return;
  }

  // 步骤 5：直接将 tree 应用到目标 worktree
  try {
    gitReadTree(currentTreeHash, targetWorktreePath);
    gitCheckoutIndexForce(targetWorktreePath);
    gitCleanForce(targetWorktreePath);
  } catch (error) {
    logger.error(`cover-validate 覆盖失败: ${error}`);
    throw new ClawtError(MESSAGES.COVER_VALIDATE_COVER_FAILED(targetBranchName));
  }

  // 步骤 6：更新快照 treeHash（使后续再次 cover 的基准正确），HEAD 和 stagedTreeHash 不变
  writeSnapshot(projectName, targetBranchName, currentTreeHash);

  printSuccess(MESSAGES.COVER_VALIDATE_SUCCESS(targetBranchName));
}
