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
  isWorkingDirClean,
  gitAddAll,
  gitStashPush,
  gitStashApply,
  gitStashPop,
  gitStashList,
  gitRestoreStaged,
  gitResetHard,
  gitCleanForce,
  gitDiffCachedBinary,
  gitApplyCachedFromStdin,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
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
 * 通过 stash 将目标 worktree 的变更迁移到主 worktree
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} branchName - 分支名
 */
function migrateChangesViaStash(targetWorktreePath: string, mainWorktreePath: string, branchName: string): void {
  const stashMessage = `clawt:validate:${branchName}`;
  gitAddAll(targetWorktreePath);
  gitStashPush(stashMessage, targetWorktreePath);
  gitStashApply(targetWorktreePath);
  gitRestoreStaged(targetWorktreePath);

  // 在主 worktree 验证并应用 stash
  const stashList = gitStashList(mainWorktreePath);
  const firstLine = stashList.split('\n')[0] || '';

  if (!firstLine.includes(stashMessage)) {
    throw new ClawtError(MESSAGES.STASH_CHANGED);
  }

  gitStashPop(0, mainWorktreePath);
}

/**
 * 保存当前主 worktree 工作目录变更为纯净快照 patch
 * 操作序列：git add . → git diff --cached --binary → git restore --staged .
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {Buffer} 生成的 patch 内容
 */
function saveCurrentSnapshotPatch(mainWorktreePath: string, projectName: string, branchName: string): Buffer {
  gitAddAll(mainWorktreePath);
  const patch = gitDiffCachedBinary(mainWorktreePath);
  gitRestoreStaged(mainWorktreePath);
  writeSnapshot(projectName, branchName, patch);
  return patch;
}

/**
 * 处理 --clean 选项：清理 validate 状态
 * @param {ValidateOptions} options - 命令选项
 */
function handleValidateClean(options: ValidateOptions): void {
  validateMainWorktree();

  const projectName = getProjectName();
  const mainWorktreePath = getGitTopLevel();

  logger.info(`validate --clean 执行，分支: ${options.branch}`);

  // 清空主 worktree
  if (!isWorkingDirClean(mainWorktreePath)) {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  }

  // 删除对应的 patch 文件
  removeSnapshot(projectName, options.branch);

  printSuccess(MESSAGES.VALIDATE_CLEANED(options.branch));
}

/**
 * 首次 validate 逻辑（无历史快照）
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
function handleFirstValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string): void {
  // 通过 stash 迁移目标 worktree 变更到主 worktree
  migrateChangesViaStash(targetWorktreePath, mainWorktreePath, branchName);

  // 保存纯净快照到 patch 文件
  saveCurrentSnapshotPatch(mainWorktreePath, projectName, branchName);

  // 结果：暂存区=空，工作目录=全量变更
  printSuccess(MESSAGES.VALIDATE_SUCCESS(branchName));
}

/**
 * 增量 validate 逻辑（存在历史快照）
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
function handleIncrementalValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string): void {
  // 步骤 1：读取旧 patch（在清空前读取）
  const oldPatch = readSnapshot(projectName, branchName);

  // 步骤 2：清空主 worktree（丢弃手动修改和上次 validate 留下的变更）
  printInfo(MESSAGES.INCREMENTAL_VALIDATE_RESET);
  gitResetHard(mainWorktreePath);
  gitCleanForce(mainWorktreePath);

  // 步骤 3：从目标 worktree 获取最新全量变更
  migrateChangesViaStash(targetWorktreePath, mainWorktreePath, branchName);

  // 步骤 4：保存最新快照
  const newPatch = saveCurrentSnapshotPatch(mainWorktreePath, projectName, branchName);

  // 步骤 5：将旧 patch 应用到暂存区
  if (oldPatch.length > 0) {
    try {
      gitApplyCachedFromStdin(oldPatch, mainWorktreePath);
    } catch (error) {
      // 旧 patch 无法应用（可能文件结构变化太大），降级为全量模式
      logger.warn(`增量 apply 失败: ${error}`);
      printWarning(MESSAGES.INCREMENTAL_VALIDATE_FALLBACK);
      // 降级后暂存区保持为空，工作目录为最新全量变更，与首次 validate 一致
      printSuccess(MESSAGES.VALIDATE_SUCCESS(branchName));
      return;
    }
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
    handleValidateClean(options);
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

  // 判断是否为增量 validate
  const isIncremental = hasSnapshot(projectName, options.branch);

  if (isIncremental) {
    // 增量模式：检查目标 worktree 是否有变更
    if (isWorkingDirClean(targetWorktreePath)) {
      printInfo(MESSAGES.TARGET_WORKTREE_CLEAN);
      return;
    }
    handleIncrementalValidate(targetWorktreePath, mainWorktreePath, projectName, options.branch);
  } else {
    // 首次模式：先确保主 worktree 干净
    if (!isWorkingDirClean(mainWorktreePath)) {
      await handleDirtyMainWorktree(mainWorktreePath);
    }

    // 检查目标 worktree 是否有变更
    if (isWorkingDirClean(targetWorktreePath)) {
      printInfo(MESSAGES.TARGET_WORKTREE_CLEAN);
      return;
    }

    handleFirstValidate(targetWorktreePath, mainWorktreePath, projectName, options.branch);
  }
}
