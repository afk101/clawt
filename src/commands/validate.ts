import type { Command } from 'commander';
import Enquirer from 'enquirer';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { ValidateOptions } from '../types/index.js';
import { executeSyncForBranch } from './sync.js';
import {
  validateMainWorktree,
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
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
  confirmAction,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSeparator,
  resolveTargetWorktree,
  runCommandInherited,
  parseParallelCommands,
  runParallelCommands,
} from '../utils/index.js';
import type { WorktreeResolveMessages, ParallelCommandResult } from '../utils/index.js';

/** validate 命令的分支解析消息配置 */
const VALIDATE_RESOLVE_MESSAGES: WorktreeResolveMessages = {
  noWorktrees: MESSAGES.VALIDATE_NO_WORKTREES,
  selectBranch: MESSAGES.VALIDATE_SELECT_BRANCH,
  multipleMatches: MESSAGES.VALIDATE_MULTIPLE_MATCHES,
  noMatch: MESSAGES.VALIDATE_NO_MATCH,
};

/**
 * 注册 validate 命令：在主 worktree 验证其他分支的变更
 * @param {Command} program - Commander 实例
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('在主 worktree 验证某个 worktree 分支的变更')
    .option('-b, --branch <branchName>', '要验证的分支名（支持模糊匹配，不传则列出所有分支）')
    .option('--clean', '清理 validate 状态（重置主 worktree 并删除快照）')
    .option('-r, --run <command>', 'validate 成功后在主 worktree 中执行的命令')
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
 * @returns {{ success: boolean }} patch 迁移结果
 */
