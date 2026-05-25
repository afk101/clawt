import Enquirer from 'enquirer';
import { VALIDATE_BRANCH_PREFIX, MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import { checkBranchExists, createBranch, deleteBranch, getCurrentBranch, gitCheckout, gitResetHard, gitCleanForce, isWorkingDirClean, gitAddAll, gitStashPush } from './git.js';
import { getMainWorkBranch } from './project-config.js';
import { printWarning, confirmAction } from './formatter.js';
import { ClawtError } from '../errors/index.js';
import { getCurrentLanguage } from './i18n.js';
import { isNonInteractive } from './interactive.js';

/**
 * 生成验证分支名
 * @param {string} branchName - 原始分支名
 * @returns {string} 验证分支名
 */
export function getValidateBranchName(branchName: string): string {
  return `${VALIDATE_BRANCH_PREFIX}${branchName}`;
}

/**
 * 创建验证分支（如果不存在）
 * @param {string} branchName - 原始分支名
 * @param {string} [cwd] - 工作目录
 */
export function createValidateBranch(branchName: string, cwd?: string): void {
  const validateBranchName = getValidateBranchName(branchName);

  if (checkBranchExists(validateBranchName, cwd)) {
    logger.info(`验证分支已存在，跳过创建: ${validateBranchName}`);
    return;
  }

  createBranch(validateBranchName, cwd);
  logger.info(`验证分支已创建: ${validateBranchName}`);
}

/**
 * 删除验证分支（如果存在）
 * @param {string} branchName - 原始分支名
 * @param {string} [cwd] - 工作目录
 */
export function deleteValidateBranch(branchName: string, cwd?: string): void {
  const validateBranchName = getValidateBranchName(branchName);

  if (!checkBranchExists(validateBranchName, cwd)) {
    logger.info(`验证分支不存在，跳过删除: ${validateBranchName}`);
    return;
  }

  deleteBranch(validateBranchName, cwd);
  logger.info(`验证分支已删除: ${validateBranchName}`);
}

/**
 * 重建验证分支（先删除再创建）
 * 确保在主工作分支上创建验证分支，处理三种情况：
 * 1. 已在主工作分支上 → 直接重建
 * 2. 在验证分支上 → 清理工作区后自动切回主工作分支
 * 3. 在其他分支上 → 检查工作区是否干净，不干净则交互处理后切回主工作分支
 * @param {string} branchName - 原始分支名
 * @param {string} [cwd] - 工作目录
 */
export async function rebuildValidateBranch(branchName: string, cwd?: string): Promise<void> {
  const mainBranch = getMainWorkBranch();
  const currentBranch = getCurrentBranch(cwd);

  if (currentBranch === mainBranch) {
    // 已在主工作分支上，无需切换
  } else if (currentBranch.startsWith(VALIDATE_BRANCH_PREFIX)) {
    // 在验证分支上，验证分支的修改是可丢弃的，直接清理后切回
    gitResetHard(cwd);
    gitCleanForce(cwd);
    gitCheckout(mainBranch, cwd);
  } else {
    // 在其他分支上，需确保工作区干净后切回主工作分支
    if (!isWorkingDirClean(cwd)) {
      await handleDirtyWorkingDir(cwd);
    }
    gitCheckout(mainBranch, cwd);
  }

  deleteValidateBranch(branchName, cwd);
  createValidateBranch(branchName, cwd);
  logger.info(`验证分支已重建: ${getValidateBranchName(branchName)}`);
}

/**
 * 处理工作区有未提交更改的情况
 * 提供交互式选择：reset（丢弃所有更改）、stash（暂存更改）、exit（退出让用户手动处理）
 * @param {string} [cwd] - 工作目录
 */
export async function handleDirtyWorkingDir(cwd?: string): Promise<void> {
  // 非交互模式下默认执行 stash（安全策略，不丢弃代码）
  if (isNonInteractive()) {
    gitAddAll(cwd);
    gitStashPush('clawt:auto-stash', cwd);
    if (!isWorkingDirClean(cwd)) {
      throw new ClawtError(MESSAGES.WORKSPACE_STILL_DIRTY);
    }
    return;
  }

  printWarning(MESSAGES.UNCOMMITTED_CHANGES_ON_BRANCH);

  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const choice = await new Enquirer.Select({
    message: MESSAGES.SELECT_ACTION,
    choices: [
      {
        name: 'reset',
        message: getCurrentLanguage() === 'en'
          ? 'reset        - Discard all changes (git reset --hard HEAD && git clean -fd)'
          : 'reset        - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)',
      },
      {
        name: 'stash',
        message: getCurrentLanguage() === 'en'
          ? 'stash        - Stash changes (git add . && git stash)'
          : 'stash        - 暂存更改 (git add . && git stash)',
      },
      {
        name: 'exit',
        message: getCurrentLanguage() === 'en'
          ? 'exit         - Exit, handle manually'
          : 'exit         - 退出，手动处理',
      },
    ],
    initial: 0,
  }).run();

  if (choice === 'exit') {
    throw new ClawtError(MESSAGES.USER_CHOSE_EXIT);
  }

  if (choice === 'reset') {
    gitResetHard(cwd);
    gitCleanForce(cwd);
  } else if (choice === 'stash') {
    gitAddAll(cwd);
    gitStashPush('clawt:auto-stash', cwd);
  }

  // 再次检查是否干净
  if (!isWorkingDirClean(cwd)) {
    throw new ClawtError(MESSAGES.WORKSPACE_STILL_DIRTY);
  }
}

/**
 * 确保当前在主工作分支上
 * 三种情况：
 * 1. 已在主工作分支上 → 直接返回
 * 2. 在验证分支上 → 清理工作区后自动切回主工作分支
 * 3. 在其他分支上 → 警告并确认后，处理脏工作区再切换到主工作分支
 * @param {string} [cwd] - 工作目录
 */
export async function ensureOnMainWorkBranch(cwd?: string): Promise<void> {
  const mainBranch = getMainWorkBranch();
  const currentBranch = getCurrentBranch(cwd);

  // 已在主工作分支上，无需操作
  if (currentBranch === mainBranch) {
    return;
  }

  // 当前在验证分支上，清理工作区后自动切回
  if (currentBranch.startsWith(VALIDATE_BRANCH_PREFIX)) {
    logger.info(`当前在验证分支 ${currentBranch} 上，自动切回主工作分支 ${mainBranch}`);
    // 验证分支上的修改是可丢弃的，直接清理
    if (!isWorkingDirClean(cwd)) {
      gitResetHard(cwd);
      gitCleanForce(cwd);
    }
    gitCheckout(mainBranch, cwd);
    return;
  }

  // 当前在其他分支上，警告并确认后处理脏工作区再切换
  printWarning(MESSAGES.GUARD_BRANCH_MISMATCH(mainBranch, currentBranch));
  // 非交互模式下自动确认继续
  const confirmed = isNonInteractive() ? true : await confirmAction(MESSAGES.CONFIRM_CONTINUE_VALIDATE);
  if (!confirmed) {
    throw new ClawtError(MESSAGES.DESTRUCTIVE_OP_CANCELLED);
  }
  logger.info(`当前在分支 ${currentBranch} 上，需切换到主工作分支 ${mainBranch}`);
  if (!isWorkingDirClean(cwd)) {
    await handleDirtyWorkingDir(cwd);
  }
  gitCheckout(mainBranch, cwd);
}
