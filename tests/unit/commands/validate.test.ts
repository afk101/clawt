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
  gitAddAll: vi.fn(),
  gitCommit: vi.fn(),
  gitStashPush: vi.fn(),
  gitRestoreStaged: vi.fn(),
  gitResetHard: vi.fn(),
  gitCleanForce: vi.fn(),
  gitDiffBinaryAgainstBranch: vi.fn(),
  gitApplyFromStdin: vi.fn(),
  gitApplyCachedFromStdin: vi.fn(),
  gitResetSoft: vi.fn(),
  gitWriteTree: vi.fn(),
  gitReadTree: vi.fn(),
  getHeadCommitHash: vi.fn(),
  getCommitTreeHash: vi.fn(),
  gitDiffTree: vi.fn(),
  gitApplyCachedCheck: vi.fn(),
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
  runCommandInherited: vi.fn(),
  printError: vi.fn(),
  printSeparator: vi.fn(),
  parseParallelCommands: vi.fn(),
  runParallelCommands: vi.fn(),
  requireProjectConfig: vi.fn().mockReturnValue({ clawtMainWorkBranch: 'main' }),
  getValidateBranchName: vi.fn((name: string) => `clawt-validate-${name}`),
  gitCheckout: vi.fn(),
  ensureOnMainWorkBranch: vi.fn(),
  handleDirtyWorkingDir: vi.fn(),
  checkBranchExists: vi.fn().mockReturnValue(true),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  getValidateRunCommand: vi.fn(),
}));

import { registerValidateCommand } from '../../../src/commands/validate.js';
import {
  getProjectName,
  getGitTopLevel,
  getProjectWorktrees,
  getConfigValue,
  isWorkingDirClean,
  gitAddAll,
  gitCommit,
  gitDiffBinaryAgainstBranch,
  gitApplyFromStdin,
  gitResetSoft,
  gitWriteTree,
  gitRestoreStaged,
  getHeadCommitHash,
  gitReadTree,
  hasLocalCommits,
  hasSnapshot,
  readSnapshot,
  writeSnapshot,
  removeSnapshot,
  confirmDestructiveAction,
  printSuccess,
  printInfo,
  resolveTargetWorktree,
  gitResetHard,
  gitCleanForce,
  getCommitTreeHash,
  gitDiffTree,
  gitApplyCachedCheck,
  gitApplyCachedFromStdin,
  printWarning,
  runCommandInherited,
  printError,
  printSeparator,
  parseParallelCommands,
  runParallelCommands,
  getValidateRunCommand,
} from '../../../src/utils/index.js';

const mockedGetProjectName = vi.mocked(getProjectName);
const mockedGetGitTopLevel = vi.mocked(getGitTopLevel);
const mockedGetProjectWorktrees = vi.mocked(getProjectWorktrees);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedIsWorkingDirClean = vi.mocked(isWorkingDirClean);
const mockedGitAddAll = vi.mocked(gitAddAll);
const mockedGitCommit = vi.mocked(gitCommit);
const mockedGitDiffBinaryAgainstBranch = vi.mocked(gitDiffBinaryAgainstBranch);
const mockedGitApplyFromStdin = vi.mocked(gitApplyFromStdin);
const mockedGitResetSoft = vi.mocked(gitResetSoft);
const mockedGitWriteTree = vi.mocked(gitWriteTree);
const mockedGitRestoreStaged = vi.mocked(gitRestoreStaged);
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
const mockedResolveTargetWorktree = vi.mocked(resolveTargetWorktree);
const mockedGitResetHard = vi.mocked(gitResetHard);
const mockedGitCleanForce = vi.mocked(gitCleanForce);
const mockedGetCommitTreeHash = vi.mocked(getCommitTreeHash);
const mockedGitDiffTree = vi.mocked(gitDiffTree);
const mockedGitApplyCachedCheck = vi.mocked(gitApplyCachedCheck);
const mockedGitApplyCachedFromStdin = vi.mocked(gitApplyCachedFromStdin);
const mockedPrintWarning = vi.mocked(printWarning);
const mockedRunCommandInherited = vi.mocked(runCommandInherited);
const mockedPrintError = vi.mocked(printError);
const mockedPrintSeparator = vi.mocked(printSeparator);
const mockedParseParallelCommands = vi.mocked(parseParallelCommands);
const mockedRunParallelCommands = vi.mocked(runParallelCommands);
const mockedGetValidateRunCommand = vi.mocked(getValidateRunCommand);

const worktree = { path: '/path/feature', branch: 'feature' };

