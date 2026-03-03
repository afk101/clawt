import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/errors/index.js', () => ({
  ClawtError: class ClawtError extends Error {
    exitCode: number;
    constructor(message: string, exitCode = 1) {
      super(message);
      this.exitCode = exitCode;
    }
  },
}));

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    VALIDATE_NO_WORKTREES: '没有可用的 worktree',
    VALIDATE_SELECT_BRANCH: '选择要验证的分支',
    VALIDATE_MULTIPLE_MATCHES: (keyword: string) => `找到多个匹配 "${keyword}" 的分支`,
    VALIDATE_NO_MATCH: (keyword: string, branches: string[]) => `未找到匹配 "${keyword}" 的分支`,
    TARGET_WORKTREE_CLEAN: '该 worktree 的分支上没有任何更改',
    VALIDATE_SUCCESS: (branch: string) => `✓ 已验证 ${branch}`,
    VALIDATE_CLEANED: (branch: string) => `✓ 已清理 ${branch} 的 validate 状态`,
    VALIDATE_PATCH_APPLY_FAILED: (branch: string) => `patch 应用失败: ${branch}`,
    INCREMENTAL_VALIDATE_SUCCESS: (branch: string) => `✓ 增量验证 ${branch}`,
    INCREMENTAL_VALIDATE_FALLBACK: '降级为全量模式',
    INCREMENTAL_VALIDATE_NO_CHANGES: (branch: string) => `${branch} 无新变更`,
    DESTRUCTIVE_OP_CANCELLED: '已取消操作',
    VALIDATE_RUN_START: (cmd: string) => `正在执行命令: ${cmd}`,
    VALIDATE_RUN_SUCCESS: (cmd: string) => `✓ 命令执行完成: ${cmd}`,
    VALIDATE_RUN_FAILED: (cmd: string, code: number) => `✗ 命令失败: ${cmd}，退出码: ${code}`,
    VALIDATE_RUN_ERROR: (cmd: string, msg: string) => `✗ 命令出错: ${msg}`,
    VALIDATE_PARALLEL_RUN_START: (count: number) => `正在并行执行 ${count} 个命令...`,
    VALIDATE_PARALLEL_CMD_START: (index: number, total: number, cmd: string) => `[${index}/${total}] ${cmd}`,
    VALIDATE_PARALLEL_RUN_ALL_SUCCESS: (count: number) => `✓ 全部 ${count} 个命令执行成功`,
    VALIDATE_PARALLEL_RUN_SUMMARY: (s: number, f: number) => `共 ${s + f} 个命令，${s} 个成功，${f} 个失败`,
    VALIDATE_PARALLEL_CMD_SUCCESS: (cmd: string) => `  ✓ ${cmd}`,
    VALIDATE_PARALLEL_CMD_FAILED: (cmd: string, code: number) => `  ✗ ${cmd}（退出码: ${code}）`,
    VALIDATE_PARALLEL_CMD_ERROR: (cmd: string, msg: string) => `  ✗ ${cmd}（错误: ${msg}）`,
    SEPARATOR: '────',
    VALIDATE_BRANCH_NOT_FOUND: (validateBranch: string, branch: string) => `验证分支 ${validateBranch} 不存在`,
    VALIDATE_SUCCESS_WITH_BRANCH: (branch: string, validateBranch: string) => `✓ 已切换到验证分支 ${validateBranch} 并验证 ${branch}`,
    VALIDATE_CONFIRM_AUTO_SYNC: (branch: string) => `是否自动 sync ${branch}`,
    VALIDATE_AUTO_SYNC_DECLINED: (branch: string) => `已跳过 ${branch} 的自动 sync`,
    VALIDATE_AUTO_SYNC_START: (branch: string) => `正在自动 sync ${branch}`,
  },
}));

// mock enquirer
vi.mock('enquirer', () => ({
  default: {
    Select: vi.fn(),
  },
}));

