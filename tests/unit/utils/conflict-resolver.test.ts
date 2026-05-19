import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock errors
vi.mock('../../../src/errors/index.js', () => ({
  ClawtError: class ClawtError extends Error {
    exitCode: number;
    constructor(message: string, exitCode = 1) {
      super(message);
      this.exitCode = exitCode;
    }
  },
}));

// mock node:child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

// mock constants（使用与 src/constants/messages/merge.ts 一致的消息文本）
vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...actual,
    MESSAGES: {
      ...actual.MESSAGES,
      MERGE_CONFLICT_ASK_AI: '检测到合并冲突，是否使用 Claude Code 自动解决？',
      MERGE_CONFLICT_AI_START: (fileCount: number) =>
        `正在使用 Claude Code 分析并解决 ${fileCount} 个冲突文件...`,
      MERGE_CONFLICT_AI_SUCCESS: '✓ Claude Code 已成功解决所有冲突',
      MERGE_CONFLICT_AI_PARTIAL: (remaining: number) =>
        `Claude Code 已处理冲突文件，但仍有 ${remaining} 个文件存在冲突\n  请手动处理剩余冲突后执行 git add . && git merge --continue`,
      MERGE_CONFLICT_AI_FAILED: (errorMsg: string) =>
        `Claude Code 解决冲突失败: ${errorMsg}\n  请手动处理：\n  解决冲突后执行 git add . && git merge --continue`,
      MERGE_CONFLICT_MANUAL: '合并存在冲突，请手动处理：\n  解决冲突后执行 git add . && git merge --continue',
    },
  };
});

// mock config（determineConflictResolveMode 仍需要）
vi.mock('../../../src/utils/config.js', () => ({
  getConfigValue: vi.fn(),
}));

// mock formatter
vi.mock('../../../src/utils/formatter.js', () => ({
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
  confirmAction: vi.fn(),
}));

