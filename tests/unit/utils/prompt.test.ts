import { describe, it, expect, vi } from 'vitest';

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

import { multilineInput } from '../../../src/utils/prompt.js';

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
