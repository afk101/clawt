import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/constants/index.js', () => ({
  MESSAGES: {
    DRY_RUN_TITLE: 'Dry Run 预览',
    DRY_RUN_TASK_COUNT: (count: number) => `任务数: ${count}`,
    DRY_RUN_CONCURRENCY: (concurrency: number) => `并发数: ${concurrency === 0 ? '不限制' : concurrency}`,
    DRY_RUN_WORKTREE_DIR: (dir: string) => `Worktree: ${dir}`,
    DRY_RUN_BRANCH_EXISTS_WARNING: (name: string) => `分支 ${name} 已存在`,
    DRY_RUN_INTERACTIVE_MODE: '模式: 交互式（无预设任务）',
    DRY_RUN_READY: '预览完成，无冲突。移除 --dry-run 即可正式执行。',
    DRY_RUN_HAS_CONFLICT: '存在分支冲突，实际执行时将会报错。请先处理冲突的分支。',
  },
}));

vi.mock('../../../src/utils/git.js', () => ({
  checkBranchExists: vi.fn(),
}));

vi.mock('../../../src/utils/worktree.js', () => ({
  getProjectWorktreeDir: vi.fn().mockReturnValue('/mock/.clawt/worktrees/test-project'),
}));

vi.mock('../../../src/utils/formatter.js', () => ({
  printInfo: vi.fn(),
  printDoubleSeparator: vi.fn(),
  printSeparator: vi.fn(),
}));

import { truncateTaskDesc, printDryRunPreview } from '../../../src/utils/dry-run.js';
import { checkBranchExists } from '../../../src/utils/git.js';
import { printInfo } from '../../../src/utils/formatter.js';

const mockedCheckBranchExists = vi.mocked(checkBranchExists);
const mockedPrintInfo = vi.mocked(printInfo);

beforeEach(() => {
  mockedCheckBranchExists.mockReset();
  mockedPrintInfo.mockReset();
});

describe('truncateTaskDesc', () => {
  it('短文本原样返回', () => {
    expect(truncateTaskDesc('实现登录功能')).toBe('实现登录功能');
  });

  it('超过80字符时截断并加省略号', () => {
    const longTask = 'a'.repeat(100);
    const result = truncateTaskDesc(longTask);
    expect(result.length).toBe(83); // 80 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('恰好80字符时不截断', () => {
    const task = 'a'.repeat(80);
    expect(truncateTaskDesc(task)).toBe(task);
  });

  it('多行文本合并为单行', () => {
    const multiLine = '第一行\n第二行\n第三行';
    expect(truncateTaskDesc(multiLine)).toBe('第一行 第二行 第三行');
  });

  it('首尾空白被去除', () => {
    expect(truncateTaskDesc('  hello  ')).toBe('hello');
  });
});

describe('printDryRunPreview', () => {
  it('无冲突时输出预览完成结论', () => {
    mockedCheckBranchExists.mockReturnValue(false);

    printDryRunPreview(['feat-1', 'feat-2'], ['任务1', '任务2'], 0);

    // 正常分支应包含 ✓ 标识
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('✓'));
    // 应输出预览完成结论
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('预览完成'));
  });

  it('有分支冲突时输出冲突警告', () => {
    mockedCheckBranchExists
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    printDryRunPreview(['feat-1', 'feat-2'], ['任务1', '任务2'], 0);

    // 冲突分支的序号行应同时包含分支名和"已存在"警告
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('已存在'));
    // 冲突分支应包含 ⚠ 标识
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('⚠'));
    // 应输出冲突结论
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('分支冲突'));
  });

  it('交互式模式显示交互提示', () => {
    mockedCheckBranchExists.mockReturnValue(false);

    printDryRunPreview(['feat'], [], 0);

    // 交互式模式下应显示交互模式提示
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('交互式'));
  });

  it('非交互式模式显示任务描述', () => {
    mockedCheckBranchExists.mockReturnValue(false);

    printDryRunPreview(['feat-1'], ['实现登录功能'], 2);

    // 应包含任务描述
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('实现登录功能'));
  });

  it('摘要行合并为一行并包含关键信息', () => {
    mockedCheckBranchExists.mockReturnValue(false);

    printDryRunPreview(['feat-1', 'feat-2'], ['任务1', '任务2'], 5);

    // 摘要行应同时包含任务数、并发数和 Worktree 路径
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('任务数: 2'));
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('并发数: 5'));
    expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('Worktree:'));
  });
});
