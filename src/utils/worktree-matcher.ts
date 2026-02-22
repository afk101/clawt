import Enquirer from 'enquirer';
import { ClawtError } from '../errors/index.js';
import type { WorktreeInfo } from '../types/index.js';

/**
 * 分支解析时使用的消息文案配置
 * 通过此接口实现命令间的消息解耦，不同命令可传入各自的提示文案
 */
export interface WorktreeResolveMessages {
  /** 无可用 worktree 时的错误消息 */
  noWorktrees: string;
  /** 未传分支名时的交互选择提示 */
  selectBranch: string;
  /** 模糊匹配到多个结果时的交互选择提示 */
  multipleMatches: (keyword: string) => string;
  /** 无匹配结果时的错误消息 */
  noMatch: (keyword: string, branches: string[]) => string;
}

/**
 * 在 worktree 列表中精确匹配分支名
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string} branchName - 目标分支名
 * @returns {WorktreeInfo | undefined} 匹配的 worktree，未找到返回 undefined
 */
export function findExactMatch(worktrees: WorktreeInfo[], branchName: string): WorktreeInfo | undefined {
  return worktrees.find((wt) => wt.branch === branchName);
}

/**
 * 在 worktree 列表中进行模糊匹配（子串匹配，大小写不敏感）
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {string} keyword - 匹配关键词
 * @returns {WorktreeInfo[]} 匹配到的 worktree 列表
 */
export function findFuzzyMatches(worktrees: WorktreeInfo[], keyword: string): WorktreeInfo[] {
  const lowerKeyword = keyword.toLowerCase();
  return worktrees.filter((wt) => wt.branch.toLowerCase().includes(lowerKeyword));
}

/**
 * 多选场景下的分支解析消息文案配置
 * 与 WorktreeResolveMessages 类似，但用于需要多选的命令（如 remove）
 */
export interface WorktreeMultiResolveMessages {
  /** 无可用 worktree 时的错误消息 */
  noWorktrees: string;
  /** 未传分支名时的多选交互提示 */
  selectBranch: string;
  /** 模糊匹配到多个结果时的多选交互提示 */
  multipleMatches: (keyword: string) => string;
  /** 无匹配结果时的错误消息 */
  noMatch: (keyword: string, branches: string[]) => string;
}

/**
 * 通过交互式列表让用户从 worktree 列表中选择一个分支
 * @param {WorktreeInfo[]} worktrees - 可供选择的 worktree 列表
 * @param {string} message - 选择提示信息
 * @returns {Promise<WorktreeInfo>} 用户选择的 worktree
 */
export async function promptSelectBranch(worktrees: WorktreeInfo[], message: string): Promise<WorktreeInfo> {
  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const selectedBranch: string = await new Enquirer.Select({
    message,
    choices: worktrees.map((wt) => ({
      name: wt.branch,
      message: wt.branch,
    })),
  }).run();

  return worktrees.find((wt) => wt.branch === selectedBranch)!;
}

/**
 * 通过交互式多选列表让用户从 worktree 列表中选择多个分支
 * 用户可通过空格键选择/取消，回车键确认
 * @param {WorktreeInfo[]} worktrees - 可供选择的 worktree 列表
 * @param {string} message - 选择提示信息
 * @returns {Promise<WorktreeInfo[]>} 用户选择的 worktree 列表
 */
export async function promptMultiSelectBranches(worktrees: WorktreeInfo[], message: string): Promise<WorktreeInfo[]> {
  // @ts-expect-error enquirer 类型声明未导出 MultiSelect 类，但运行时存在
  const selectedBranches: string[] = await new Enquirer.MultiSelect({
    message,
    choices: worktrees.map((wt) => ({
      name: wt.branch,
      message: wt.branch,
    })),
    // 使用空心圆/实心圆作为选中指示符
    symbols: {
      indicator: { on: '●', off: '○' },
    },
  }).run();

  return worktrees.filter((wt) => selectedBranches.includes(wt.branch));
}

