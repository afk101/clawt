import { describe, it, expect } from 'vitest';
import { ClawtError } from '../../../src/errors/index.js';
import { EXIT_CODES } from '../../../src/constants/index.js';

describe('ClawtError', () => {
  it('默认退出码为 EXIT_CODES.ERROR (1)', () => {
    const error = new ClawtError('测试错误');
    expect(error.exitCode).toBe(EXIT_CODES.ERROR);
    expect(error.exitCode).toBe(1);
  });

  it('自定义退出码正确传递', () => {
    const error = new ClawtError('参数错误', EXIT_CODES.ARGUMENT_ERROR);
    expect(error.exitCode).toBe(2);
  });

  it('name 属性为 ClawtError', () => {
    const error = new ClawtError('测试');
    expect(error.name).toBe('ClawtError');
  });

  it('message 正确设置', () => {
    const error = new ClawtError('具体的错误消息');
    expect(error.message).toBe('具体的错误消息');
  });

  it('是 Error 的实例', () => {
    const error = new ClawtError('测试');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ClawtError);
  });
});
