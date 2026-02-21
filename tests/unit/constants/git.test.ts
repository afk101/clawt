import { describe, it, expect } from 'vitest';
import { AUTO_SAVE_COMMIT_MESSAGE } from '../../../src/constants/git.js';

describe('AUTO_SAVE_COMMIT_MESSAGE', () => {
  it('值为预期的 commit message', () => {
    expect(AUTO_SAVE_COMMIT_MESSAGE).toBe('chore: auto-save before sync');
  });

  it('是非空字符串', () => {
    expect(typeof AUTO_SAVE_COMMIT_MESSAGE).toBe('string');
    expect(AUTO_SAVE_COMMIT_MESSAGE.length).toBeGreaterThan(0);
  });

  it('符合 conventional commit 格式', () => {
    expect(AUTO_SAVE_COMMIT_MESSAGE).toMatch(/^[a-z]+:\s.+$/);
  });
});
