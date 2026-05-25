import { describe, it, expect, vi } from 'vitest';

// mock i18n 模块，使 getCurrentLanguage 返回 'en' 以匹配英文断言
// 需要同时提供 createMessages 的真实实现，以便 constants 模块加载时能正确生成英文消息
vi.mock('../../../src/utils/i18n.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/i18n.js')>();
  // 在 createMessages 调用前就 mock getCurrentLanguage
  const mockGetCurrentLanguage = vi.fn().mockReturnValue('en');
  return {
    ...actual,
    getCurrentLanguage: mockGetCurrentLanguage,
    resetLanguageCache: vi.fn(),
    // 重写 createMessages 使其使用 mock 的 getCurrentLanguage
    createMessages: <T extends Record<string, { en: any; 'zh-CN': any }>>(
      i18nMap: T,
    ) => {
      const result: any = {};
      for (const key of Object.keys(i18nMap)) {
        result[key] = i18nMap[key]['en'];
      }
      return result;
    },
  };
});

// mock 非交互模式判断函数
const { mockIsNonInteractive } = vi.hoisted(() => {
  return { mockIsNonInteractive: vi.fn().mockReturnValue(false) };
});

vi.mock('../../../src/utils/interactive.js', () => ({
  isNonInteractive: mockIsNonInteractive,
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

// mock enquirer - 使用 vi.hoisted 确保变量在 vi.mock 提升后仍可访问
const { mockRun, MockInput } = vi.hoisted(() => {
  const mockRun = vi.fn();
  // 必须使用 function 声明，因为源码使用 new Enquirer.Input() 调用
  function MockInput() {
    return { run: mockRun };
  }
  return { mockRun, MockInput };
});

vi.mock('enquirer', () => ({
  default: {
    Input: MockInput,
  },
}));

import { multilineInput, promptCommitMessage } from '../../../src/utils/prompt.js';

describe('multilineInput', () => {
  it('返回用户输入的内容', async () => {
    mockRun.mockResolvedValue('这是用户输入的内容');

    const result = await multilineInput('请输入');

    expect(result).toBe('这是用户输入的内容');
  });

  it('返回空字符串', async () => {
    mockRun.mockResolvedValue('');

    const result = await multilineInput('请输入');

    expect(result).toBe('');
  });

  it('调用 prompt.run() 方法', async () => {
    mockRun.mockResolvedValue('test');

    await multilineInput('提示');

    expect(mockRun).toHaveBeenCalled();
  });

  it('返回多行文本', async () => {
    mockRun.mockResolvedValue('第一行\n第二行\n第三行');

    const result = await multilineInput('请输入多行');

    expect(result).toBe('第一行\n第二行\n第三行');
  });
});

describe('promptCommitMessage', () => {
  it('交互模式下正常返回用户输入', async () => {
    mockIsNonInteractive.mockReturnValue(false);
    mockRun.mockResolvedValue('用户输入的提交信息');

    const result = await promptCommitMessage('请输入提交信息', '非交互模式错误');

    expect(result).toBe('用户输入的提交信息');
  });

  it('非交互模式下抛出 ClawtError', async () => {
    mockIsNonInteractive.mockReturnValue(true);

    await expect(
      promptCommitMessage('请输入提交信息', '非交互模式下不可用'),
    ).rejects.toThrow('非交互模式下不可用');
  });

  it('用户输入为空时抛出 ClawtError', async () => {
    mockIsNonInteractive.mockReturnValue(false);
    mockRun.mockResolvedValue('');

    await expect(
      promptCommitMessage('请输入提交信息', '非交互模式错误'),
    ).rejects.toThrow('Commit message cannot be empty');
  });

  it('用户输入仅空白字符时抛出 ClawtError', async () => {
    mockIsNonInteractive.mockReturnValue(false);
    mockRun.mockResolvedValue('   ');

    await expect(
      promptCommitMessage('请输入提交信息', '非交互模式错误'),
    ).rejects.toThrow('Commit message cannot be empty');
  });

  it('返回 trim 后的用户输入', async () => {
    mockIsNonInteractive.mockReturnValue(false);
    mockRun.mockResolvedValue('  提交信息  ');

    const result = await promptCommitMessage('请输入提交信息', '非交互模式错误');

    expect(result).toBe('提交信息');
  });
});
