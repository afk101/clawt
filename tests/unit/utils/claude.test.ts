import { describe, it, expect, vi } from 'vitest';

// mock logger（避免测试时写日志文件）
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock node:child_process
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// mock config
vi.mock('../../../src/utils/config.js', () => ({
  getConfigValue: vi.fn(),
}));

// mock formatter
vi.mock('../../../src/utils/formatter.js', () => ({
  printInfo: vi.fn(),
  printWarning: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { launchInteractiveClaude, hasClaudeSessionHistory } from '../../../src/utils/claude.js';
import { getConfigValue } from '../../../src/utils/config.js';
import { printInfo, printWarning } from '../../../src/utils/formatter.js';
import { ClawtError } from '../../../src/errors/index.js';
import { createWorktreeInfo } from '../../helpers/fixtures.js';

const mockedSpawnSync = vi.mocked(spawnSync);
const mockedGetConfigValue = vi.mocked(getConfigValue);
const mockedPrintInfo = vi.mocked(printInfo);
const mockedPrintWarning = vi.mocked(printWarning);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReaddirSync = vi.mocked(readdirSync);

describe('hasClaudeSessionHistory', () => {
  it('项目目录不存在时返回 false', () => {
    mockedExistsSync.mockReturnValue(false);

    expect(hasClaudeSessionHistory('/Users/test/project')).toBe(false);
    expect(mockedExistsSync).toHaveBeenCalled();
  });

  it('项目目录存在但无 .jsonl 文件时返回 false', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReaddirSync.mockReturnValue(['memory', 'CLAUDE.md'] as unknown as ReturnType<typeof readdirSync>);

    expect(hasClaudeSessionHistory('/Users/test/project')).toBe(false);
  });

  it('项目目录存在且有 .jsonl 文件时返回 true', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReaddirSync.mockReturnValue([
      'abc-123.jsonl',
      'memory',
    ] as unknown as ReturnType<typeof readdirSync>);

    expect(hasClaudeSessionHistory('/Users/test/project')).toBe(true);
  });

  it('路径编码规则正确（非字母数字字符替换为 -）', () => {
    mockedExistsSync.mockReturnValue(false);

    hasClaudeSessionHistory('/Users/qihoo/.clawt/worktrees/clawt/resume');

    // 验证 existsSync 被调用时路径包含编码后的目录名
    // /Users/qihoo/.clawt/worktrees/clawt/resume → -Users-qihoo--clawt-worktrees-clawt-resume
    const calledPath = mockedExistsSync.mock.calls[0][0] as string;
    expect(calledPath).toContain('-Users-qihoo--clawt-worktrees-clawt-resume');
  });
});

describe('launchInteractiveClaude', () => {
  const worktree = createWorktreeInfo({
    path: '/tmp/test-worktree',
    branch: 'feature-test',
  });

  it('正常启动 Claude Code（退出码为 0）', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedGetConfigValue).toHaveBeenCalledWith('claudeCodeCommand');
    expect(mockedSpawnSync).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--append-system-prompt']),
      expect.objectContaining({
        cwd: '/tmp/test-worktree',
        stdio: 'inherit',
      }),
    );
  });

  it('输出分支和路径信息', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('feature-test'));
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('/tmp/test-worktree'));
  });

  it('支持带参数的命令（如 npx claude）', () => {
    mockedGetConfigValue.mockReturnValue('npx claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedSpawnSync).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['claude', '--append-system-prompt']),
      expect.any(Object),
    );
  });

  it('spawnSync 返回 error 时抛出 ClawtError', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: null,
      error: new Error('命令未找到'),
      stdout: '',
      stderr: '',
      pid: 0,
      output: [],
      signal: null,
    });

    expect(() => launchInteractiveClaude(worktree)).toThrow(ClawtError);
    expect(() => launchInteractiveClaude(worktree)).toThrow('启动 Claude Code 失败');
  });

  it('非零退出码时调用 printWarning', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: 1,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintWarning).toHaveBeenCalledWith(expect.stringContaining('退出码: 1'));
  });

  it('退出码为 null 时不调用 printWarning', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: null,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintWarning).not.toHaveBeenCalled();
  });

  it('退出码为 0 时不调用 printWarning', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    expect(mockedPrintWarning).not.toHaveBeenCalled();
  });

  it('autoContinue 启用且有会话历史时追加 --continue 参数', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(true);
    mockedReaddirSync.mockReturnValue(['session-abc.jsonl'] as unknown as ReturnType<typeof readdirSync>);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree, { autoContinue: true });

    const callArgs = mockedSpawnSync.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--continue');
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('继续上次对话'));
  });

  it('autoContinue 启用但无会话历史时不追加 --continue 参数', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(false);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree, { autoContinue: true });

    const callArgs = mockedSpawnSync.mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--continue');
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('新对话'));
  });

  it('不传 autoContinue 时即使有会话历史也不追加 --continue', () => {
    mockedGetConfigValue.mockReturnValue('claude');
    mockedExistsSync.mockReturnValue(true);
    mockedReaddirSync.mockReturnValue(['session-abc.jsonl'] as unknown as ReturnType<typeof readdirSync>);
    mockedSpawnSync.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: '',
      stderr: '',
      pid: 1234,
      output: [],
      signal: null,
    });

    launchInteractiveClaude(worktree);

    const callArgs = mockedSpawnSync.mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--continue');
  });
});
