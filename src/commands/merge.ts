import type { Command } from 'commander';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES, AUTO_SAVE_COMMIT_MESSAGE_PREFIX } from '../constants/index.js';
import type { MergeOptions } from '../types/index.js';
import { PRE_CHECK_MERGE } from '../constants/index.js';
import {
  runPreChecks,
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  gitPull,
  gitPush,
  hasLocalCommits,
  hasSnapshot,
  removeSnapshot,
  printSuccess,
  printInfo,
  printWarning,
  getConfigValue,
  confirmAction,
  cleanupWorktrees,
  hasCommitWithMessage,
  gitMergeBase,
  gitResetSoftTo,
  gitResetHard,
  gitCleanForce,
  gitCheckout,
  resolveTargetWorktree,
  getMainWorkBranch,
  getCurrentBranch,
  handleMergeConflict,
  promptCommitMessage,
  isNonInteractive,
} from '../utils/index.js';
import type { WorktreeResolveMessages } from '../utils/index.js';

/**
 * 注册 merge 命令：合并验证过的分支到主 worktree
 * @param {Command} program - Commander 实例
 */
export function registerMergeCommand(program: Command): void {
  program
    .command('merge')
    .description('合并某个已验证的 worktree 分支到主 worktree')
    .option('-b, --branch <branchName>', '要合并的分支名（支持模糊匹配，不传则列出所有分支供选择）')
    .option('-m, --message <commitMessage>', '提交信息（目标 worktree 工作区有修改时必填）')
    .option('--auto', '遇到冲突直接调用 AI 解决，不再询问')
    .action(async (options: MergeOptions) => {
      await handleMerge(options);
    });
}

/** merge 命令的分支解析消息配置 */
const MERGE_RESOLVE_MESSAGES: WorktreeResolveMessages = {
  noWorktrees: MESSAGES.MERGE_NO_WORKTREES,
  selectBranch: MESSAGES.MERGE_SELECT_BRANCH,
  multipleMatches: MESSAGES.MERGE_MULTIPLE_MATCHES,
  noMatch: MESSAGES.MERGE_NO_MATCH,
};

/**
 * 执行 squash 提交：暂存所有变更并提交
 * @param {string} message - 提交信息
 * @param {string} worktreePath - 目标 worktree 路径
 * @param {string} branchName - 分支名（用于输出提示）
 */
function commitSquash(message: string, worktreePath: string, branchName: string): void {
  gitAddAll(worktreePath);
  gitCommit(message, worktreePath);
  printSuccess(MESSAGES.MERGE_SQUASH_COMMITTED(branchName));
}

/**
 * 检测并处理目标分支的 auto-save 提交压缩
 * 如果检测到 sync 产生的临时提交，提示用户是否将所有提交压缩为一个
 * @param {string} targetWorktreePath - 目标 worktree 路径
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @param {string} branchName - 分支名
 * @param {string} [commitMessage] - 用户提供的提交信息
 * @returns {Promise<boolean>} 是否需要退出 merge 流程（用户选择 squash 但未提供 -m 时返回 true）
 */
async function handleSquashIfNeeded(
  targetWorktreePath: string,
  mainWorktreePath: string,
  branchName: string,
  commitMessage?: string,
): Promise<boolean> {
  // 检查目标分支是否存在 auto-save commit
  if (!hasCommitWithMessage(branchName, AUTO_SAVE_COMMIT_MESSAGE_PREFIX, mainWorktreePath)) {
    return false;
  }

  // 提示用户是否压缩（非交互模式下默认跳过，保留原始提交）
  const shouldSquash = await confirmAction(MESSAGES.MERGE_SQUASH_PROMPT, false);
  if (!shouldSquash) {
    return false;
  }

  // 获取当前主分支名并计算分叉点
  const mainBranch = getMainWorkBranch();
  const mergeBase = gitMergeBase(mainBranch, branchName, mainWorktreePath);
  logger.info(`squash: merge-base = ${mergeBase}, 分支 = ${branchName}`);

  // 在目标 worktree 中执行 reset --soft 到分叉点
  gitResetSoftTo(mergeBase, targetWorktreePath);

  if (commitMessage) {
    // 有 -m 参数，直接提交
    commitSquash(commitMessage, targetWorktreePath, branchName);
    return false;
  }

  // 非交互模式下保持原有温和退出行为（不执行 gitAddAll，不改变暂存区）
  if (isNonInteractive()) {
    printInfo(MESSAGES.MERGE_SQUASH_PENDING(targetWorktreePath, branchName));
    return true;
  }

  // 交互式询问用户输入提交信息
  const userCommitMessage = await promptCommitMessage(
    MESSAGES.MERGE_SQUASH_PROMPT_COMMIT_MESSAGE,
    MESSAGES.MERGE_SQUASH_PENDING(targetWorktreePath, branchName),
  );
  // 用户输入完成后再提交，避免用户退出时暂存区被不必要地改变
  commitSquash(userCommitMessage, targetWorktreePath, branchName);
  return false;
}

/**
 * 判断 merge 成功后是否需要清理 worktree 和分支
 * 如果全局配置了 autoDeleteBranch 则直接返回 true，否则询问用户
 * @param {string} branchName - 分支名
 * @returns {Promise<boolean>} 是否清理
 */
