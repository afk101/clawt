export { execCommand, spawnProcess, killAllChildProcesses, execCommandWithInput } from './shell.js';
export {
  getGitCommonDir,
  getGitTopLevel,
  getProjectName,
  checkBranchExists,
  createWorktree,
  removeWorktreeByPath,
  deleteBranch,
  getStatusPorcelain,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitMerge,
  hasMergeConflict,
  gitPull,
  gitPush,
  gitResetHard,
  gitCleanForce,
  gitStashPush,
  gitStashApply,
  gitStashPop,
  gitStashDrop,
  gitStashList,
  gitRestoreStaged,
  gitWorktreeList,
  gitWorktreePrune,
  hasLocalCommits,
  getCommitCountAhead,
  getCommitCountBehind,
  getDiffStat,
  gitDiffCachedBinary,
  gitApplyCachedFromStdin,
  getCurrentBranch,
  getHeadCommitHash,
  gitDiffBinaryAgainstBranch,
  gitApplyFromStdin,
  gitResetSoft,
  gitMergeBase,
  hasCommitWithMessage,
  gitResetSoftTo,
  gitWriteTree,
  gitReadTree,
  getCommitTreeHash,
  gitDiffTree,
  gitApplyCachedCheck,
} from './git.js';
export { sanitizeBranchName, generateBranchNames, validateBranchesNotExist } from './branch.js';
export { validateMainWorktree, validateGitInstalled, validateClaudeCodeInstalled } from './validation.js';
export { createWorktrees, getProjectWorktrees, getProjectWorktreeDir, cleanupWorktrees, getWorktreeStatus, createWorktreesByBranches } from './worktree.js';
export { loadConfig, writeDefaultConfig, getConfigValue, ensureClawtDirs } from './config.js';
export { printSuccess, printError, printWarning, printInfo, printSeparator, printDoubleSeparator, confirmAction, confirmDestructiveAction, formatWorktreeStatus, isWorktreeIdle } from './formatter.js';
export { ensureDir, removeEmptyDir } from './fs.js';
export { multilineInput } from './prompt.js';
export { launchInteractiveClaude } from './claude.js';
export { getSnapshotPath, hasSnapshot, readSnapshotTreeHash, readSnapshot, writeSnapshot, removeSnapshot, removeProjectSnapshots, getProjectSnapshotBranches } from './validate-snapshot.js';
export { findExactMatch, findFuzzyMatches, promptSelectBranch, promptMultiSelectBranches, resolveTargetWorktree, resolveTargetWorktrees } from './worktree-matcher.js';
export type { WorktreeResolveMessages, WorktreeMultiResolveMessages } from './worktree-matcher.js';
export { ProgressRenderer, formatDuration } from './progress.js';
export { parseTaskFile, loadTaskFile } from './task-file.js';

