import { describe, it, expect, vi } from 'vitest';

// mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock errors
vi.mock('../../../src/errors/index.js', () => ({
  ClawtError: class ClawtError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ClawtError';
    }
  },
}));

// mock constants
vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    GIT_INDEX_LOCKED: (lockFilePath: string) => `Git index 被锁定，锁文件路径：${lockFilePath}`,
    GIT_INDEX_LOCK_RETRYING: 'Git index 被锁定，正在重试...',
  },
}));

import { execSync } from 'node:child_process';
import {
  isGitIndexLockError,
  findGitIndexLockPath,
  throwIfGitIndexLockError,
  shouldRetryGitIndexLockError,
  waitForGitIndexLockRetrySync,
  extractFullErrorMessage,
} from '../../../src/utils/git-lock.js';

const mockedExecSync = vi.mocked(execSync);

describe('isGitIndexLockError', () => {
  it('检测 "Unable to write index" 错误', () => {
    expect(isGitIndexLockError('fatal: Unable to write index.')).toBe(true);
  });

  it('检测 "Unable to write new index file" 错误', () => {
    expect(isGitIndexLockError('fatal: Unable to write new index file')).toBe(true);
  });

  it('检测包含 "index.lock" 的错误', () => {
    expect(isGitIndexLockError("fatal: Unable to create '/repo/.git/index.lock': File exists.")).toBe(true);
  });

  it('检测 "Unable to create" 含 index 的错误', () => {
    expect(isGitIndexLockError("Unable to create '/path/.git/index.lock'")).toBe(true);
  });

  it('不误判普通 merge 冲突错误', () => {
    expect(isGitIndexLockError('CONFLICT (content): Merge conflict in file.ts')).toBe(false);
  });

  it('不误判分支不存在错误', () => {
    expect(isGitIndexLockError("error: pathspec 'nonexistent' did not match any file(s) known to git")).toBe(false);
  });

  it('不误判普通命令失败', () => {
    expect(isGitIndexLockError('Command failed: git merge feature-branch')).toBe(false);
  });

  it('不误判 push 拒绝错误', () => {
    expect(isGitIndexLockError('error: failed to push some refs')).toBe(false);
  });

  it('空字符串不匹配', () => {
    expect(isGitIndexLockError('')).toBe(false);
  });

  it('不误判不含 index 关键词的 Unable to write 错误', () => {
    expect(isGitIndexLockError('fatal: Unable to write sha1 filename')).toBe(false);
  });

  it('大小写不敏感匹配 "unable to write"', () => {
    expect(isGitIndexLockError('FATAL: UNABLE TO WRITE INDEX.')).toBe(true);
  });

  it('检测中文 "不能写入索引" 错误', () => {
    expect(isGitIndexLockError('致命错误：不能写入索引。')).toBe(true);
  });

  it('检测中文 "无法写入索引" 错误', () => {
    expect(isGitIndexLockError('致命错误：无法写入新索引文件')).toBe(true);
  });

  it('检测中文 "无法创建 index.lock" 错误', () => {
    expect(isGitIndexLockError("致命错误：无法创建 '/repo/.git/index.lock'：文件已存在")).toBe(true);
  });
});

describe('findGitIndexLockPath', () => {
  it('正确拼接 git 目录和 index.lock 路径', () => {
    mockedExecSync.mockReturnValue('.git\n');
    const result = findGitIndexLockPath('/repo');
    expect(result).toContain('.git');
    expect(result).toContain('index.lock');
  });

  it('git rev-parse 失败时降级返回默认路径', () => {
    mockedExecSync.mockImplementation(() => { throw new Error('not a git repo'); });
    const result = findGitIndexLockPath('/repo');
    expect(result).toContain('.git');
    expect(result).toContain('index.lock');
  });

  it('不传 cwd 时使用 process.cwd()', () => {
    mockedExecSync.mockReturnValue('.git\n');
    const result = findGitIndexLockPath();
    expect(result).toContain('index.lock');
  });
});

