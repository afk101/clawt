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

/** Claude Code 项目会话目录 ~/.claude/projects/ */
export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/** 更新检查缓存文件路径 ~/.clawt/update-check.json */
export const UPDATE_CHECK_PATH = join(CLAWT_HOME, 'update-check.json');

/** 项目配置目录 ~/.clawt/projects/ */
export const PROJECTS_CONFIG_DIR = join(CLAWT_HOME, 'projects');

/** session_id 持久化目录 ~/.clawt/sessions/ */
export const SESSIONS_DIR = join(CLAWT_HOME, 'sessions');

/** session 文件扩展名 */
export const SESSION_FILE_EXTENSION = '.session';
