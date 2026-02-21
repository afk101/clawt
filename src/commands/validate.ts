import type { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import Enquirer from 'enquirer';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ValidateOptions } from '../types/index.js';
import {
  validateMainWorktree,
  getProjectName,
  getGitTopLevel,
  getProjectWorktreeDir,
  getConfigValue,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitStashPush,
  gitRestoreStaged,
  gitResetHard,
  gitCleanForce,
  gitDiffBinaryAgainstBranch,
  gitApplyFromStdin,
  gitApplyCachedFromStdin,
  gitResetSoft,
  gitWriteTree,
  gitReadTree,
  getHeadCommitHash,
  getCommitTreeHash,
  gitDiffTree,
  gitApplyCachedCheck,
  hasLocalCommits,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
  confirmDestructiveAction,
  printSuccess,
  printWarning,
  printInfo,
} from '../utils/index.js';

/**
 * 注册 validate 命令：在主 worktree 验证其他分支的变更
 * @param {Command} program - Commander 实例
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('在主 worktree 验证某个 worktree 分支的变更')
    .requiredOption('-b, --branch <branchName>', '要验证的分支名')
    .option('--clean', '清理 validate 状态（重置主 worktree 并删除快照）')
    .action(async (options: ValidateOptions) => {
      await handleValidate(options);
    });
}

/**
 * 处理主 worktree 工作区有未提交更改的情况（首次 validate 时使用）
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function handleDirtyMainWorktree(mainWorktreePath: string): Promise<void> {
  printWarning('主 worktree 当前分支有未提交的更改，请选择处理方式：\n');

  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const choice = await new Enquirer.Select({
    message: '选择处理方式',
    choices: [
      {
        name: 'reset',
        message: 'reset (推荐) - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)',
      },
      {
        name: 'stash',
        message: 'stash        - 暂存更改 (git add . && git stash)',
      },
      {
        name: 'exit',
        message: 'exit         - 退出，手动处理',
      },
    ],
    initial: 0,
  }).run();

  if (choice === 'exit') {
    throw new ClawtError('用户选择退出');
  }

  if (choice === 'reset') {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  } else if (choice === 'stash') {
    gitAddAll(mainWorktreePath);
    gitStashPush('clawt:auto-stash', mainWorktreePath);
  }

  // 再次检查是否干净
  if (!isWorkingDirClean(mainWorktreePath)) {
    throw new ClawtError('工作区仍然不干净，请手动处理');
  }
}

/**
 * 通过 patch 将目标分支的全量变更（已提交 + 未提交）迁移到主 worktree
 * 使用 git diff HEAD...branch --binary 获取变更，避免 stash 方式无法检测已提交 commit 的问题
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} branchName - 分支名
 * @param {boolean} hasUncommitted - 目标 worktree 是否有未提交修改
 */
function migrateChangesViaPatch(targetWorktreePath: string, mainWorktreePath: string, branchName: string, hasUncommitted: boolean): void {
  let didTempCommit = false;

  try {
    // 如果有未提交修改，先做临时 commit 以便 diff 能捕获全部变更
    if (hasUncommitted) {
      gitAddAll(targetWorktreePath);
      gitCommit('clawt:temp-commit-for-validate', targetWorktreePath);
      didTempCommit = true;
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
        throw error;
      }
    }
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
 * 保存当前主 worktree 工作目录变更为 git tree 对象快照
 * 操作序列：git add . → git write-tree → git restore --staged .
 * 同时保存当前 HEAD commit hash，用于增量 validate 时对齐基准
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} 生成的 tree hash
 */
function saveCurrentSnapshotTree(mainWorktreePath: string, projectName: string, branchName: string): string {
  gitAddAll(mainWorktreePath);
  const treeHash = gitWriteTree(mainWorktreePath);
  gitRestoreStaged(mainWorktreePath);
  const headCommitHash = getHeadCommitHash(mainWorktreePath);
  writeSnapshot(projectName, branchName, treeHash, headCommitHash);
  return treeHash;
}

/**
 * 处理 --clean 选项：清理 validate 状态
 * @param {ValidateOptions} options - 命令选项
 */