/**
 * 根据用户输入解析目标 worktree（多选版本）
 * 匹配策略：精确匹配 → 模糊匹配（唯一直接使用，多个交互多选） → 无匹配报错
 * 不传分支名时列出所有可用分支供多选
 * @param {WorktreeInfo[]} worktrees - 可用的 worktree 列表
 * @param {WorktreeMultiResolveMessages} messages - 命令专属的消息文案
 * @param {string} [branchName] - 用户输入的分支名（可选）
 * @returns {Promise<WorktreeInfo[]>} 解析后的目标 worktree 列表
 * @throws {ClawtError} 无可用 worktree 或无匹配结果时抛出
 */
export async function resolveTargetWorktrees(
  worktrees: WorktreeInfo[],
  messages: WorktreeMultiResolveMessages,
  branchName?: string,
): Promise<WorktreeInfo[]> {
  // 无可用 worktree，直接报错
  if (worktrees.length === 0) {
    throw new ClawtError(messages.noWorktrees);
  }

  // 未传 -b 参数：列出所有分支供多选
  if (!branchName) {
    // 只有一个 worktree 时直接使用，无需选择
    if (worktrees.length === 1) {
      return [worktrees[0]];
    }
    return promptMultiSelectBranches(worktrees, messages.selectBranch);
  }

  // 1. 精确匹配优先
  const exactMatch = findExactMatch(worktrees, branchName);
  if (exactMatch) {
    return [exactMatch];
  }

  // 2. 模糊匹配
  const fuzzyMatches = findFuzzyMatches(worktrees, branchName);

  // 2a. 唯一匹配，直接使用
  if (fuzzyMatches.length === 1) {
    return [fuzzyMatches[0]];
  }

  // 2b. 多个匹配，交互多选
  if (fuzzyMatches.length > 1) {
    return promptMultiSelectBranches(fuzzyMatches, messages.multipleMatches(branchName));
  }

  // 3. 无匹配，抛出错误并列出所有可用分支
  const allBranches = worktrees.map((wt) => wt.branch);
  throw new ClawtError(messages.noMatch(branchName, allBranches));
}

/**
 * 根据用户输入解析目标 worktree
 * 匹配策略：精确匹配 → 模糊匹配（唯一直接使用，多个交互选择） → 无匹配报错
 * 不传分支名时列出所有可用分支供选择
 * @param {WorktreeInfo[]} worktrees - 可用的 worktree 列表
 * @param {WorktreeResolveMessages} messages - 命令专属的消息文案
 * @param {string} [branchName] - 用户输入的分支名（可选）
 * @returns {Promise<WorktreeInfo>} 解析后的目标 worktree
 * @throws {ClawtError} 无可用 worktree 或无匹配结果时抛出
 */
export async function resolveTargetWorktree(
  worktrees: WorktreeInfo[],
  messages: WorktreeResolveMessages,
  branchName?: string,
): Promise<WorktreeInfo> {
  // 无可用 worktree，直接报错
  if (worktrees.length === 0) {
    throw new ClawtError(messages.noWorktrees);
  }

  // 未传 -b 参数：列出所有分支供选择
  if (!branchName) {
    // 只有一个 worktree 时直接使用，无需选择
    if (worktrees.length === 1) {
      return worktrees[0];
    }
    return promptSelectBranch(worktrees, messages.selectBranch);
  }

  // 1. 精确匹配优先
  const exactMatch = findExactMatch(worktrees, branchName);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. 模糊匹配
  const fuzzyMatches = findFuzzyMatches(worktrees, branchName);

  // 2a. 唯一匹配，直接使用
  if (fuzzyMatches.length === 1) {
    return fuzzyMatches[0];
  }

  // 2b. 多个匹配，交互选择
  if (fuzzyMatches.length > 1) {
    return promptSelectBranch(fuzzyMatches, messages.multipleMatches(branchName));
  }

  // 3. 无匹配，抛出错误并列出所有可用分支
  const allBranches = worktrees.map((wt) => wt.branch);
  throw new ClawtError(messages.noMatch(branchName, allBranches));
}
