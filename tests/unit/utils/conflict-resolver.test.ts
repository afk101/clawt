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
  execSync: vi.fn(),
}));

// mock constants
vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...actual,
    MESSAGES: {
      ...actual.MESSAGES,
      MERGE_CONFLICT_ASK_AI: '是否使用 AI 解决冲突？',
      MERGE_CONFLICT_AI_START: (n: number) => `正在解决 ${n} 个冲突...`,
      MERGE_CONFLICT_AI_SUCCESS: 'AI 解决冲突成功',
      MERGE_CONFLICT_AI_PARTIAL: (n: number) => `还有 ${n} 个未解决`,
      MERGE_CONFLICT_AI_FAILED: (msg: string) => `AI 失败: ${msg}`,
      MERGE_CONFLICT_MANUAL: '请手动解决冲突',
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

import { execSync } from 'node:child_process';
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

const mockedExecSync = vi.mocked(execSync);
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
  it('成功调用写死的 claude 命令并返回输出', () => {
    mockedExecSync.mockReturnValue('冲突已解决');

    const result = invokeClaudeForConflictResolve('test prompt', '/repo');

    expect(result).toBe('冲突已解决');
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining("claude -p"),
      expect.objectContaining({ cwd: '/repo' }),
    );
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining('--permission-mode bypassPermissions'),
      expect.anything(),
    );
  });

  it('Claude Code 执行失败时抛出 ClawtError', () => {
    mockedExecSync.mockImplementation(() => { throw new Error('command failed'); });

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
    mockedExecSync.mockReturnValue('resolved');

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
    mockedExecSync.mockReturnValue('partial');

    const result = resolveConflictsWithAI('main', 'feature', '/repo');

    expect(result).toBe(false);
    expect(mockedGitAddFiles).toHaveBeenCalledWith(['src/a.ts'], '/repo');
    expect(mockedPrintWarning).toHaveBeenCalled();
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
    mockedExecSync.mockReturnValue('resolved');

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
    mockedExecSync.mockReturnValue('resolved');

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
