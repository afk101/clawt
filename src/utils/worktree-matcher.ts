import { statSync } from 'node:fs';
import { ClawtError } from '../errors/index.js';
import {
  UNKNOWN_DATE_GROUP,
  UNKNOWN_DATE_SEPARATOR_LABEL,
  GROUP_SEPARATOR_LABEL,
  GROUP_SELECT_ALL_PREFIX,
  GROUP_SELECT_ALL_LABEL,
  SELECT_ALL_NAME,
  SELECT_ALL_LABEL
} from '../constants/index.js';
import type { WorktreeInfo } from '../types/index.js';
import { promptSelectBranch, promptMultiSelectBranches } from './ui-prompts.js';
import type { GroupedChoice } from './ui-prompts.js';

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

/**
 * 将 Date 对象格式化为本地时区的 YYYY-MM-DD 字符串
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD 格式的本地日期字符串
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取 worktree 目录的创建日期（本地时区）
 * 通过文件系统的 birthtime 获取目录实际创建时间，比 git reflog 更准确
 * @param {string} dirPath - worktree 目录路径
 * @returns {string | null} YYYY-MM-DD 格式的本地日期字符串，无法获取时返回 null
 */
export function getWorktreeCreatedDate(dirPath: string): string | null {
  try {
    const stat = statSync(dirPath);
    return formatLocalDate(stat.birthtime);
  } catch {
    return null;
  }
}

/**
 * 获取 worktree 目录的创建时间（ISO 8601 格式）
 * 通过文件系统的 birthtime 获取目录实际创建时间，保留小时/分钟级精度
 * @param {string} dirPath - worktree 目录路径
 * @returns {string | null} ISO 8601 格式的时间字符串，无法获取时返回 null
 */
export function getWorktreeCreatedTime(dirPath: string): string | null {
  try {
    const stat = statSync(dirPath);
    return stat.birthtime.toISOString();
  } catch {
    return null;
  }
}

/**
 * 将 YYYY-MM-DD 日期字符串格式化为中文相对日期描述
 * 基于自然日计算，适用于日期分组场景
 * @param {string} dateStr - YYYY-MM-DD 格式的日期字符串
 * @returns {string} 中文相对日期描述，如"今天"、"昨天"、"3 天前"
 */
export function formatRelativeDate(dateStr: string): string {
  const today = formatLocalDate(new Date());
  const todayMs = new Date(today).getTime();
  const targetMs = new Date(dateStr).getTime();
  const diffDays = Math.round((todayMs - targetMs) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays} 天前`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} 个月前`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} 年前`;
}

/**
 * 按创建日期对 worktree 列表进行分组
 * 通过 worktree 目录的文件系统创建时间进行分组
 * 无法获取日期的分支归入"未知日期"组
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @returns {Map<string, WorktreeInfo[]>} 日期 → worktree 列表的映射，按日期降序排列，未知日期在最后
 */
export function groupWorktreesByDate(worktrees: WorktreeInfo[]): Map<string, WorktreeInfo[]> {
  const groups = new Map<string, WorktreeInfo[]>();

  for (const wt of worktrees) {
    const dateKey = getWorktreeCreatedDate(wt.path) ?? UNKNOWN_DATE_GROUP;

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(wt);
  }

  // 按日期降序排列，未知日期放最后
  const sortedEntries = [...groups.entries()].sort((a, b) => {
    if (a[0] === UNKNOWN_DATE_GROUP) return 1;
    if (b[0] === UNKNOWN_DATE_GROUP) return -1;
    return b[0].localeCompare(a[0]);
  });

  return new Map(sortedEntries);
}

/**
 * 根据分组数据构建 enquirer MultiSelect 的 choices 数组
 * 包含全局全选、每组的分隔线和组全选、以及各组内的分支选项
 * @param {Map<string, WorktreeInfo[]>} groups - 日期分组数据
 * @returns {GroupedChoice[]} enquirer choices 数组
 */
export function buildGroupedChoices(groups: Map<string, WorktreeInfo[]>): GroupedChoice[] {
  const choices: GroupedChoice[] = [];

  // 顶部插入全局全选
  choices.push({ name: SELECT_ALL_NAME, message: SELECT_ALL_LABEL });

  for (const [dateKey, worktreeList] of groups) {
    // 分隔线
    if (dateKey === UNKNOWN_DATE_GROUP) {
      choices.push({ role: 'separator', message: UNKNOWN_DATE_SEPARATOR_LABEL });
    } else {
      const relativeTime = formatRelativeDate(dateKey);
      choices.push({ role: 'separator', message: GROUP_SEPARATOR_LABEL(dateKey, relativeTime) });
    }

    // 组级全选
    const groupSelectAllName = `${GROUP_SELECT_ALL_PREFIX}${dateKey}`;
    choices.push({ name: groupSelectAllName, message: GROUP_SELECT_ALL_LABEL(dateKey) });

    // 该组内各分支
    for (const wt of worktreeList) {
      choices.push({ name: wt.branch, message: wt.branch });
    }
  }

  return choices;
}

/**
 * 构建组全选 name 到该组分支 name 列表的映射
 * 用于 space() 方法中快速查找某个组全选项对应的所有分支
 * @param {Map<string, WorktreeInfo[]>} groups - 日期分组数据
 * @returns {Map<string, string[]>} 组全选 name → 分支 name 列表的映射
 */
export function buildGroupMembershipMap(groups: Map<string, WorktreeInfo[]>): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const [dateKey, worktreeList] of groups) {
    const groupSelectAllName = `${GROUP_SELECT_ALL_PREFIX}${dateKey}`;
    map.set(groupSelectAllName, worktreeList.map((wt) => wt.branch));
  }

  return map;
}

export { promptGroupedMultiSelectBranches } from './ui-prompts.js';
