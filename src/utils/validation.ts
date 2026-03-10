import { MESSAGES } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { execCommand } from './shell.js';
import { getGitCommonDir, isWorkingDirClean } from './git.js';
import { requireProjectConfig, guardMainWorkBranchExists } from './project-config.js';
import { ensureOnMainWorkBranch } from './validate-branch.js';

/** 统一前置校验选项 */
export interface PreCheckOptions {
  /** 校验当前目录是否在主 worktree 根目录 */
  requireMainWorktree?: boolean;
  /** 校验 HEAD 是否存在（仓库有至少一次 commit） */
  requireHead?: boolean;
  /** 校验项目配置文件是否存在且合法 */
  requireProjectConfig?: boolean;
  /** 校验配置中的主工作分支在 git 仓库中是否存在 */
  requireMainBranchExists?: boolean;
  /** 确保当前在主工作分支上，不在则自动切换 */
  ensureOnClawtMainWorkBranch?: boolean;
  /** 校验主分支工作区和暂存区是否干净 */
  requireCleanWorkingDir?: boolean;
  /** 校验 Claude Code CLI 是否已安装 */
  requireClaudeCode?: boolean;
}

/**
 * 校验当前目录是否为主 worktree 的根目录
 * 条件：git rev-parse --git-common-dir === ".git"
 * @throws {ClawtError} 不在主 worktree 根目录时抛出（包括不在 git 仓库中的情况）
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
 * @deprecated 当前无调用方，保留函数不删除
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
 * 执行顺序：同步快速校验 → 异步交互校验 → 依赖前序结果的校验
 * @param {PreCheckOptions} options - 校验选项
 * @param {boolean} [options.requireMainWorktree] - 校验当前目录是否在主 worktree 根目录
 * @param {boolean} [options.requireHead] - 校验 HEAD 是否存在
 * @param {boolean} [options.requireProjectConfig] - 校验项目配置文件是否存在且合法
 * @param {boolean} [options.requireMainBranchExists] - 校验配置中的主工作分支在 git 仓库中是否存在
 * @param {boolean} [options.ensureOnClawtMainWorkBranch] - 确保当前在主工作分支上，不在则自动切换
 * @param {boolean} [options.requireCleanWorkingDir] - 校验主分支工作区和暂存区是否干净
 * @param {boolean} [options.requireClaudeCode] - 校验 Claude Code CLI 是否已安装
 * @throws {ClawtError} 任一校验未通过时抛出
 */
export async function runPreChecks(options: PreCheckOptions): Promise<void> {
  // 阶段 1：同步快速校验
  if (options.requireMainWorktree) {
    validateMainWorktree();
  }
  if (options.requireHead) {
    validateHeadExists();
  }
  if (options.requireProjectConfig) {
    requireProjectConfig();
  }
  if (options.requireMainBranchExists) {
    guardMainWorkBranchExists();
  }

  // 阶段 2：异步交互校验
  if (options.ensureOnClawtMainWorkBranch) {
    await ensureOnMainWorkBranch();
  }

  // 阶段 3：依赖前序结果的校验
  if (options.requireCleanWorkingDir) {
    validateWorkingDirClean();
  }
  if (options.requireClaudeCode) {
    validateClaudeCodeInstalled();
  }
}
