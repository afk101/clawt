import { execSync } from 'node:child_process';
import { logger } from '../logger/index.js';
import { ClawtError } from '../errors/index.js';
import { getConfigValue } from './config.js';
import { getConflictFiles, gitAddFiles, gitMergeContinue } from './git.js';
import { printInfo, printSuccess, printWarning } from './formatter.js';
import { confirmAction } from './formatter.js';
import { MESSAGES, CONFLICT_RESOLVE_PROMPT } from '../constants/index.js';

/**
 * 构建发送给 Claude Code 的冲突解决 prompt
 * Claude Code 会自动读取当前工作目录下的冲突文件，无需手动传入
 * @returns {string} 纯指令性 AI prompt
 */
export function buildConflictResolvePrompt(): string {
  return CONFLICT_RESOLVE_PROMPT;
}

/**
 * 调用 Claude Code CLI 以非交互模式解决冲突
 * @param {string} prompt - AI prompt
 * @param {string} cwd - 工作目录
 * @returns {string} Claude Code 的输出
 */
export function invokeClaudeForConflictResolve(prompt: string, cwd: string): string {
  // 使用 shell 拼接以保留引号和参数完整性
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const fullCommand = `claude -p '${escapedPrompt}' --permission-mode bypassPermissions`;

  logger.info(`调用 Claude Code 解决冲突，命令: claude -p "..." --permission-mode bypassPermissions`);

  try {
    const output = execSync(fullCommand, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000, // 5 分钟超时
    });
    return output;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Claude Code 冲突解决失败: ${errMsg}`);
    throw new ClawtError(MESSAGES.MERGE_CONFLICT_AI_FAILED(errMsg));
  }
}

/**
 * 执行 AI 辅助冲突解决的完整流程
 * 1. 获取冲突文件列表
 * 2. 构建 AI prompt
 * 3. 调用 Claude Code 解决冲突
 * 4. 检查冲突是否解决
 * 5. git add 已解决的文件并 merge --continue
 * @param {string} currentBranch - 当前分支名
 * @param {string} incomingBranch - 传入分支名
 * @param {string} cwd - 工作目录
 * @returns {boolean} 是否所有冲突都已解决
 */
export function resolveConflictsWithAI(
  currentBranch: string,
  incomingBranch: string,
  cwd: string,
): boolean {
  const conflictFiles = getConflictFiles(cwd);
  if (conflictFiles.length === 0) {
    return true;
  }

  printInfo(MESSAGES.MERGE_CONFLICT_AI_START(conflictFiles.length));

  // 构建 prompt 并调用 Claude Code
  const prompt = buildConflictResolvePrompt();
  invokeClaudeForConflictResolve(prompt, cwd);

  // 检查冲突是否已解决
  const remainingConflicts = getConflictFiles(cwd);

  if (remainingConflicts.length === 0) {
    // 所有冲突已解决，git add 所有原冲突文件并完成 merge
    gitAddFiles(conflictFiles, cwd);
    gitMergeContinue(cwd);
    printSuccess(MESSAGES.MERGE_CONFLICT_AI_SUCCESS);
    return true;
  }

  // 部分冲突已解决，git add 已解决的文件
  const resolvedFiles = conflictFiles.filter((f) => !remainingConflicts.includes(f));
  if (resolvedFiles.length > 0) {
    gitAddFiles(resolvedFiles, cwd);
  }

  printWarning(MESSAGES.MERGE_CONFLICT_AI_PARTIAL(remainingConflicts.length));
  return false;
}

/**
 * 根据配置和命令选项判断冲突解决模式
 * @param {boolean} [autoFlag] - --auto 命令行参数
 * @returns {'ask' | 'auto' | 'manual'} 冲突解决模式
 */
export function determineConflictResolveMode(autoFlag?: boolean): 'ask' | 'auto' | 'manual' {
  // --auto 命令行参数优先级最高
  if (autoFlag === true) {
    return 'auto';
  }

  const configMode = getConfigValue('conflictResolveMode');
  if (configMode === 'auto' || configMode === 'manual') {
    return configMode;
  }

  return 'ask';
}

/**
 * 处理合并冲突的入口函数
 * 根据冲突解决模式决定处理方式：auto 直接 AI 解决，ask 询问用户，manual 抛出错误
 * @param {string} currentBranch - 当前分支名
 * @param {string} incomingBranch - 传入分支名
 * @param {string} cwd - 工作目录
 * @param {boolean} [autoFlag] - --auto 命令行参数
 * @returns {Promise<boolean>} 是否成功解决了所有冲突
 */
export async function handleMergeConflict(
  currentBranch: string,
  incomingBranch: string,
  cwd: string,
  autoFlag?: boolean,
): Promise<boolean> {
  const mode = determineConflictResolveMode(autoFlag);

  if (mode === 'manual') {
    throw new ClawtError(MESSAGES.MERGE_CONFLICT_MANUAL);
  }

  if (mode === 'auto') {
    return resolveConflictsWithAI(currentBranch, incomingBranch, cwd);
  }

  // mode === 'ask'
  const shouldUseAI = await confirmAction(MESSAGES.MERGE_CONFLICT_ASK_AI);
  if (!shouldUseAI) {
    throw new ClawtError(MESSAGES.MERGE_CONFLICT_MANUAL);
  }

  return resolveConflictsWithAI(currentBranch, incomingBranch, cwd);
}
