import type { Command } from 'commander';
import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import type { StatusOptions, WorktreeDetailedStatus, MainWorktreeStatus, SnapshotInfo, StatusResult, WorktreeInfo } from '../types/index.js';
import {
  validateMainWorktree,
  getProjectName,
  getCurrentBranch,
  isWorkingDirClean,
  getProjectWorktrees,
  getCommitCountAhead,
  getCommitCountBehind,
  getDiffStat,
  hasMergeConflict,
  hasLocalCommits,
  hasSnapshot,
  getProjectSnapshotBranches,
  printInfo,
  printDoubleSeparator,
  printSeparator,
} from '../utils/index.js';

/**
 * 注册 status 命令：显示项目全局状态总览
 * @param {Command} program - Commander 实例
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('显示项目全局状态总览')
    .option('--json', '以 JSON 格式输出')
    .action((options: StatusOptions) => {
      handleStatus(options);
    });
}

/**
 * 执行 status 命令的核心逻辑
 * @param {StatusOptions} options - 命令选项
 */
function handleStatus(options: StatusOptions): void {
  validateMainWorktree();

  const statusResult = collectStatus();

  logger.info(`status 命令执行，项目: ${statusResult.main.projectName}，共 ${statusResult.totalWorktrees} 个 worktree`);

  if (options.json) {
    printStatusAsJson(statusResult);
    return;
  }

  printStatusAsText(statusResult);
}

/**
 * 收集项目全局状态信息
 * @returns {StatusResult} 完整的状态数据
 */
function collectStatus(): StatusResult {
  const projectName = getProjectName();
  const currentBranch = getCurrentBranch();
  const isClean = isWorkingDirClean();

  // 主 worktree 状态
  const main: MainWorktreeStatus = {
    branch: currentBranch,
    isClean,
    projectName,
  };

  // 各 worktree 详细状态
  const worktrees = getProjectWorktrees();
  const worktreeStatuses = worktrees.map((wt) => collectWorktreeDetailedStatus(wt, projectName));

  // 未清理的 validate 快照
  const snapshots = collectSnapshots(projectName, worktrees);

  return {
    main,
    worktrees: worktreeStatuses,
    snapshots,
    totalWorktrees: worktrees.length,
  };
}

/**
 * 收集单个 worktree 的详细状态
 * 变更状态判断优先级：冲突 > 未提交 > 已提交 > 干净
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {string} projectName - 项目名
 * @returns {WorktreeDetailedStatus} 详细状态
 */
function collectWorktreeDetailedStatus(worktree: WorktreeInfo, projectName: string): WorktreeDetailedStatus {
  const changeStatus = detectChangeStatus(worktree);
  const { commitsAhead, commitsBehind } = countCommitDivergence(worktree.branch);
  const { insertions, deletions } = countDiffStat(worktree.path);

  return {
    path: worktree.path,
    branch: worktree.branch,
    changeStatus,
    commitsAhead,
    commitsBehind,
    hasSnapshot: hasSnapshot(projectName, worktree.branch),
    insertions,
    deletions,
  };
}

/**
 * 检测 worktree 的变更状态
 * 优先级：冲突 > 未提交 > 已提交 > 干净
 * @param {WorktreeInfo} worktree - worktree 信息
 * @returns {WorktreeDetailedStatus['changeStatus']} 变更状态
 */
function detectChangeStatus(worktree: WorktreeInfo): WorktreeDetailedStatus['changeStatus'] {
  try {
    if (hasMergeConflict(worktree.path)) {
      return 'conflict';
    }
    if (!isWorkingDirClean(worktree.path)) {
      return 'uncommitted';
    }
    if (hasLocalCommits(worktree.branch)) {
      return 'committed';
    }
    return 'clean';
  } catch {
    return 'clean';
  }
}

/**
 * 统计分支与主分支的提交差异（领先/落后数）
 * @param {string} branchName - 分支名
 * @returns {{ commitsAhead: number; commitsBehind: number }} 领先和落后的提交数
 */
function countCommitDivergence(branchName: string): { commitsAhead: number; commitsBehind: number } {
  try {
    return {
      commitsAhead: getCommitCountAhead(branchName),
      commitsBehind: getCommitCountBehind(branchName),
    };
  } catch {
    return { commitsAhead: 0, commitsBehind: 0 };
  }
}

/**
 * 统计 worktree 的差异行数
 * @param {string} worktreePath - worktree 路径
 * @returns {{ insertions: number; deletions: number }} 新增和删除行数
 */
function countDiffStat(worktreePath: string): { insertions: number; deletions: number } {
  try {
    return getDiffStat(worktreePath);
  } catch {
    return { insertions: 0, deletions: 0 };
  }
}

/**
 * 收集未清理的 validate 快照信息
 * 对比快照分支与现有 worktree 分支，标识孤立快照
 * @param {string} projectName - 项目名
 * @param {WorktreeInfo[]} worktrees - 当前有效的 worktree 列表
 * @returns {SnapshotInfo[]} 快照信息列表
 */
function collectSnapshots(projectName: string, worktrees: WorktreeInfo[]): SnapshotInfo[] {
  const snapshotBranches = getProjectSnapshotBranches(projectName);
  const worktreeBranchSet = new Set(worktrees.map((wt) => wt.branch));

  return snapshotBranches.map((branch) => ({
    branch,
    worktreeExists: worktreeBranchSet.has(branch),
  }));
}