vi.mock('../../../src/utils/index.js', () => ({
  validateMainWorktree: vi.fn(),
  getProjectName: vi.fn(),
  getGitTopLevel: vi.fn(),
  getProjectWorktrees: vi.fn(),
  getConfigValue: vi.fn(),
  isWorkingDirClean: vi.fn(),
  gitReadTree: vi.fn(),
  gitResetHard: vi.fn(),
  gitCleanForce: vi.fn(),
  getHeadCommitHash: vi.fn(),
  hasLocalCommits: vi.fn(),
  hasSnapshot: vi.fn(),
  readSnapshot: vi.fn(),
  writeSnapshot: vi.fn(),
  removeSnapshot: vi.fn(),
  confirmDestructiveAction: vi.fn(),
  confirmAction: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
  printInfo: vi.fn(),
  resolveTargetWorktree: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  ensureOnMainWorkBranch: vi.fn(),
  handleDirtyWorkingDir: vi.fn(),
  // validate-core.ts 抽离的函数
  migrateChangesViaPatch: vi.fn().mockReturnValue({ success: true }),
  computeCurrentTreeHash: vi.fn().mockReturnValue('treehash'),
  saveCurrentSnapshotTree: vi.fn().mockReturnValue('treehash'),
  loadOldSnapshotToStage: vi.fn().mockReturnValue({ success: true, stagedTreeHash: '' }),
  switchToValidateBranch: vi.fn((name: string) => `clawt-validate-${name}`),
  // validate-runner.ts 抽离的函数
  executeRunCommand: vi.fn(),
}));

import { registerValidateCommand } from '../../../src/commands/validate.js';
import {
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
  getConfigValue,
  isWorkingDirClean,
  gitReadTree,
  gitResetHard,
  gitCleanForce,
  getHeadCommitHash,
  hasLocalCommits,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
  confirmDestructiveAction,
  printSuccess,
  printInfo,
  printWarning,
  resolveTargetWorktree,
  migrateChangesViaPatch,
  computeCurrentTreeHash,
  saveCurrentSnapshotTree,
  loadOldSnapshotToStage,
  switchToValidateBranch,
  executeRunCommand,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetGitTopLevel = vi.mocked(getGitTopLevel);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGetHeadCommitHash = vi.mocked(getHeadCommitHash);
const mockedGitReadTree = vi.mocked(gitReadTree);
const mockedHasLocalCommits = vi.mocked(hasLocalCommits);
const mockedHasSnapshot = vi.mocked(hasSnapshot);
const mockedReadSnapshot = vi.mocked(readSnapshot);
const mockedWriteSnapshot = vi.mocked(writeSnapshot);
const mockedRemoveSnapshot = vi.mocked(removeSnapshot);
const mockedConfirmDestructiveAction = vi.mocked(confirmDestructiveAction);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintWarning = vi.mocked(printWarning);
const mockedResolveTargetWorktree = vi.mocked(resolveTargetWorktree);
const mockedGitResetHard = vi.mocked(gitResetHard);
const mockedGitCleanForce = vi.mocked(gitCleanForce);
const mockedMigrateChangesViaPatch = vi.mocked(migrateChangesViaPatch);
const mockedComputeCurrentTreeHash = vi.mocked(computeCurrentTreeHash);
const mockedSaveCurrentSnapshotTree = vi.mocked(saveCurrentSnapshotTree);
const mockedLoadOldSnapshotToStage = vi.mocked(loadOldSnapshotToStage);
const mockedSwitchToValidateBranch = vi.mocked(switchToValidateBranch);
const mockedExecuteRunCommand = vi.mocked(executeRunCommand);

const worktree = { path: '/path/feature', branch: 'feature' };

beforeEach(() => {
  mockedGetGitTopLevel.mockReturnValue('/repo');
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetProjectWorktrees.mockReturnValue([worktree]);
  mockedResolveTargetWorktree.mockResolvedValue(worktree);
  mockedGetConfigValue.mockReturnValue(false);
  mockedHasSnapshot.mockReturnValue(false);
  mockedIsWorkingDirClean.mockReset();
  mockedGetHeadCommitHash.mockReset();
  mockedGitReadTree.mockReset();
  mockedHasLocalCommits.mockReset();
  mockedReadSnapshot.mockReset();
  mockedWriteSnapshot.mockReset();
  mockedRemoveSnapshot.mockReset();
  mockedConfirmDestructiveAction.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintInfo.mockReset();
  mockedPrintWarning.mockReset();
  mockedGitResetHard.mockReset();
  mockedGitCleanForce.mockReset();
  mockedMigrateChangesViaPatch.mockReset().mockReturnValue({ success: true });
  mockedComputeCurrentTreeHash.mockReset().mockReturnValue('treehash');
  mockedSaveCurrentSnapshotTree.mockReset().mockReturnValue('treehash');
  mockedLoadOldSnapshotToStage.mockReset().mockReturnValue({ success: true, stagedTreeHash: '' });
  mockedSwitchToValidateBranch.mockReset().mockImplementation((name: string) => `clawt-validate-${name}`);
  mockedExecuteRunCommand.mockReset();
});

describe('registerValidateCommand', () => {
  it('注册 validate 命令', () => {
    const program = new Command();
    registerValidateCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'validate');
    expect(cmd).toBeDefined();
  });
});

