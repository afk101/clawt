import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ValidateOptions } from '../types/index.js';
import { executeSyncForBranch } from './sync.js';
import {
  runPreChecks,
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
  getConfigValue,
  isWorkingDirClean,
  gitResetHard,
  gitCleanForce,
  gitReadTree,
  getHeadCommitHash,
  hasLocalCommits,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
  confirmDestructiveAction,
  confirmAction,
  printSuccess,
  printWarning,
  printInfo,
  resolveTargetWorktree,
  ensureOnMainWorkBranch,
  handleDirtyWorkingDir,
  getValidateRunCommand,
  executeRunCommand,
  migrateChangesViaPatch,
  computeCurrentTreeHash,
  saveCurrentSnapshotTree,
  loadOldSnapshotToStage,
  switchToValidateBranch,
  removeExternalSymlinks,
} from '../utils/index.js';
import type { WorktreeResolveMessages } from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/** validate 命令的分支解析消息配置 */
const VALIDATE_RESOLVE_MESSAGES: WorktreeResolveMessages = {
  noWorktrees: MESSAGES.VALIDATE_NO_WORKTREES,
  selectBranch: MESSAGES.VALIDATE_SELECT_BRANCH,
  multipleMatches: MESSAGES.VALIDATE_MULTIPLE_MATCHES,
  noMatch: MESSAGES.VALIDATE_NO_MATCH,
};

/**
 * 注册 validate 命令：在主 worktree 验证其他分支的变更（通过验证分支）
 * @param {Command} program - Commander 实例
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description(getCurrentLanguage() === 'en' ? 'Validate a worktree branch\'s changes in the main worktree (via validation branch)' : '在主 worktree 验证某个 worktree 分支的变更（通过验证分支）')
    .option('-b, --branch <branchName>', getCurrentLanguage() === 'en' ? 'Branch name to validate (supports fuzzy match, lists all branches if not provided)' : '要验证的分支名（支持模糊匹配，不传则列出所有分支）')
    .option('--clean', getCurrentLanguage() === 'en' ? 'Clean validate state (reset main worktree and delete snapshot)' : '清理 validate 状态（重置主 worktree 并删除快照）')
    .option('-r, --run <command>', getCurrentLanguage() === 'en' ? 'Command to execute in the main worktree after successful validation' : 'validate 成功后在主 worktree 中执行的命令')
    .action(async (options: ValidateOptions) => {
      await handleValidate(options);
    });
}

/**
 * 处理主 worktree 工作区有未提交更改的情况（首次 validate 时使用）
 * 委托给通用的 handleDirtyWorkingDir 函数处理
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function handleDirtyMainWorktree(mainWorktreePath: string): Promise<void> {
  await handleDirtyWorkingDir(mainWorktreePath);
}

/**
 * patch apply 失败后的交互处理：询问用户是否自动执行 sync
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} branchName - 分支名
 */
async function handlePatchApplyFailure(targetWorktreePath: string, branchName: string): Promise<void> {
  // 询问用户是否自动执行 sync
  const confirmed = await confirmAction(MESSAGES.VALIDATE_CONFIRM_AUTO_SYNC(branchName));

  if (!confirmed) {
    // 用户拒绝自动 sync
    printWarning(MESSAGES.VALIDATE_AUTO_SYNC_DECLINED(branchName));
    return;
  }

  // 用户确认，执行 sync
  printInfo(MESSAGES.VALIDATE_AUTO_SYNC_START(branchName));
  const syncResult = await executeSyncForBranch(targetWorktreePath, branchName);

  // sync 冲突提示已在 executeSyncForBranch 内部输出（SYNC_CONFLICT），此处无需重复提示
}

/**
 * 处理 --clean 选项：清理 validate 状态
 * @param {ValidateOptions} options - 命令选项
 */