async function handleValidateClean(options: ValidateOptions): Promise<void> {
  validateMainWorktree();

  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();

  logger.info(`validate --clean 执行，分支: ${options.branch}`);

  // 根据配置决定是否需要确认
  if (getConfigValue('confirmDestructiveOps')) {
    const confirmed = await confirmDestructiveAction(
      'git reset --hard + git clean -fd',
      `重置主 worktree 并删除分支 ${options.branch} 的 validate 快照`,
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

  // 删除对应的快照文件
  removeSnapshot(projectName, options.branch);

  printSuccess(MESSAGES.VALIDATE_CLEANED(options.branch));
}

/**
 * 首次 validate 逻辑（无历史快照）
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {boolean} hasUncommitted - 目标 worktree 是否有未提交修改
 */
function handleFirstValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string, hasUncommitted: boolean): void {
  // 通过 patch 迁移目标分支全量变更到主 worktree
  migrateChangesViaPatch(targetWorktreePath, mainWorktreePath, branchName, hasUncommitted);

  // 保存快照为 git tree 对象
  saveCurrentSnapshotTree(mainWorktreePath, projectName, branchName);

  // 结果：暂存区=空，工作目录=全量变更
  printSuccess(MESSAGES.VALIDATE_SUCCESS(branchName));
}

/**
 * 增量 validate 逻辑（存在历史快照）
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @param {boolean} hasUncommitted - 目标 worktree 是否有未提交修改
 */
function handleIncrementalValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string, hasUncommitted: boolean): void {
  // 步骤 1：读取旧快照（tree hash + 当时的 HEAD commit hash）
  const { treeHash: oldTreeHash, headCommitHash: oldHeadCommitHash } = readSnapshot(projectName, branchName);

  // 步骤 2：确保主 worktree 干净（调用方已通过 handleDirtyMainWorktree 处理）
  // 这里做兜底清理，防止 handleDirtyMainWorktree 之后仍有残留
  if (!isWorkingDirClean(mainWorktreePath)) {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  }

  // 步骤 3：通过 patch 从目标分支获取最新全量变更
  migrateChangesViaPatch(targetWorktreePath, mainWorktreePath, branchName, hasUncommitted);

  // 步骤 4：保存最新快照为 git tree 对象（同时记录当前 HEAD）
  saveCurrentSnapshotTree(mainWorktreePath, projectName, branchName);

  // 步骤 5：将旧变更状态载入暂存区
  try {
    const currentHeadCommitHash = getHeadCommitHash(mainWorktreePath);

    if (oldHeadCommitHash && oldHeadCommitHash !== currentHeadCommitHash) {
      // HEAD 发生了变化（如主分支合并了其他分支）：
      // 将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上，
      // 避免新旧 tree 基准不同导致 diff 混入 HEAD 变化的内容
      const oldHeadTreeHash = getCommitTreeHash(oldHeadCommitHash, mainWorktreePath);
      const oldChangePatch = gitDiffTree(oldHeadTreeHash, oldTreeHash, mainWorktreePath);

      if (oldChangePatch.length > 0 && gitApplyCachedCheck(oldChangePatch, mainWorktreePath)) {
        // 无冲突：apply --cached 到当前 HEAD 暂存区
        gitApplyCachedFromStdin(oldChangePatch, mainWorktreePath);
      } else if (oldChangePatch.length > 0) {
        // 有冲突：降级为全量模式（暂存区保持为空）
        logger.warn('旧变更 patch 与当前 HEAD 冲突，降级为全量模式');
        printWarning(MESSAGES.INCREMENTAL_VALIDATE_FALLBACK);
        printSuccess(MESSAGES.VALIDATE_SUCCESS(branchName));
        return;
      }
      // oldChangePatch 为空表示旧变更为空，暂存区保持干净即可
    } else {
      // HEAD 未变化（或旧版快照无 HEAD 信息）：直接 read-tree 旧快照
      gitReadTree(oldTreeHash, mainWorktreePath);
    }
  } catch (error) {
    // 旧 tree 对象无法读取（可能被 git gc 回收），降级为全量模式
    logger.warn(`增量 read-tree 失败: ${error}`);
    printWarning(MESSAGES.INCREMENTAL_VALIDATE_FALLBACK);
    // 降级后暂存区保持为空，工作目录为最新全量变更，与首次 validate 一致
    printSuccess(MESSAGES.VALIDATE_SUCCESS(branchName));
    return;
  }

  // 结果：暂存区=上次快照，工作目录=最新全量变更
  printSuccess(MESSAGES.INCREMENTAL_VALIDATE_SUCCESS(branchName));
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

  validateMainWorktree();

  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();
  const projectDir = getProjectWorktreeDir();
  const targetWorktreePath = join(projectDir, options.branch);

  logger.info(`validate 命令执行，分支: ${options.branch}`);

  // 检查目标 worktree 是否存在
  if (!existsSync(targetWorktreePath)) {
    throw new ClawtError(MESSAGES.WORKTREE_NOT_FOUND(options.branch));
  }

  // 统一检测未提交修改 + 已提交 commit
  const hasUncommitted = !isWorkingDirClean(targetWorktreePath);
  const hasCommitted = hasLocalCommits(options.branch, mainWorktreePath);

  if (!hasUncommitted && !hasCommitted) {
    printInfo(MESSAGES.TARGET_WORKTREE_CLEAN);
    return;
  }

  // 判断是否为增量 validate（tree 对象不依赖主分支 HEAD，无需一致性校验）
  const isIncremental = hasSnapshot(projectName, options.branch);

  if (isIncremental) {
    // 增量模式：主 worktree 有残留状态时让用户选择处理方式
    if (!isWorkingDirClean(mainWorktreePath)) {
      await handleDirtyMainWorktree(mainWorktreePath);
    }
    handleIncrementalValidate(targetWorktreePath, mainWorktreePath, projectName, options.branch, hasUncommitted);
  } else {
    // 首次模式：先确保主 worktree 干净
    if (!isWorkingDirClean(mainWorktreePath)) {
      await handleDirtyMainWorktree(mainWorktreePath);
    }

    handleFirstValidate(targetWorktreePath, mainWorktreePath, projectName, options.branch, hasUncommitted);
  }
}