describe('handleValidate', () => {
  it('目标分支无变更时提示并返回', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintInfo).toHaveBeenCalled();
    expect(mockedMigrateChangesViaPatch).not.toHaveBeenCalled();
  });

  it('首次 validate：有已提交 commit 且主 worktree 干净', async () => {
    // 目标 worktree 干净，但有已提交 commit
    mockedIsWorkingDirClean.mockReturnValue(true); // 所有调用都返回 true
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedSwitchToValidateBranch).toHaveBeenCalledWith('feature', '/repo');
    expect(mockedMigrateChangesViaPatch).toHaveBeenCalledWith('/path/feature', '/repo', 'feature', false);
    expect(mockedSaveCurrentSnapshotTree).toHaveBeenCalledWith('/repo', 'test-project', 'feature');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('首次 validate：有未提交修改时传入 hasUncommitted=true', async () => {
    // 主 worktree 干净，目标 worktree 有未提交修改
    mockedIsWorkingDirClean.mockImplementation((cwd?: string) => {
      if (cwd === '/path/feature') return false;  // 目标 worktree 不干净
      return true;  // 主 worktree 干净
    });
    mockedHasLocalCommits.mockReturnValue(true); // 让它不走"无变更"路径
    mockedHasSnapshot.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    // migrateChangesViaPatch 应接收 hasUncommitted=true
    expect(mockedMigrateChangesViaPatch).toHaveBeenCalledWith('/path/feature', '/repo', 'feature', true);
  });
});