/**
 * 以 JSON 格式输出状态信息
 * @param {StatusResult} result - 状态数据
 */
function printStatusAsJson(result: StatusResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * 以文本格式输出状态信息
 * @param {StatusResult} result - 状态数据
 */
function printStatusAsText(result: StatusResult): void {
  // 标题区域
  printDoubleSeparator();
  printInfo(`  ${chalk.bold.cyan(MESSAGES.STATUS_TITLE(result.main.projectName))}`);
  printDoubleSeparator();
  printInfo('');

  // 主 Worktree 区块
  printMainSection(result.main);
  printSeparator();
  printInfo('');

  // Worktree 列表区块
  printWorktreesSection(result.worktrees, result.totalWorktrees);
  printSeparator();
  printInfo('');

  // 未清理快照区块
  printSnapshotsSection(result.snapshots);

  printDoubleSeparator();
}

/**
 * 输出主 Worktree 区块
 * @param {MainWorktreeStatus} main - 主 worktree 状态
 */
function printMainSection(main: MainWorktreeStatus): void {
  printInfo(`  ${chalk.bold('◆')} ${chalk.bold(MESSAGES.STATUS_MAIN_SECTION)}`);
  printInfo(`    分支: ${chalk.bold(main.branch)}`);
  if (main.isClean) {
    printInfo(`    状态: ${chalk.green('✓ 干净')}`);
  } else {
    printInfo(`    状态: ${chalk.yellow('✗ 有未提交修改')}`);
  }
  printInfo('');
}

/**
 * 输出 Worktree 列表区块
 * @param {WorktreeDetailedStatus[]} worktrees - worktree 详细状态列表
 * @param {number} total - worktree 总数
 */
function printWorktreesSection(worktrees: WorktreeDetailedStatus[], total: number): void {
  printInfo(`  ${chalk.bold('◆')} ${chalk.bold(MESSAGES.STATUS_WORKTREES_SECTION)} (${total} 个)`);
  printInfo('');

  if (worktrees.length === 0) {
    printInfo(`    ${MESSAGES.STATUS_NO_WORKTREES}`);
    return;
  }

  for (const wt of worktrees) {
    printWorktreeItem(wt);
  }
}

/**
 * 输出单个 worktree 状态项
 * @param {WorktreeDetailedStatus} wt - worktree 详细状态
 */
function printWorktreeItem(wt: WorktreeDetailedStatus): void {
  // 分支名 + 变更状态标签
  const statusLabel = formatChangeStatusLabel(wt.changeStatus);
  printInfo(`  ${chalk.bold('●')} ${chalk.bold(wt.branch)}   [${statusLabel}]`);

  // 差异统计行
  const parts: string[] = [];

  // 行数变更（仅在有变更时展示）
  if (wt.insertions > 0 || wt.deletions > 0) {
    parts.push(`${chalk.green(`+${wt.insertions}`)} ${chalk.red(`-${wt.deletions}`)}`);
  }

  // 本地提交数
  if (wt.commitsAhead > 0) {
    parts.push(chalk.yellow(`${wt.commitsAhead} 个本地提交`));
  }

  // 与主分支的同步状态
  if (wt.commitsBehind > 0) {
    parts.push(chalk.yellow(`落后主分支 ${wt.commitsBehind} 个提交`));
  } else {
    parts.push(chalk.green('与主分支同步'));
  }

  printInfo(`    ${parts.join('   ')}`);

  // 快照状态
  if (wt.hasSnapshot) {
    printInfo(`    ${chalk.blue('有 validate 快照')}`);
  }

  printInfo('');
}

/**
 * 将变更状态枚举格式化为带颜色的标签文本
 * @param {WorktreeDetailedStatus['changeStatus']} status - 变更状态
 * @returns {string} 格式化后的标签
 */
function formatChangeStatusLabel(status: WorktreeDetailedStatus['changeStatus']): string {
  switch (status) {
    case 'committed':
      return chalk.green(MESSAGES.STATUS_CHANGE_COMMITTED);
    case 'uncommitted':
      return chalk.yellow(MESSAGES.STATUS_CHANGE_UNCOMMITTED);
    case 'conflict':
      return chalk.red(MESSAGES.STATUS_CHANGE_CONFLICT);
    case 'clean':
      return chalk.gray(MESSAGES.STATUS_CHANGE_CLEAN);
  }
}

/**
 * 输出未清理快照区块
 * @param {SnapshotInfo[]} snapshots - 快照信息列表
 */
function printSnapshotsSection(snapshots: SnapshotInfo[]): void {
  printInfo(`  ${chalk.bold('◆')} ${chalk.bold(MESSAGES.STATUS_SNAPSHOTS_SECTION)} (${snapshots.length} 个)`);
  printInfo('');

  if (snapshots.length === 0) {
    printInfo(`    ${MESSAGES.STATUS_NO_SNAPSHOTS}`);
    printInfo('');
    return;
  }

  for (const snap of snapshots) {
    const orphanLabel = snap.worktreeExists ? '' : `  ${chalk.yellow(MESSAGES.STATUS_SNAPSHOT_ORPHANED)}`;
    const icon = snap.worktreeExists ? chalk.blue('●') : chalk.yellow('⚠');
    printInfo(`  ${icon} ${snap.branch}${orphanLabel}`);
  }
  printInfo('');
}
