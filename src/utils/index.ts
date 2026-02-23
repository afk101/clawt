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
export { loadConfig, writeDefaultConfig, writeConfig, saveConfig, getConfigValue, ensureClawtDirs, parseConcurrency } from './config.js';
export { printSuccess, printError, printWarning, printInfo, printSeparator, printDoubleSeparator, confirmAction, confirmDestructiveAction, formatWorktreeStatus, isWorktreeIdle, formatDuration } from './formatter.js';
export { ensureDir, removeEmptyDir } from './fs.js';
export { multilineInput } from './prompt.js';
export { launchInteractiveClaude, hasClaudeSessionHistory, launchInteractiveClaudeInNewTerminal } from './claude.js';
export { getSnapshotPath, hasSnapshot, readSnapshotTreeHash, readSnapshot, writeSnapshot, removeSnapshot, removeProjectSnapshots, getProjectSnapshotBranches } from './validate-snapshot.js';
export { findExactMatch, findFuzzyMatches, promptSelectBranch, promptMultiSelectBranches, resolveTargetWorktree, resolveTargetWorktrees } from './worktree-matcher.js';
export type { WorktreeResolveMessages, WorktreeMultiResolveMessages } from './worktree-matcher.js';
export { ProgressRenderer } from './progress.js';
export { parseTaskFile, loadTaskFile, parseTasksFromOptions } from './task-file.js';
export { executeBatchTasks } from './task-executor.js';
export { createLineBuffer, parseStreamLine, parseStreamEvent, formatActivityText, truncateText } from './stream-parser.js';
export type { ParsedActivity, StreamEvent, LineBuffer } from './stream-parser.js';
export { detectTerminalApp, openCommandInNewTerminalTab } from './terminal.js';
export { truncateTaskDesc, printDryRunPreview } from './dry-run.js';
export { applyAliases } from './alias.js';
export { isValidConfigKey, getValidConfigKeys, parseConfigValue, promptConfigValue, formatConfigValue } from './config-strategy.js';

