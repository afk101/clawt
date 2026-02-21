import { describe, it, expect } from 'vitest';
import { INVALID_BRANCH_CHARS } from '../../../src/constants/branch.js';

describe('INVALID_BRANCH_CHARS', () => {
  it('是一个全局正则表达式', () => {
    expect(INVALID_BRANCH_CHARS).toBeInstanceOf(RegExp);
    expect(INVALID_BRANCH_CHARS.global).toBe(true);
  });

  it('匹配斜杠 /', () => {
    expect('feature/test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配反斜杠 \\', () => {
    expect('feature\\test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配点号 .', () => {
    expect('feature.test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配空格', () => {
    expect('feature test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配波浪号 ~', () => {
    expect('feature~test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配冒号 :', () => {
    expect('feature:test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配星号 *', () => {
    expect('feature*test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配问号 ?', () => {
    expect('feature?test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('匹配方括号 []', () => {
    expect('feature[test]'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test-');
  });

  it('匹配 ^', () => {
    expect('feature^test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('连续非法字符合并为一次匹配', () => {
    expect('feature...test'.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe('feature-test');
  });

  it('不匹配合法字符（字母、数字、-）', () => {
    const legal = 'feature-add-login-123';
    expect(legal.replace(new RegExp(INVALID_BRANCH_CHARS.source, 'g'), '-')).toBe(legal);
  });
});
