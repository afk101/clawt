import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock logger（避免测试时写日志文件）
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock formatter（避免终端输出）
vi.mock('../../../src/utils/formatter.js', () => ({
  printWarning: vi.fn(),
}));

// mock git（checkBranchExists）
vi.mock('../../../src/utils/git.js', () => ({
  checkBranchExists: vi.fn(),
}));

import { sanitizeBranchName, generateBranchNames, validateBranchesNotExist } from '../../../src/utils/branch.js';
import { printWarning } from '../../../src/utils/formatter.js';
import { checkBranchExists } from '../../../src/utils/git.js';
import { ClawtError } from '../../../src/errors/index.js';

const mockedCheckBranchExists = vi.mocked(checkBranchExists);
const mockedPrintWarning = vi.mocked(printWarning);

describe('sanitizeBranchName', () => {
  it('合法分支名原样返回', () => {
    expect(sanitizeBranchName('feature-add-login')).toBe('feature-add-login');
  });

  it('非法字符替换为 -', () => {
    expect(sanitizeBranchName('feature/add login')).toBe('feature-add-login');
  });

  it('连续非法字符压缩为单个 -', () => {
    expect(sanitizeBranchName('feature...add')).toBe('feature-add');
  });

  it('首尾 - 去除', () => {
    expect(sanitizeBranchName('.feature-add.')).toBe('feature-add');
  });

  it('全部非法字符时抛出 ClawtError', () => {
    expect(() => sanitizeBranchName('...')).toThrow(ClawtError);
  });

  it('转换时触发 printWarning', () => {
    sanitizeBranchName('feature/test');
    expect(mockedPrintWarning).toHaveBeenCalled();
  });

  it('合法分支名不触发 printWarning', () => {
    sanitizeBranchName('feature-test');
    expect(mockedPrintWarning).not.toHaveBeenCalled();
  });
});

describe('generateBranchNames', () => {
  it('count=1 返回 [branchName]', () => {
    expect(generateBranchNames('feature', 1)).toEqual(['feature']);
  });

  it('count=3 返回带序号后缀的数组', () => {
    expect(generateBranchNames('feature', 3)).toEqual([
      'feature-1',
      'feature-2',
      'feature-3',
    ]);
  });

  it('count=2 返回带序号后缀的数组', () => {
    expect(generateBranchNames('test', 2)).toEqual(['test-1', 'test-2']);
  });
});

describe('validateBranchesNotExist', () => {
  it('所有分支不存在时正常通过', () => {
    mockedCheckBranchExists.mockReturnValue(false);
    expect(() => validateBranchesNotExist(['a', 'b', 'c'])).not.toThrow();
  });

  it('有分支存在时抛出 ClawtError', () => {
    mockedCheckBranchExists.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(() => validateBranchesNotExist(['a', 'b'])).toThrow(ClawtError);
  });

  it('第一个分支存在时立即抛出', () => {
    mockedCheckBranchExists.mockReturnValue(true);
    expect(() => validateBranchesNotExist(['existing'])).toThrow(ClawtError);
    expect(mockedCheckBranchExists).toHaveBeenCalledTimes(1);
  });
});