beforeEach(() => {
  mockedGetGitTopLevel.mockReturnValue('/repo');
  mockedGetProjectName.mockReturnValue('test-project');
  mockedGetProjectWorktrees.mockReturnValue([worktree]);
  mockedResolveTargetWorktree.mockResolvedValue(worktree);
  mockedGetConfigValue.mockReturnValue(false);
  mockedHasSnapshot.mockReturnValue(false);
  mockedIsWorkingDirClean.mockReset();
  mockedGitAddAll.mockReset();
  mockedGitCommit.mockReset();
  mockedGitDiffBinaryAgainstBranch.mockReset();
  mockedGitApplyFromStdin.mockReset();
  mockedGitResetSoft.mockReset();
  mockedGitWriteTree.mockReset();
  mockedGitRestoreStaged.mockReset();
  mockedGetHeadCommitHash.mockReset();
  mockedGitReadTree.mockReset();
  mockedHasLocalCommits.mockReset();
  mockedReadSnapshot.mockReset();
  mockedWriteSnapshot.mockReset();
  mockedRemoveSnapshot.mockReset();
  mockedConfirmDestructiveAction.mockReset();
  mockedPrintSuccess.mockReset();
  mockedPrintInfo.mockReset();
  mockedGitResetHard.mockReset();
  mockedGitCleanForce.mockReset();
  mockedGetCommitTreeHash.mockReset();
  mockedGitDiffTree.mockReset();
  mockedGitApplyCachedCheck.mockReset();
  mockedGitApplyCachedFromStdin.mockReset();
  mockedPrintWarning.mockReset();
  mockedRunCommandInherited.mockReset();
  mockedPrintError.mockReset();
  mockedPrintSeparator.mockReset();
  mockedParseParallelCommands.mockReset();
  mockedRunParallelCommands.mockReset();
  mockedGetValidateRunCommand.mockReset();
  // 默认让 parseParallelCommands 返回单命令数组，保持旧测试兼容
  mockedParseParallelCommands.mockImplementation((cmd: string) => [cmd]);
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
    expect(mockedGitDiffBinaryAgainstBranch).not.toHaveBeenCalled();
  });

  it('首次 validate：有已提交 commit 且主 worktree 干净', async () => {
    // 目标 worktree 干净，但有已提交 commit
    mockedIsWorkingDirClean.mockReturnValue(true); // 所有调用都返回 true
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash123');
    mockedGetHeadCommitHash.mockReturnValue('headhash456');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGitDiffBinaryAgainstBranch).toHaveBeenCalledWith('feature', '/repo');
    expect(mockedGitApplyFromStdin).toHaveBeenCalled();
    expect(mockedWriteSnapshot).toHaveBeenCalledWith('test-project', 'feature', 'treehash123', 'headhash456');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('首次 validate：有未提交修改时做临时 commit 后撤销', async () => {
    // 主 worktree 干净，目标 worktree 有未提交修改
    mockedIsWorkingDirClean
      .mockReturnValueOnce(true)    // 主 worktree 调用（collectStatus 或 handleValidate 首次检查目标）
      .mockReturnValueOnce(false);  // 目标 worktree 检查
    mockedHasLocalCommits.mockReturnValue(false); // 无已提交 commit，但有未提交修改
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash');
    mockedGetHeadCommitHash.mockReturnValue('headhash');

    // 注意：hasUncommitted 来自 !isWorkingDirClean(targetWorktreePath)
    // 这里的 mock 链：
    // 第 1 次调用 isWorkingDirClean: 检查 targetWorktreePath => false（有未提交修改）
    // 但是代码中先检查 isWorkingDirClean(mainWorktreePath)
    // 需要更精确的 mock
    mockedIsWorkingDirClean.mockReset();
    mockedIsWorkingDirClean.mockImplementation((cwd?: string) => {
      if (cwd === '/path/feature') return false;  // 目标 worktree 不干净
      return true;  // 主 worktree 干净
    });
    // 因为 hasUncommitted 依赖 !isWorkingDirClean(targetWorktreePath)，
    // 且 !hasUncommitted && !hasCommitted 需要检查 hasLocalCommits
    mockedHasLocalCommits.mockReturnValue(true); // 让它不走"无变更"路径

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    // 临时 commit
    expect(mockedGitAddAll).toHaveBeenCalledWith('/path/feature');
    expect(mockedGitCommit).toHaveBeenCalledWith('clawt:temp-commit-for-validate', '/path/feature');
    // 撤销临时 commit
    expect(mockedGitResetSoft).toHaveBeenCalledWith(1, '/path/feature');
    expect(mockedGitRestoreStaged).toHaveBeenCalledWith('/path/feature');
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
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGitReadTree).toHaveBeenCalledWith('oldtree', '/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('HEAD 变化时通过 patch 重放旧变更到暂存区', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'oldhead' });
    mockedGetHeadCommitHash.mockReturnValue('newhead'); // HEAD 已变化
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedGetCommitTreeHash.mockReturnValue('oldheadtree');
    mockedGitDiffTree.mockReturnValue(Buffer.from('old change patch'));
    mockedGitApplyCachedCheck.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedGetCommitTreeHash).toHaveBeenCalledWith('oldhead', '/repo');
    expect(mockedGitDiffTree).toHaveBeenCalledWith('oldheadtree', 'oldtree', '/repo');
    expect(mockedGitApplyCachedFromStdin).toHaveBeenCalled();
  });

  it('旧变更 patch 有冲突时降级为全量模式', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'oldhead' });
    mockedGetHeadCommitHash.mockReturnValue('newhead');
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedGetCommitTreeHash.mockReturnValue('oldheadtree');
    mockedGitDiffTree.mockReturnValue(Buffer.from('conflicting patch'));
    mockedGitApplyCachedCheck.mockReturnValue(false); // 有冲突

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedGitApplyCachedFromStdin).not.toHaveBeenCalled();
  });

  it('read-tree 失败时降级为全量模式', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash' });
    mockedGetHeadCommitHash.mockReturnValue('headhash');
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedGitReadTree.mockImplementation(() => { throw new Error('gc reclaimed'); });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });
});