async function handleValidateClean(options: ValidateOptions): Promise<void> {
  await runPreChecks({ requireMainWorktree: true, requireHead: true, requireProjectConfig: true });

  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();

  // 通过模糊匹配解析目标 worktree
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, VALIDATE_RESOLVE_MESSAGES, options.branch);
  const branchName = worktree.branch;

  logger.info(`validate --clean 执行，分支: ${branchName}`);

  // 根据配置决定是否需要确认
  if (getConfigValue('confirmDestructiveOps')) {
    const confirmed = await confirmDestructiveAction(
      'git reset --hard + git clean -fd',
      getCurrentLanguage() === 'en' ? `Reset main worktree and delete validate snapshot for branch ${branchName}` : `重置主 worktree 并删除分支 ${branchName} 的 validate 快照`,
    );
    if (!confirmed) {
      printInfo(MESSAGES.DESTRUCTIVE_OP_CANCELLED);
      return;
    }
  }

  // 清空主 worktree
  if (!isWorkingDirClean(mainWorktreePath)) {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  }

  // 确保当前在主工作分支上
  await ensureOnMainWorkBranch(mainWorktreePath);

  // 删除对应的快照文件
  removeSnapshot(projectName, branchName);

  printSuccess(MESSAGES.VALIDATE_CLEANED(branchName));
}

/**
 * 首次 validate 逻辑（无历史快照）
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {boolean} hasUncommitted - 目标 worktree 是否有未提交修改
 */
async function handleFirstValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string, hasUncommitted: boolean): Promise<void> {
  // 切换主 worktree 到验证分支
  const validateBranchName = switchToValidateBranch(branchName, mainWorktreePath);

  // 通过 patch 迁移目标分支全量变更到主 worktree
  const result = migrateChangesViaPatch(targetWorktreePath, mainWorktreePath, branchName, hasUncommitted);

  if (!result.success) {
    // patch 失败，确保在主工作分支上后询问用户是否自动 sync
    await ensureOnMainWorkBranch(mainWorktreePath);
    await handlePatchApplyFailure(targetWorktreePath, branchName);
    return;
  }

  // 保存快照为 git tree 对象
  saveCurrentSnapshotTree(mainWorktreePath, projectName, branchName);

  // 结果：暂存区=空，工作目录=全量变更
  printSuccess(MESSAGES.VALIDATE_SUCCESS_WITH_BRANCH(branchName, validateBranchName));
}

/**
 * 增量 validate 逻辑（存在历史快照）
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {boolean} hasUncommitted - 目标 worktree 是否有未提交修改
 */
async function handleIncrementalValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string, hasUncommitted: boolean): Promise<void> {
  // 步骤 1：读取旧快照（tree hash + 当时的 HEAD commit hash + 暂存区 tree hash）
  const { treeHash: oldTreeHash, headCommitHash: oldHeadCommitHash, stagedTreeHash: oldStagedTreeHash } = readSnapshot(projectName, branchName);

  // 步骤 2：确保主 worktree 干净（调用方已通过 handleDirtyMainWorktree 处理）
  // 这里做兜底清理，防止 handleDirtyMainWorktree 之后仍有残留
  if (!isWorkingDirClean(mainWorktreePath)) {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  }

  // 步骤 3：切换到验证分支（如果已在该分支上则跳过）
  const validateBranchName = switchToValidateBranch(branchName, mainWorktreePath);

  // 步骤 4：通过 patch 从目标分支获取最新全量变更
  const result = migrateChangesViaPatch(targetWorktreePath, mainWorktreePath, branchName, hasUncommitted);

  if (!result.success) {
    // patch 失败，确保在主工作分支上后询问用户是否自动 sync
    await ensureOnMainWorkBranch(mainWorktreePath);
    await handlePatchApplyFailure(targetWorktreePath, branchName);
    return;
  }

  // 步骤 5：计算当前变更的 tree hash，检测是否有新变更
  const newTreeHash = computeCurrentTreeHash(mainWorktreePath);
  const currentHeadCommitHash = getHeadCommitHash(mainWorktreePath);

  // 检测目标 worktree 自上次 validate 以来是否有新变更
  const hasNewChanges = newTreeHash !== oldTreeHash
    || (oldHeadCommitHash && oldHeadCommitHash !== currentHeadCommitHash);

  if (!hasNewChanges) {
    // 无新变更：不更新快照，恢复到上次 validate 结束时的完整状态
    if (oldStagedTreeHash) {
      try {
        gitReadTree(oldStagedTreeHash, mainWorktreePath);
      } catch (error) {
        logger.warn(getCurrentLanguage() === 'en' ? `Failed to restore staging area: ${error}` : `恢复暂存区失败: ${error}`);
      }
    }
    printInfo(MESSAGES.INCREMENTAL_VALIDATE_NO_CHANGES(branchName));
    printSuccess(MESSAGES.VALIDATE_SUCCESS_WITH_BRANCH(branchName, validateBranchName));
    return;
  }

  // 有新变更：执行暂存区载入并记录 stagedTreeHash

  // 步骤 6：将旧变更状态载入暂存区
  const stageResult = loadOldSnapshotToStage(oldTreeHash, oldHeadCommitHash, currentHeadCommitHash, mainWorktreePath);
  if (!stageResult.success) {
    printWarning(MESSAGES.INCREMENTAL_VALIDATE_FALLBACK);
    // 降级后暂存区保持为空，工作目录为最新全量变更，与首次 validate 一致
    writeSnapshot(projectName, branchName, newTreeHash, currentHeadCommitHash, '');
    printSuccess(MESSAGES.VALIDATE_SUCCESS_WITH_BRANCH(branchName, validateBranchName));
    return;
  }

  // 步骤 7：写入新快照（包含 stagedTreeHash 供下次无变更时恢复用）
  writeSnapshot(projectName, branchName, newTreeHash, currentHeadCommitHash, stageResult.stagedTreeHash);

  // 结果：暂存区=上次快照，工作目录=最新全量变更
  printSuccess(MESSAGES.INCREMENTAL_VALIDATE_SUCCESS(branchName));
}