// mock git
vi.mock('../../../src/utils/git.js', () => ({
  getConflictFiles: vi.fn(),
  hasMergeConflict: vi.fn(),
  gitAddFiles: vi.fn(),
  gitMergeContinue: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import {
  buildConflictResolvePrompt,
  invokeClaudeForConflictResolve,
  resolveConflictsWithAI,
  determineConflictResolveMode,
  handleMergeConflict,
} from '../../../src/utils/conflict-resolver.js';
import { getConfigValue } from '../../../src/utils/config.js';
import { confirmAction, printInfo, printSuccess, printWarning } from '../../../src/utils/formatter.js';
import { getConflictFiles, gitAddFiles, gitMergeContinue } from '../../../src/utils/git.js';
import { ClawtError } from '../../../src/errors/index.js';

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedConfirmAction = vi.mocked(confirmAction);
const mockedGetConflictFiles = vi.mocked(getConflictFiles);
const mockedGitAddFiles = vi.mocked(gitAddFiles);
const mockedGitMergeContinue = vi.mocked(gitMergeContinue);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintSuccess = vi.mocked(printSuccess);
const mockedPrintWarning = vi.mocked(printWarning);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetConfigValue.mockReturnValue('ask');
});

describe('buildConflictResolvePrompt', () => {
  it('生成纯指令性 prompt（无参数）', () => {
    const prompt = buildConflictResolvePrompt();

    expect(prompt).toContain('Git 合并冲突解决专家');
    expect(prompt).toContain('git status');
    expect(prompt).toContain('git log');
    expect(prompt).toContain('冲突标记');
    expect(prompt).toContain('请直接开始');
  });
});

describe('invokeClaudeForConflictResolve', () => {
  it('成功调用 execFileSync 并返回输出', () => {
    mockedExecFileSync.mockReturnValue('冲突已解决');

    const result = invokeClaudeForConflictResolve('test prompt', '/repo');

    expect(result).toBe('冲突已解决');
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'claude',
      ['-p', 'test prompt', '--permission-mode', 'bypassPermissions'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('Claude Code 执行失败时抛出 ClawtError', () => {
    mockedExecFileSync.mockImplementation(() => { throw new Error('command failed'); });

    expect(() => invokeClaudeForConflictResolve('test prompt', '/repo')).toThrow(ClawtError);
  });
});

describe('resolveConflictsWithAI', () => {
  it('无冲突文件时直接返回 true', () => {
    mockedGetConflictFiles.mockReturnValue([]);

    const result = resolveConflictsWithAI('main', 'feature', '/repo');

    expect(result).toBe(true);
  });

  it('AI 成功解决所有冲突后 git add 并 merge continue', () => {
    mockedGetConflictFiles
      .mockReturnValueOnce(['src/a.ts']) // 初始冲突文件
      .mockReturnValueOnce([]); // AI 解决后无冲突
    mockedExecFileSync.mockReturnValue('resolved');

    const result = resolveConflictsWithAI('main', 'feature', '/repo');

    expect(result).toBe(true);
    expect(mockedGitAddFiles).toHaveBeenCalledWith(['src/a.ts'], '/repo');
    expect(mockedGitMergeContinue).toHaveBeenCalledWith('/repo');
    expect(mockedPrintSuccess).toHaveBeenCalled();
  });

  it('AI 部分解决冲突时 git add 已解决的文件并返回 false', () => {
    mockedGetConflictFiles
      .mockReturnValueOnce(['src/a.ts', 'src/b.ts']) // 初始 2 个冲突
      .mockReturnValueOnce(['src/b.ts']); // AI 后还剩 1 个
    mockedExecFileSync.mockReturnValue('partial');

    const result = resolveConflictsWithAI('main', 'feature', '/repo');

    expect(result).toBe(false);
    expect(mockedGitAddFiles).toHaveBeenCalledWith(['src/a.ts'], '/repo');
    expect(mockedPrintWarning).toHaveBeenCalled();
  });

  it('AI 调用失败时输出警告并返回 false', () => {
    mockedGetConflictFiles.mockReturnValueOnce(['src/a.ts']);
    mockedExecFileSync.mockImplementation(() => { throw new Error('timeout'); });

    const result = resolveConflictsWithAI('main', 'feature', '/repo');

    expect(result).toBe(false);
    expect(mockedPrintWarning).toHaveBeenCalled();
    expect(mockedGitAddFiles).not.toHaveBeenCalled();
    expect(mockedGitMergeContinue).not.toHaveBeenCalled();
  });
});

describe('determineConflictResolveMode', () => {
  it('--auto 参数优先返回 auto', () => {
    mockedGetConfigValue.mockReturnValue('manual');

    expect(determineConflictResolveMode(true)).toBe('auto');
  });

  it('配置为 auto 时返回 auto', () => {
    mockedGetConfigValue.mockReturnValue('auto');

    expect(determineConflictResolveMode()).toBe('auto');
  });

  it('配置为 manual 时返回 manual', () => {
    mockedGetConfigValue.mockReturnValue('manual');

    expect(determineConflictResolveMode()).toBe('manual');
  });

  it('配置为 ask 时返回 ask', () => {
    mockedGetConfigValue.mockReturnValue('ask');

    expect(determineConflictResolveMode()).toBe('ask');
  });

  it('默认返回 ask', () => {
    mockedGetConfigValue.mockReturnValue('unknown');

    expect(determineConflictResolveMode()).toBe('ask');
  });
});

describe('handleMergeConflict', () => {
  it('manual 模式抛出 ClawtError', async () => {
    mockedGetConfigValue.mockReturnValue('manual');

    await expect(
      handleMergeConflict('main', 'feature', '/repo'),
    ).rejects.toThrow(ClawtError);
  });

  it('auto 模式直接调用 AI 解决', async () => {
    mockedGetConflictFiles
      .mockReturnValueOnce(['src/a.ts'])
      .mockReturnValueOnce([]);
    mockedExecFileSync.mockReturnValue('resolved');

    const result = await handleMergeConflict('main', 'feature', '/repo', true);

    expect(result).toBe(true);
    expect(mockedConfirmAction).not.toHaveBeenCalled();
  });

  it('ask 模式用户选择使用 AI 时调用 AI 解决', async () => {
    mockedGetConfigValue.mockReturnValue('ask');
    mockedConfirmAction.mockResolvedValue(true);
    mockedGetConflictFiles
      .mockReturnValueOnce(['src/a.ts'])
      .mockReturnValueOnce([]);
    mockedExecFileSync.mockReturnValue('resolved');

    const result = await handleMergeConflict('main', 'feature', '/repo');

    expect(result).toBe(true);
    expect(mockedConfirmAction).toHaveBeenCalled();
  });

  it('ask 模式用户拒绝 AI 时抛出 ClawtError', async () => {
    mockedGetConfigValue.mockReturnValue('ask');
    mockedConfirmAction.mockResolvedValue(false);

    await expect(
      handleMergeConflict('main', 'feature', '/repo'),
    ).rejects.toThrow(ClawtError);
  });
});
