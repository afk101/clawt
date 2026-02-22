import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTaskFile, loadTaskFile } from '../../../src/utils/task-file.js';
import { existsSync, readFileSync } from 'node:fs';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
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
    TASK_FILE_NOT_FOUND: (path: string) => `任务文件不存在: ${path}`,
    TASK_FILE_EMPTY: '任务文件中没有解析到有效任务',
    TASK_FILE_MISSING_BRANCH: (blockIndex: number) => `第 ${blockIndex} 个任务块缺少分支名`,
    TASK_FILE_MISSING_TASK: (branch: string) => `分支 ${branch} 缺少任务描述`,
    TASK_FILE_MISSING_TASK_BY_INDEX: (blockIndex: number) => `第 ${blockIndex} 个任务块缺少任务描述`,
  },
}));

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  mockedExistsSync.mockReset();
  mockedReadFileSync.mockReset();
});

describe('parseTaskFile', () => {
  it('正常解析多个任务块', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现用户登录功能
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch: fix-bug
修复内存泄漏问题
<!-- CLAWT-TASKS:END -->
`;
    const entries = parseTaskFile(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].branch).toBe('feat-login');
    expect(entries[0].task).toBe('实现用户登录功能');
    expect(entries[1].branch).toBe('fix-bug');
    expect(entries[1].task).toBe('修复内存泄漏问题');
  });

  it('支持多行任务描述', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
# branch: feat-dashboard
开发数据仪表盘页面
包含图表和实时数据刷新
支持自定义布局
<!-- CLAWT-TASKS:END -->
`;
    const entries = parseTaskFile(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].branch).toBe('feat-dashboard');
    expect(entries[0].task).toBe('开发数据仪表盘页面\n包含图表和实时数据刷新\n支持自定义布局');
  });

  it('标签外内容被忽略', () => {
    const content = `
这是说明文字，会被忽略

<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现登录功能
<!-- CLAWT-TASKS:END -->

这也是说明文字
`;
    const entries = parseTaskFile(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].branch).toBe('feat-login');
  });

  it('空文件返回空数组', () => {
    const entries = parseTaskFile('');
    expect(entries).toHaveLength(0);
  });

  it('没有任务块时返回空数组', () => {
    const entries = parseTaskFile('一些普通文本内容');
    expect(entries).toHaveLength(0);
  });

  it('缺少分支名时抛出错误', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
实现登录功能
<!-- CLAWT-TASKS:END -->
`;
    expect(() => parseTaskFile(content)).toThrow('缺少分支名');
  });

  it('缺少任务描述时抛出错误', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
# branch: feat-login
<!-- CLAWT-TASKS:END -->
`;
    expect(() => parseTaskFile(content)).toThrow('缺少任务描述');
  });

  it('branch 前缀支持不同空格格式', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
#branch:feat-login
实现登录功能
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch:   fix-bug
修复问题
<!-- CLAWT-TASKS:END -->
`;
    const entries = parseTaskFile(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].branch).toBe('feat-login');
    expect(entries[1].branch).toBe('fix-bug');
  });

  it('branchRequired: false 时缺少分支名不报错，branch 为 undefined', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
实现登录功能
<!-- CLAWT-TASKS:END -->
`;
    const entries = parseTaskFile(content, { branchRequired: false });
    expect(entries).toHaveLength(1);
    expect(entries[0].branch).toBeUndefined();
    expect(entries[0].task).toBe('实现登录功能');
  });

  it('branchRequired: false 时有分支名仍能正确解析', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现登录功能
<!-- CLAWT-TASKS:END -->
`;
    const entries = parseTaskFile(content, { branchRequired: false });
    expect(entries).toHaveLength(1);
    expect(entries[0].branch).toBe('feat-login');
    expect(entries[0].task).toBe('实现登录功能');
  });

  it('branchRequired: false 时混合有无分支名的块', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现登录功能
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
修复内存泄漏问题
<!-- CLAWT-TASKS:END -->
`;
    const entries = parseTaskFile(content, { branchRequired: false });
    expect(entries).toHaveLength(2);
    expect(entries[0].branch).toBe('feat-login');
    expect(entries[0].task).toBe('实现登录功能');
    expect(entries[1].branch).toBeUndefined();
    expect(entries[1].task).toBe('修复内存泄漏问题');
  });

  it('branchRequired: false 时仍校验任务描述', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
<!-- CLAWT-TASKS:END -->
`;
    expect(() => parseTaskFile(content, { branchRequired: false })).toThrow('缺少任务描述');
  });

  it('不传 options 时默认要求分支名（向后兼容）', () => {
    const content = `
<!-- CLAWT-TASKS:START -->
实现登录功能
<!-- CLAWT-TASKS:END -->
`;
    expect(() => parseTaskFile(content)).toThrow('缺少分支名');
  });
});

describe('loadTaskFile', () => {
  it('文件不存在时抛出错误', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(() => loadTaskFile('nonexistent.md')).toThrow('任务文件不存在');
  });

  it('文件无有效任务时抛出错误', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('普通文本内容');
    expect(() => loadTaskFile('empty.md')).toThrow('没有解析到有效任务');
  });

  it('正常加载并解析文件', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(`
<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现登录功能
<!-- CLAWT-TASKS:END -->
`);
    const entries = loadTaskFile('tasks.md');
    expect(entries).toHaveLength(1);
    expect(entries[0].branch).toBe('feat-login');
    expect(entries[0].task).toBe('实现登录功能');
  });

  it('透传 branchRequired: false 选项', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(`
<!-- CLAWT-TASKS:START -->
实现登录功能
<!-- CLAWT-TASKS:END -->
`);
    const entries = loadTaskFile('tasks.md', { branchRequired: false });
    expect(entries).toHaveLength(1);
    expect(entries[0].branch).toBeUndefined();
    expect(entries[0].task).toBe('实现登录功能');
  });
});
