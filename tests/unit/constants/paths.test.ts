import { describe, it, expect } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CLAWT_HOME, CONFIG_PATH, LOGS_DIR, WORKTREES_DIR, VALIDATE_SNAPSHOTS_DIR } from '../../../src/constants/paths.js';

describe('CLAWT_HOME', () => {
  it('位于用户主目录下的 .clawt', () => {
    expect(CLAWT_HOME).toBe(join(homedir(), '.clawt'));
  });

  it('包含 .clawt', () => {
    expect(CLAWT_HOME).toContain('.clawt');
  });
});

describe('CONFIG_PATH', () => {
  it('位于 CLAWT_HOME 下的 config.json', () => {
    expect(CONFIG_PATH).toBe(join(CLAWT_HOME, 'config.json'));
  });

  it('以 .json 结尾', () => {
    expect(CONFIG_PATH).toMatch(/\.json$/);
  });
});

describe('LOGS_DIR', () => {
  it('位于 CLAWT_HOME 下的 logs', () => {
    expect(LOGS_DIR).toBe(join(CLAWT_HOME, 'logs'));
  });
});

describe('WORKTREES_DIR', () => {
  it('位于 CLAWT_HOME 下的 worktrees', () => {
    expect(WORKTREES_DIR).toBe(join(CLAWT_HOME, 'worktrees'));
  });
});

describe('VALIDATE_SNAPSHOTS_DIR', () => {
  it('位于 CLAWT_HOME 下的 validate-snapshots', () => {
    expect(VALIDATE_SNAPSHOTS_DIR).toBe(join(CLAWT_HOME, 'validate-snapshots'));
  });
});

describe('路径层级关系', () => {
  it('CONFIG_PATH、LOGS_DIR、WORKTREES_DIR、VALIDATE_SNAPSHOTS_DIR 都在 CLAWT_HOME 下', () => {
    expect(CONFIG_PATH.startsWith(CLAWT_HOME)).toBe(true);
    expect(LOGS_DIR.startsWith(CLAWT_HOME)).toBe(true);
    expect(WORKTREES_DIR.startsWith(CLAWT_HOME)).toBe(true);
    expect(VALIDATE_SNAPSHOTS_DIR.startsWith(CLAWT_HOME)).toBe(true);
  });
});