describe('throwIfGitIndexLockError', () => {
  it('从英文错误消息中解析 index.lock 路径（无需调用 git rev-parse）', () => {
    const error = new Error(
      "Command failed: git add .\n" +
      "fatal: Unable to create '/repo/.git/index.lock': File exists.\n"
    );
    // 不设置 mockedExecSync 的返回值，确认不会调用 git rev-parse
    mockedExecSync.mockImplementation(() => { throw new Error('should not be called'); });
    expect(() => throwIfGitIndexLockError(error)).toThrow(/\/repo\/\.git\/index\.lock/);
  });

  it('从中文错误消息中解析 index.lock 路径', () => {
    const error = new Error(
      "Command failed: git add .\n" +
      "致命错误：无法创建 '/repo/.git/index.lock'：File exists。\n"
    );
    mockedExecSync.mockImplementation(() => { throw new Error('should not be called'); });
    expect(() => throwIfGitIndexLockError(error)).toThrow(/\/repo\/\.git\/index\.lock/);
  });

  it('从子 worktree 错误消息中解析 index.lock 路径', () => {
    const error = new Error(
      "Command failed: git add .\n" +
      "fatal: Unable to create '/repo/.git/worktrees/my-wt/index.lock': File exists.\n"
    );
    mockedExecSync.mockImplementation(() => { throw new Error('should not be called'); });
    expect(() => throwIfGitIndexLockError(error)).toThrow(/\/repo\/\.git\/worktrees\/my-wt\/index\.lock/);
  });

  it('从 error.stderr 中解析路径', () => {
    const error = new Error("Command failed: git merge feature");
    (error as any).stderr = "error: Unable to create '/repo/.git/index.lock': File exists.\n";
    mockedExecSync.mockImplementation(() => { throw new Error('should not be called'); });
    expect(() => throwIfGitIndexLockError(error)).toThrow(/\/repo\/\.git\/index\.lock/);
  });

  it('错误消息不含路径时降级到 findGitIndexLockPath', () => {
    const error = new Error("fatal: Unable to write index.");
    mockedExecSync.mockReturnValue('.git\n' as any);
    expect(() => throwIfGitIndexLockError(error, '/fallback')).toThrow(/index\.lock/);
  });

  it('非 index.lock 错误不抛出', () => {
    const error = new Error("Command failed: git merge feature");
    expect(() => throwIfGitIndexLockError(error)).not.toThrow();
  });
});

describe('extractFullErrorMessage', () => {
  it('从 Error 对象提取 message', () => {
    const error = new Error('test error');
    expect(extractFullErrorMessage(error)).toBe('test error');
  });

  it('合并 message 和 stderr', () => {
    const error = new Error('Command failed');
    (error as any).stderr = 'fatal: Unable to write index.';
    expect(extractFullErrorMessage(error)).toBe('Command failed\nfatal: Unable to write index.');
  });

  it('处理 Buffer 类型的 stderr', () => {
    const error = new Error('Command failed');
    (error as any).stderr = Buffer.from('fatal: Unable to write index.');
    expect(extractFullErrorMessage(error)).toBe('Command failed\nfatal: Unable to write index.');
  });

  it('非 Error 对象返回 String 转换结果', () => {
    expect(extractFullErrorMessage('string error')).toBe('string error');
    expect(extractFullErrorMessage(123)).toBe('123');
  });
});

describe('shouldRetryGitIndexLockError', () => {
  it('index.lock 错误且未达到重试上限时返回 true', () => {
    const error = new Error("fatal: Unable to create '/repo/.git/index.lock': File exists.");
    expect(shouldRetryGitIndexLockError(error, 0)).toBe(true);
  });

  it('index.lock 错误但已达到重试上限时返回 false', () => {
    const error = new Error("fatal: Unable to create '/repo/.git/index.lock': File exists.");
    // MAX_RETRIES 默认为 1，所以 retryCount = 1 时不应再重试
    expect(shouldRetryGitIndexLockError(error, 1)).toBe(false);
  });

  it('非 index.lock 错误返回 false', () => {
    const error = new Error('Command failed: git merge feature');
    expect(shouldRetryGitIndexLockError(error, 0)).toBe(false);
  });

  it('从 stderr 检测 index.lock 错误', () => {
    const error = new Error('Command failed');
    (error as any).stderr = "fatal: Unable to create '/repo/.git/index.lock': File exists.";
    expect(shouldRetryGitIndexLockError(error, 0)).toBe(true);
  });
});

describe('waitForGitIndexLockRetrySync', () => {
  it('向 stderr 输出重试提示', () => {
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // 执行函数（会有短暂延迟）
    waitForGitIndexLockRetrySync();

    // 验证输出了重试提示
    expect(stderrWriteSpy).toHaveBeenCalledWith('Git index 被锁定，正在重试...\n');

    stderrWriteSpy.mockRestore();
  });

  it('执行时间接近配置的延迟时间', () => {
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const startTime = Date.now();
    waitForGitIndexLockRetrySync();
    const elapsed = Date.now() - startTime;

    // 延迟时间应该接近 150ms（允许 50ms 误差）
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThanOrEqual(300);

    stderrWriteSpy.mockRestore();
  });
});
