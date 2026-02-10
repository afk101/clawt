import { MESSAGES } from '../constants/index.js';
import { ClawtError } from '../errors/index.js';
import { execCommand } from './shell.js';
import { getGitCommonDir } from './git.js';

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