/**
 * 解析最终要执行的 run 命令：优先使用 -r 参数，否则从项目配置读取
 * @param {string} [optionRun] - 用户通过 -r 传入的命令
 * @returns {string | undefined} 最终要执行的命令，无配置时返回 undefined
 */
function resolveRunCommand(optionRun?: string): string | undefined {
  if (optionRun) {
    return optionRun;
  }
  return getValidateRunCommand();
}

/**
 * 执行 validate 命令的核心逻辑
 * @param {ValidateOptions} options - 命令选项
 */
async function handleValidate(options: ValidateOptions): Promise<void> {
  // 处理 --clean 选项
  if (options.clean) {
    await handleValidateClean(options);
    return;
  }

  await runPreChecks({ requireMainWorktree: true, requireHead: true, requireProjectConfig: true });

  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();

  // 通过模糊匹配解析目标 worktree
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, VALIDATE_RESOLVE_MESSAGES, options.branch);
  const branchName = worktree.branch;
  const targetWorktreePath = worktree.path;

  logger.info(`validate 命令执行，分支: ${branchName}`);

  // 通常由 AI Agent 创建的指向外部的软链接会导致 patch apply 失败
  const removedSymlinks = removeExternalSymlinks(targetWorktreePath);
  if (removedSymlinks.length > 0) {
    printWarning(MESSAGES.VALIDATE_EXTERNAL_SYMLINKS_FOUND(removedSymlinks.length));
  }

  // 统一检测未提交修改 + 已提交 commit
  const hasUncommitted = !isWorkingDirClean(targetWorktreePath);
  const hasCommitted = hasLocalCommits(branchName, mainWorktreePath);

  if (!hasUncommitted && !hasCommitted) {
    printInfo(MESSAGES.TARGET_WORKTREE_CLEAN);
    return;
  }

  // 判断是否为增量 validate（tree 对象不依赖主分支 HEAD，无需一致性校验）
  const isIncremental = hasSnapshot(projectName, branchName);

  if (isIncremental) {
    // 增量模式：主 worktree 有残留状态时让用户选择处理方式
    if (!isWorkingDirClean(mainWorktreePath)) {
      await handleDirtyMainWorktree(mainWorktreePath);
    }
    await handleIncrementalValidate(targetWorktreePath, mainWorktreePath, projectName, branchName, hasUncommitted);
  } else {
    // 首次模式：先确保主 worktree 干净
    if (!isWorkingDirClean(mainWorktreePath)) {
      await handleDirtyMainWorktree(mainWorktreePath);
    }

    await handleFirstValidate(targetWorktreePath, mainWorktreePath, projectName, branchName, hasUncommitted);
  }

  // validate 成功后执行用户指定的命令（优先 -r 参数，否则从项目配置读取）
  const runCommand = resolveRunCommand(options.run);
  if (runCommand) {
    await executeRunCommand(runCommand, mainWorktreePath);
  }
}