describe('--run 选项', () => {
  /** 设置首次 validate 成功的公共 mock */
  function setupSuccessfulFirstValidate(): void {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash');
    mockedGetHeadCommitHash.mockReturnValue('headhash');
  }

  /** 构造 spawnSync 返回值的辅助函数 */
  function createSpawnResult(overrides: { status?: number | null; error?: Error }) {
    return {
      pid: 0,
      output: [],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: overrides.status ?? null,
      signal: null,
      error: overrides.error,
    };
  }

  it('validate 成功后执行 --run 指定的命令', async () => {
    setupSuccessfulFirstValidate();
    mockedRunCommandInherited.mockReturnValue(createSpawnResult({ status: 0 }));

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedRunCommandInherited).toHaveBeenCalledWith('npm test', { cwd: '/repo' });
    expect(mockedPrintSuccess).toHaveBeenCalledTimes(2);
  });

  it('--run 命令失败时输出错误信息但不抛异常', async () => {
    setupSuccessfulFirstValidate();
    mockedRunCommandInherited.mockReturnValue(createSpawnResult({ status: 1 }));

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '--run', 'npm test'], { from: 'user' });

    expect(mockedRunCommandInherited).toHaveBeenCalledWith('npm test', { cwd: '/repo' });
    expect(mockedPrintError).toHaveBeenCalled();
  });

  it('--run 命令进程启动失败时输出错误信息', async () => {
    setupSuccessfulFirstValidate();
    mockedRunCommandInherited.mockReturnValue(createSpawnResult({ error: new Error('spawn ENOENT') }));

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'nonexistent'], { from: 'user' });

    expect(mockedPrintError).toHaveBeenCalled();
    // validate 成功 + run 出错，printSuccess 只被调用 1 次（validate 成功）
    expect(mockedPrintSuccess).toHaveBeenCalledTimes(1);
  });

  it('未传 --run 时不执行任何命令', async () => {
    setupSuccessfulFirstValidate();

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    expect(mockedRunCommandInherited).not.toHaveBeenCalled();
  });

  it('--clean 与 --run 同时传入时只执行 clean 不执行 run', async () => {
    mockedGetConfigValue.mockReturnValue(false);
    mockedIsWorkingDirClean.mockReturnValue(true);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '--clean', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedRemoveSnapshot).toHaveBeenCalled();
    expect(mockedRunCommandInherited).not.toHaveBeenCalled();
  });

  it('增量 validate 成功后也执行 --run 命令', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(true);
    mockedReadSnapshot.mockReturnValue({ treeHash: 'oldtree', headCommitHash: 'headhash' });
    mockedGetHeadCommitHash.mockReturnValue('headhash');
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('newtree');
    mockedRunCommandInherited.mockReturnValue(createSpawnResult({ status: 0 }));

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedRunCommandInherited).toHaveBeenCalledWith('npm test', { cwd: '/repo' });
  });

  it('目标分支无变更时不执行 --run', async () => {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(false);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    expect(mockedRunCommandInherited).not.toHaveBeenCalled();
  });
});

