import { homedir } from 'node:os';
import { join } from 'node:path';

/** clawt 主目录 ~/.clawt/ */
export const CLAWT_HOME = join(homedir(), '.clawt');

/** 全局配置文件路径 ~/.clawt/config.json */
export const CONFIG_PATH = join(CLAWT_HOME, 'config.json');

/** 日志目录 ~/.clawt/logs/ */
export const LOGS_DIR = join(CLAWT_HOME, 'logs');

/** worktree 统一存放目录 ~/.clawt/worktrees/ */
export const WORKTREES_DIR = join(CLAWT_HOME, 'worktrees');

/** validate 快照目录 ~/.clawt/validate-snapshots/ */
export const VALIDATE_SNAPSHOTS_DIR = join(CLAWT_HOME, 'validate-snapshots');
