import { describe, it, expect } from 'vitest';
import { AUTO_SAVE_COMMIT_MESSAGE_PREFIX } from '../../../src/constants/git.js';

describe('AUTO_SAVE_COMMIT_MESSAGE_PREFIX', () => {
  it('值为预期的前缀', () => {
    expect(AUTO_SAVE_COMMIT_MESSAGE_PREFIX).toBe('clawt: auto-save before merging');
  });

  it('是非空字符串', () => {
    expect(typeof AUTO_SAVE_COMMIT_MESSAGE_PREFIX).toBe('string');
    expect(AUTO_SAVE_COMMIT_MESSAGE_PREFIX.length).toBeGreaterThan(0);
  });

  it('符合 conventional commit 格式', () => {
    expect(AUTO_SAVE_COMMIT_MESSAGE_PREFIX).toMatch(/^[a-z]+:\s.+$/);
  });
});