describe('--run 并行命令', () => {
  /** 设置首次 validate 成功的公共 mock */
  function setupSuccessfulFirstValidate(): void {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash');
    mockedGetHeadCommitHash.mockReturnValue('headhash');
  }

  it('& 分隔的命令触发并行执行', async () => {
    setupSuccessfulFirstValidate();
    mockedParseParallelCommands.mockReturnValue(['pnpm test', 'pnpm build']);
    mockedRunParallelCommands.mockResolvedValue([
      { command: 'pnpm test', exitCode: 0 },
      { command: 'pnpm build', exitCode: 0 },
    ]);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'pnpm test & pnpm build'], { from: 'user' });

    // 应该调用并行执行而非同步执行
    expect(mockedRunParallelCommands).toHaveBeenCalledWith(['pnpm test', 'pnpm build'], { cwd: '/repo' });
    expect(mockedRunCommandInherited).not.toHaveBeenCalled();
    // 全部成功，printSuccess 被调用（validate 成功 + 各命令成功 + 汇总成功）
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('并行执行部分失败时输出错误汇总', async () => {
    setupSuccessfulFirstValidate();
    mockedParseParallelCommands.mockReturnValue(['pnpm test', 'pnpm build']);
    mockedRunParallelCommands.mockResolvedValue([
      { command: 'pnpm test', exitCode: 1 },
      { command: 'pnpm build', exitCode: 0 },
    ]);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'pnpm test & pnpm build'], { from: 'user' });

    expect(mockedRunParallelCommands).toHaveBeenCalled();
    // 部分失败，应有错误输出
    expect(mockedPrintError).toHaveBeenCalled();
  });

  it('单命令走原有同步路径不触发并行', async () => {
    setupSuccessfulFirstValidate();
    mockedParseParallelCommands.mockReturnValue(['npm test']);
    mockedRunCommandInherited.mockReturnValue({
      pid: 0, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0),
      status: 0, signal: null, error: undefined,
    });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'npm test'], { from: 'user' });

    // 单命令应该走同步路径
    expect(mockedRunCommandInherited).toHaveBeenCalledWith('npm test', { cwd: '/repo' });
    expect(mockedRunParallelCommands).not.toHaveBeenCalled();
  });

  it('&& 命令不触发并行执行', async () => {
    setupSuccessfulFirstValidate();
    mockedParseParallelCommands.mockReturnValue(['pnpm lint && pnpm test']);
    mockedRunCommandInherited.mockReturnValue({
      pid: 0, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0),
      status: 0, signal: null, error: undefined,
    });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'pnpm lint && pnpm test'], { from: 'user' });

    // && 不拆分，走同步路径
    expect(mockedRunCommandInherited).toHaveBeenCalledWith('pnpm lint && pnpm test', { cwd: '/repo' });
    expect(mockedRunParallelCommands).not.toHaveBeenCalled();
  });
});

describe('配置读取 fallback（resolveRunCommand）', () => {
  /** 设置首次 validate 成功的公共 mock */
  function setupSuccessfulFirstValidate(): void {
    mockedIsWorkingDirClean.mockReturnValue(true);
    mockedHasLocalCommits.mockReturnValue(true);
    mockedHasSnapshot.mockReturnValue(false);
    mockedGitDiffBinaryAgainstBranch.mockReturnValue(Buffer.from('diff'));
    mockedGitWriteTree.mockReturnValue('treehash');
    mockedGetHeadCommitHash.mockReturnValue('headhash');
  }

  it('未传 -r 但项目配置有 validateRunCommand 时从配置读取执行', async () => {
    setupSuccessfulFirstValidate();
    mockedGetValidateRunCommand.mockReturnValue('pnpm test');
    mockedRunCommandInherited.mockReturnValue({
      pid: 0, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0),
      status: 0, signal: null, error: undefined,
    });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    // 应该从配置读取命令并执行
    expect(mockedRunCommandInherited).toHaveBeenCalledWith('pnpm test', { cwd: '/repo' });
  });

  it('传了 -r 时以用户参数为准，忽略项目配置', async () => {
    setupSuccessfulFirstValidate();
    mockedGetValidateRunCommand.mockReturnValue('pnpm test');
    mockedRunCommandInherited.mockReturnValue({
      pid: 0, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0),
      status: 0, signal: null, error: undefined,
    });

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature', '-r', 'pnpm build'], { from: 'user' });

    // 应该使用用户传入的命令，而非配置中的
    expect(mockedRunCommandInherited).toHaveBeenCalledWith('pnpm build', { cwd: '/repo' });
  });

  it('未传 -r 且项目配置无 validateRunCommand 时不执行命令', async () => {
    setupSuccessfulFirstValidate();
    mockedGetValidateRunCommand.mockReturnValue(undefined);

    const program = new Command();
    program.exitOverride();
    registerValidateCommand(program);
    await program.parseAsync(['validate', '-b', 'feature'], { from: 'user' });

    // 没有命令可执行
    expect(mockedRunCommandInherited).not.toHaveBeenCalled();
  });
});