function migrateChangesViaPatch(targetWorktreePath: string, mainWorktreePath: string, branchName: string, hasUncommitted: boolean): { success: boolean } {
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
  const syncResult = executeSyncForBranch(targetWorktreePath, branchName);

  // sync 冲突提示已在 executeSyncForBranch 内部输出（SYNC_CONFLICT），此处无需重复提示
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

  // 通过模糊匹配解析目标 worktree
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, VALIDATE_RESOLVE_MESSAGES, options.branch);
  const branchName = worktree.branch;

  logger.info(`validate --clean 执行，分支: ${branchName}`);

  // 根据配置决定是否需要确认
  if (getConfigValue('confirmDestructiveOps')) {
    const confirmed = await confirmDestructiveAction(
      'git reset --hard + git clean -fd',
      `重置主 worktree 并删除分支 ${branchName} 的 validate 快照`,
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
  // 通过 patch 迁移目标分支全量变更到主 worktree
  const result = migrateChangesViaPatch(targetWorktreePath, mainWorktreePath, branchName, hasUncommitted);

  if (!result.success) {
    // patch 失败，询问用户是否自动 sync
    await handlePatchApplyFailure(targetWorktreePath, branchName);
    return;
  }

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
async function handleIncrementalValidate(targetWorktreePath: string, mainWorktreePath: string, projectName: string, branchName: string, hasUncommitted: boolean): Promise<void> {
  // 步骤 1：读取旧快照（tree hash + 当时的 HEAD commit hash）
  const { treeHash: oldTreeHash, headCommitHash: oldHeadCommitHash } = readSnapshot(projectName, branchName);

  // 步骤 2：确保主 worktree 干净（调用方已通过 handleDirtyMainWorktree 处理）
  // 这里做兜底清理，防止 handleDirtyMainWorktree 之后仍有残留
  if (!isWorkingDirClean(mainWorktreePath)) {
    gitResetHard(mainWorktreePath);
    gitCleanForce(mainWorktreePath);
  }

  // 步骤 3：通过 patch 从目标分支获取最新全量变更
  const result = migrateChangesViaPatch(targetWorktreePath, mainWorktreePath, branchName, hasUncommitted);

  if (!result.success) {
    // patch 失败，询问用户是否自动 sync
    await handlePatchApplyFailure(targetWorktreePath, branchName);
    return;
  }

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
 * 执行单个命令（同步方式，保持原有行为不变）
 * @param {string} command - 要执行的命令字符串
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
function executeSingleCommand(command: string, mainWorktreePath: string): void {
  printInfo(MESSAGES.VALIDATE_RUN_START(command));
  printSeparator();

  const result = runCommandInherited(command, { cwd: mainWorktreePath });

  printSeparator();

  if (result.error) {
    // 进程启动失败（如命令不存在）
    printError(MESSAGES.VALIDATE_RUN_ERROR(command, result.error.message));
    return;
  }

  const exitCode = result.status ?? 1;
  if (exitCode === 0) {
    printSuccess(MESSAGES.VALIDATE_RUN_SUCCESS(command));
  } else {
    printError(MESSAGES.VALIDATE_RUN_FAILED(command, exitCode));
  }
}

/**
 * 汇总输出并行命令的执行结果
 * @param {ParallelCommandResult[]} results - 各命令的执行结果数组
 */
function reportParallelResults(results: ParallelCommandResult[]): void {
  printSeparator();

  const successCount = results.filter((r) => r.exitCode === 0 && !r.error).length;
  const failedCount = results.length - successCount;

  for (const result of results) {
    if (result.error) {
      printError(MESSAGES.VALIDATE_PARALLEL_CMD_ERROR(result.command, result.error));
    } else if (result.exitCode === 0) {
      printSuccess(MESSAGES.VALIDATE_PARALLEL_CMD_SUCCESS(result.command));
    } else {
      printError(MESSAGES.VALIDATE_PARALLEL_CMD_FAILED(result.command, result.exitCode));
    }
  }

  if (failedCount === 0) {
    printSuccess(MESSAGES.VALIDATE_PARALLEL_RUN_ALL_SUCCESS(results.length));
  } else {
    printError(MESSAGES.VALIDATE_PARALLEL_RUN_SUMMARY(successCount, failedCount));
  }
}

/**
 * 并行执行多个命令并汇总结果
 * @param {string[]} commands - 要并行执行的命令数组
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function executeParallelCommands(commands: string[], mainWorktreePath: string): Promise<void> {
  printInfo(MESSAGES.VALIDATE_PARALLEL_RUN_START(commands.length));

  for (let i = 0; i < commands.length; i++) {
    printInfo(MESSAGES.VALIDATE_PARALLEL_CMD_START(i + 1, commands.length, commands[i]));
  }

  printSeparator();

  const results = await runParallelCommands(commands, { cwd: mainWorktreePath });

  reportParallelResults(results);
}

/**
 * 在主 worktree 中执行用户指定的命令
 * 根据命令字符串中的 & 分隔符决定是单命令执行还是并行执行
 * 命令执行失败不影响 validate 本身的结果，仅输出提示
 * @param {string} command - 要执行的命令字符串
 * @param {string} mainWorktreePath - 主 worktree 路径
 */
async function executeRunCommand(command: string, mainWorktreePath: string): Promise<void> {
  printInfo('');

  const commands = parseParallelCommands(command);

  if (commands.length <= 1) {
    // 单命令（包括含 && 的串行命令），走原有同步路径
    executeSingleCommand(commands[0] || command, mainWorktreePath);
  } else {
    // 多命令，并行执行
    await executeParallelCommands(commands, mainWorktreePath);
  }
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

  // 通过模糊匹配解析目标 worktree
  const worktrees = getProjectWorktrees();
  const worktree = await resolveTargetWorktree(worktrees, VALIDATE_RESOLVE_MESSAGES, options.branch);
  const branchName = worktree.branch;
  const targetWorktreePath = worktree.path;

  logger.info(`validate 命令执行，分支: ${branchName}`);

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

  // validate 成功后执行用户指定的命令
  if (options.run) {
    await executeRunCommand(options.run, mainWorktreePath);
  }
}