async function shouldCleanupAfterMerge(branchName: string): Promise<boolean> {
  const autoDelete = getConfigValue('autoDeleteBranch');
  if (autoDelete) {
    printInfo(`已配置自动删除，merge 成功后将自动清理 worktree 和分支: ${branchName}`);
    return true;
  }
  // 非交互模式下自动删除
  return confirmAction(`是否删除对应的 worktree 和分支 (${branchName})？`, true);
}

/**
 * 清理已合并的 worktree 和对应分支
 * @param {string} worktreePath - worktree 目录路径
 * @param {string} branchName - 分支名
 */
function cleanupWorktreeAndBranch(worktreePath: string, branchName: string): void {
  cleanupWorktrees([{ path: worktreePath, branch: branchName }]);
  printSuccess(MESSAGES.WORKTREE_CLEANED(branchName));
}

/**
 * 执行 merge 命令的核心逻辑
 * @param {MergeOptions} options - 命令选项
 */
async function handleMerge(options: MergeOptions): Promise<void> {
  await runPreChecks(PRE_CHECK_MERGE);

  const mainWorktreePath = getGitTopLevel();

  logger.info(`merge 命令执行，分支: ${options.branch ?? '(未指定)'}，提交信息: ${options.message ?? '(未提供)'}`);

  // 解析目标 worktree（精确匹配 / 模糊匹配 / 交互选择）
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, MERGE_RESOLVE_MESSAGES, options.branch);
  const { path: targetWorktreePath, branch } = worktree;

  const projectName = getProjectName();

  // 步骤 3：主 worktree 状态检测
  if (!isWorkingDirClean(mainWorktreePath)) {
    // 如果存在 validate 快照状态，提示用户先清理
    if (hasSnapshot(projectName, branch)) {
      printWarning(MESSAGES.MERGE_VALIDATE_STATE_HINT(branch));
    }
    throw new ClawtError(MESSAGES.MAIN_WORKTREE_DIRTY);
  }

  // 步骤 3.5：检测是否需要 squash（sync 临时提交压缩）
  const shouldExit = await handleSquashIfNeeded(targetWorktreePath, mainWorktreePath, branch, options.message);
  if (shouldExit) {
    return;
  }

  // 步骤 4：根据目标 worktree 状态决定是否需要提交
  const targetClean = isWorkingDirClean(targetWorktreePath);

  if (!targetClean) {
    // 目标 worktree 有未提交修改，需要提交信息
    const commitMessage = options.message
      ?? await promptCommitMessage(
        MESSAGES.MERGE_PROMPT_COMMIT_MESSAGE,
        MESSAGES.TARGET_WORKTREE_DIRTY_NO_MESSAGE(targetWorktreePath),
      );
    gitAddAll(targetWorktreePath);
    gitCommit(commitMessage, targetWorktreePath);
  } else {
    // 目标 worktree 干净，检查是否有本地提交
    if (!hasLocalCommits(branch, mainWorktreePath)) {
      throw new ClawtError(MESSAGES.TARGET_WORKTREE_NO_CHANGES);
    }
    // 有本地提交，跳过提交步骤，直接合并
  }

  // 步骤 5：回到主 worktree 进行合并
  let mergeHadConflict = false;
  try {
    gitMerge(branch, mainWorktreePath);
  } catch (error) {
    // 检查是否有冲突
    if (hasMergeConflict(mainWorktreePath)) {
      mergeHadConflict = true;
    } else {
      throw error;
    }
  }

  // 步骤 5.5：冲突检测（二次确认）
  if (!mergeHadConflict && hasMergeConflict(mainWorktreePath)) {
    mergeHadConflict = true;
  }

  // 步骤 5.6：如果有冲突，尝试 AI 辅助解决
  if (mergeHadConflict) {
    const currentBranch = getCurrentBranch(mainWorktreePath);
    const resolved = await handleMergeConflict(currentBranch, branch, mainWorktreePath, options.auto);
    if (!resolved) {
      // AI 未能完全解决冲突，流程中止（handleMergeConflict 内部已输出提示）
      return;
    }
  }

  // 步骤 7：根据配置决定是否自动 pull 和 push
  const autoPullPush = getConfigValue('autoPullPush');
  if (autoPullPush) {
    // pull 阶段：检测冲突并给出针对性引导
    try {
      gitPull(mainWorktreePath);
    } catch {
      if (hasMergeConflict(mainWorktreePath)) {
        printWarning(MESSAGES.PULL_CONFLICT);
        return;
      }
      throw new ClawtError(MESSAGES.PULL_CONFLICT);
    }
    // push 阶段
    try {
      gitPush(mainWorktreePath);
    } catch {
      printWarning(MESSAGES.PUSH_FAILED);
      return;
    }
  } else {
    printInfo('已跳过自动 pull/push，请手动执行 git pull && git push');
  }

  // 步骤 8：输出成功提示（根据是否有 message 选择对应模板）
  if (options.message) {
    printSuccess(MESSAGES.MERGE_SUCCESS(branch, options.message, autoPullPush));
  } else {
    printSuccess(MESSAGES.MERGE_SUCCESS_NO_MESSAGE(branch, autoPullPush));
  }

  // 步骤 9：merge 成功后确认并清理 worktree 和分支
  const shouldCleanup = await shouldCleanupAfterMerge(branch);
  if (shouldCleanup) {
    cleanupWorktreeAndBranch(targetWorktreePath, branch);
  }

  // 步骤 10：清理 validate 快照（merge 成功后快照已无意义）
  if (hasSnapshot(projectName, branch)) {
    removeSnapshot(projectName, branch);
  }
}