describe('handleValidateClean', () => {
  it('确认后清理 validate 状态', async () => {
    mockedGetConfigValue.mockReturnValue(true); // confirmDestructiveOps
    mockedConfirmDestructiveAction.mockResolvedValue(true);
    mockedIsWorkingDirClean.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature'], { from: 'user' });

    expect(mockedGitResetHard).toHaveBeenCalledWith('/repo');
    expect(mockedGitCleanForce).toHaveBeenCalledWith('/repo');
    expect(mockedRemoveSnapshot).toHaveBeenCalledWith('test-project', 'feature');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('用户拒绝时取消操作', async () => {
    mockedGetConfigValue.mockReturnValue(true);
    mockedConfirmDestructiveAction.mockResolvedValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature'], { from: 'user' });

    expect(mockedGitResetHard).not.toHaveBeenCalled();
    expect(mockedRemoveSnapshot).not.toHaveBeenCalled();
  });

  it('confirmDestructiveOps=false 时跳过确认', async () => {
    mockedGetConfigValue.mockReturnValue(false);
    mockedIsWorkingDirClean.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature'], { from: 'user' });

    expect(mockedConfirmDestructiveAction).not.toHaveBeenCalled();
    expect(mockedRemoveSnapshot).toHaveBeenCalledWith('test-project', 'feature');
  });
});

describe('增量 validate', () => {
  it('HEAD 未变化时使用 read-tree 旧快照', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash' });
    mockedGetHeadCommitHash.mockReturnValue('headhash'); // HEAD 未变化
    mockedComputeCurrentTreeHash.mockReturnValue('newtree');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedSwitchToValidateBranch).toHaveBeenCalledWith('feature', '/repo');
    expect(mockedMigrateChangesViaPatch).toHaveBeenCalled();
    expect(mockedComputeCurrentTreeHash).toHaveBeenCalledWith('/repo');
    // 有新变更（newtree !== oldtree），调用 loadOldSnapshotToStage
    expect(mockedLoadOldSnapshotToStage).toHaveBeenCalledWith('oldtree', 'headhash', 'headhash', '/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('HEAD 变化时调用 loadOldSnapshotToStage', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'oldhead' });
    mockedGetHeadCommitHash.mockReturnValue('newhead'); // HEAD 已变化
    mockedComputeCurrentTreeHash.mockReturnValue('newtree');
    mockedLoadOldSnapshotToStage.mockReturnValue({ success: true, stagedTreeHash: 'staged123' });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedLoadOldSnapshotToStage).toHaveBeenCalledWith('oldtree', 'oldhead', 'newhead', '/repo');
    expect(mockedWriteSnapshot).toHaveBeenCalledWith('test-project', 'feature', 'newtree', 'newhead', 'staged123');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('loadOldSnapshotToStage 失败时降级为全量模式', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'oldhead' });
    mockedGetHeadCommitHash.mockReturnValue('newhead');
    mockedComputeCurrentTreeHash.mockReturnValue('newtree');
    mockedLoadOldSnapshotToStage.mockReturnValue({ success: false, stagedTreeHash: '' });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedWriteSnapshot).toHaveBeenCalledWith('test-project', 'feature', 'newtree', 'newhead', '');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('无新变更时恢复旧暂存区状态', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash', stagedTreeHash: 'staged456' });
    mockedGetHeadCommitHash.mockReturnValue('headhash');
    // tree hash 相同且 HEAD 未变化 → 无新变更
    mockedComputeCurrentTreeHash.mockReturnValue('oldtree');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGitReadTree).toHaveBeenCalledWith('staged456', '/repo');
    expect(mockedLoadOldSnapshotToStage).not.toHaveBeenCalled();
    expect(mockedPrintInfo).toHaveBeenCalled();
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});

describe('--run 选项', () => {
  /** 设置首次 validate 成功的公共 mock */
  function setupSuccessfulFirstValidate(): void {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);
  }

  it('validate 成功后执行 --run 指定的命令', async () => {
    setupSuccessfulFirstValidate();

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedExecuteRunCommand).toHaveBeenCalledWith('npm test', '/repo');
  });

  it('未传 --run 时不执行任何命令', async () => {
    setupSuccessfulFirstValidate();

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedExecuteRunCommand).not.toHaveBeenCalled();
  });

  it('--clean 与 --run 同时传入时只执行 clean 不执行 run', async () => {
    mockedGetConfigValue.mockReturnValue(false);
    mockedIsWorkingDirClean.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedRemoveSnapshot).toHaveBeenCalled();
    expect(mockedExecuteRunCommand).not.toHaveBeenCalled();
  });

  it('增量 validate 成功后也执行 --run 命令', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash' });
    mockedGetHeadCommitHash.mockReturnValue('headhash');
    mockedComputeCurrentTreeHash.mockReturnValue('newtree');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedExecuteRunCommand).toHaveBeenCalledWith('npm test', '/repo');
  });

  it('目标分支无变更时不执行 --run', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedExecuteRunCommand).not.toHaveBeenCalled();
  });
});
