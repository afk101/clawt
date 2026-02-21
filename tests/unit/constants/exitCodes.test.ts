import { describe, it, expect } from 'vitest';
import { EXIT_CODES } from '../../../src/constants/exitCodes.js';

describe('EXIT_CODES', () => {
  it('SUCCESS 为 0', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it('ERROR 为 1', () => {
    expect(EXIT_CODES.ERROR).toBe(1);
  });

  it('ARGUMENT_ERROR 为 2', () => {
    expect(EXIT_CODES.ARGUMENT_ERROR).toBe(2);
  });

  it('包含且仅包含三个退出码', () => {
    expect(Object.keys(EXIT_CODES)).toHaveLength(3);
    expect(Object.keys(EXIT_CODES).sort()).toEqual(['ARGUMENT_ERROR', 'ERROR', 'SUCCESS']);
  });

  it('所有值都是数字', () => {
    for (const value of Object.values(EXIT_CODES)) {
      expect(typeof value).toBe('number');
    }
  });
});
