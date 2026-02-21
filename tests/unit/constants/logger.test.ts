import { describe, it, expect } from 'vitest';
import { DEBUG_LOG_PREFIX, DEBUG_TIMESTAMP_FORMAT } from '../../../src/constants/logger.js';

describe('DEBUG_LOG_PREFIX', () => {
  it('值为 [DEBUG]', () => {
    expect(DEBUG_LOG_PREFIX).toBe('[DEBUG]');
  });

  it('包含方括号包裹的标识', () => {
    expect(DEBUG_LOG_PREFIX).toMatch(/^\[.+\]$/);
  });
});

describe('DEBUG_TIMESTAMP_FORMAT', () => {
  it('值为 HH:mm:ss.SSS', () => {
    expect(DEBUG_TIMESTAMP_FORMAT).toBe('HH:mm:ss.SSS');
  });

  it('包含时分秒和毫秒', () => {
    expect(DEBUG_TIMESTAMP_FORMAT).toContain('HH');
    expect(DEBUG_TIMESTAMP_FORMAT).toContain('mm');
    expect(DEBUG_TIMESTAMP_FORMAT).toContain('ss');
    expect(DEBUG_TIMESTAMP_FORMAT).toContain('SSS');
  });
});
