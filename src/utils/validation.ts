import { MESSAGES } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { execCommand } from './shell.js';
import { getGitCommonDir, isWorkingDirClean } from './git.js';
import { requireProjectConfig, guardMainWorkBranchExists } from './project-config.js';

/** 统一前置校验选项 */
interface PreCheckOptions {
  /** 校验是否在主 worktree 根目录 */
  mainWorktree?: boolean;
  /** 校验 HEAD 是否存在（仓库有至少一次 commit） */
  headExists?: boolean;
  /** 校验项目是否已初始化（配置文件存在） */
  projectConfig?: boolean;
  /** 校验配置的主工作分支是否存在 */
  branchExists?: boolean;
}

/**
 * 校验当前目录是否为主 worktree 的根目录
 * 条件：git rev-parse --git-common-dir === ".git"
 * @throws {ClawtError} 不在主 worktree 根目录时抛出
 */
export function validateMainWorktree(): void {
  try {
    const gitCommonDir = getGitCommonDir();
    if (gitCommonDir !== '.git') {
      throw new ClawtError(MESSAGES.NOT_MAIN_WORKTREE);
    }
  } catch (error) {
    if (error instanceof ClawtError) {
      throw error;
    }
    // git 命令执行失败，可能不在 git 仓库中
    throw new ClawtError(MESSAGES.NOT_MAIN_WORKTREE);
  }
}

/**
 * 校验 Git 是否已安装
 * @throws {ClawtError} Git 未安装时抛出
 */
export function validateGitInstalled(): void {
  try {
    execCommand('git --version');
  } catch {
    throw new ClawtError(MESSAGES.GIT_NOT_INSTALLED);
  }
}

/**
 * 校验 Claude Code CLI 是否已安装
 * @throws {ClawtError} Claude Code CLI 未安装时抛出
 */
export function validateClaudeCodeInstalled(): void {
  try {
    execCommand('claude --version');
  } catch {
    throw new ClawtError(MESSAGES.CLAUDE_NOT_INSTALLED);
  }
}

/**
 * 校验 HEAD 是否存在（仓库是否有至少一次 commit）
 * git init 后未做任何 commit 时，HEAD 不指向有效引用
 * @throws {ClawtError} HEAD 不存在时抛出
 */
export function validateHeadExists(): void {
  try {
    execCommand('git rev-parse --verify HEAD');
  } catch {
    throw new ClawtError(MESSAGES.HEAD_NOT_FOUND);
  }
}

/**
 * 校验主分支工作区和暂存区是否干净
 * 当存在未提交的更改时抛出错误，防止基于脏状态创建 worktree
 * @throws {ClawtError} 工作区或暂存区不干净时抛出
 */
export function validateWorkingDirClean(): void {
  if (!isWorkingDirClean()) {
    throw new ClawtError(MESSAGES.MAIN_WORKTREE_DIRTY);
  }
}

/**
 * 统一前置校验入口，按需执行各项校验
 * @param {PreCheckOptions} options - 校验选项
 * @param {boolean} [options.mainWorktree] - 校验是否在主 worktree 根目录
 * @param {boolean} [options.headExists] - 校验 HEAD 是否存在
 * @param {boolean} [options.projectConfig] - 校验项目是否已初始化
 * @param {boolean} [options.branchExists] - 校验配置的主工作分支是否存在
 * @throws {ClawtError} 任一校验未通过时抛出
 */
export function runPreChecks(options: PreCheckOptions): void {
  if (options.mainWorktree) {
    validateMainWorktree();
  }
  if (options.headExists) {
    validateHeadExists();
  }
  if (options.projectConfig) {
    requireProjectConfig();
  }
  if (options.branchExists) {
    guardMainWorkBranchExists();
  }
}
