import Enquirer from 'enquirer';
import { statSync } from 'node:fs';
import { ClawtError } from '../errors/index.js';
import {
  SELECT_ALL_NAME,
  SELECT_ALL_LABEL,
  GROUP_SELECT_ALL_PREFIX,
  GROUP_SELECT_ALL_LABEL,
  GROUP_SEPARATOR_LABEL,
  UNKNOWN_DATE_GROUP,
  UNKNOWN_DATE_SEPARATOR_LABEL,
} from '../constants/index.js';
import type { WorktreeInfo } from '../types/index.js';

/** enquirer MultiSelect 选项条目的运行时结构 */
interface MultiSelectChoice {
  name: string;
  message: string;
  enabled: boolean;
}

/**
 * enquirer MultiSelect 实例的运行时接口
 * enquirer 类型声明未导出 MultiSelect，手动声明以消除 TypeScript 类型错误
 */
interface MultiSelectInstance {
  focused: MultiSelectChoice | undefined;
  choices: MultiSelectChoice[];
  render(): void;
  toggle(choice: MultiSelectChoice): void;
  run(): Promise<string[]>;
}

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
 * 顶部提供「全选」选项，点击可切换全选/全不选
 * 用户可通过空格键选择/取消，回车键确认
 * @param {WorktreeInfo[]} worktrees - 可供选择的 worktree 列表
 * @param {string} message - 选择提示信息
 * @returns {Promise<WorktreeInfo[]>} 用户选择的 worktree 列表
 */
export async function promptMultiSelectBranches(worktrees: WorktreeInfo[], message: string): Promise<WorktreeInfo[]> {
  // 构建 choices 列表，顶部插入全选选项
  const branchChoices = worktrees.map((wt) => ({
    name: wt.branch,
    message: wt.branch,
  }));

  const choices = [
    { name: SELECT_ALL_NAME, message: SELECT_ALL_LABEL },
    ...branchChoices,
  ];

  // @ts-expect-error enquirer 类型声明未导出 MultiSelect 类，但运行时存在
  const MultiSelect: new (options: Record<string, unknown>) => MultiSelectInstance = Enquirer.MultiSelect;

  /**
   * 扩展 MultiSelect，覆写 space() 方法实现全选 toggle
   * 当焦点在「全选」选项上按空格时，切换所有分支选项的选中状态
   */
  class MultiSelectWithSelectAll extends MultiSelect {
    space(this: MultiSelectInstance) {
      if (!this.focused) return;

      if (this.focused.name === SELECT_ALL_NAME) {
        // 切换全选：如果全选项当前未选中则全选，否则全不选
        const willEnable = !this.focused.enabled;
        for (const ch of this.choices) {
          ch.enabled = willEnable;
        }
        return this.render();
      }

      // 非全选选项：执行默认的 toggle 行为
      this.toggle(this.focused);

      // 同步全选选项状态：所有分支选项都选中时自动勾选全选，否则取消
      const selectAllChoice = this.choices.find((ch) => ch.name === SELECT_ALL_NAME);
      const branchItems = this.choices.filter((ch) => ch.name !== SELECT_ALL_NAME);
      if (selectAllChoice) {
        selectAllChoice.enabled = branchItems.every((ch) => ch.enabled);
      }

      return this.render();
    }
  }

  const selectedBranches: string[] = await new MultiSelectWithSelectAll({
    message,
    choices,
    // 使用空心圆/实心圆作为选中指示符
    symbols: {
      indicator: { on: '●', off: '○' },
    },
  }).run();

  // 过滤掉全选选项，只返回实际的 worktree
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

/** enquirer MultiSelect 分隔线条目结构 */
interface MultiSelectSeparator {
  role: 'separator';
  message: string;
}

/** enquirer MultiSelect choices 数组的条目类型 */
type GroupedChoice = { name: string; message: string } | MultiSelectSeparator;

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

/**
 * 通过交互式多选列表（按日期分组）让用户选择多个分支
 * 提供三级联动：全局全选、组级全选、单个分支
 * @param {WorktreeInfo[]} worktrees - 可供选择的 worktree 列表
 * @param {string} message - 选择提示信息
 * @returns {Promise<WorktreeInfo[]>} 用户选择的 worktree 列表
 */
export async function promptGroupedMultiSelectBranches(
  worktrees: WorktreeInfo[],
  message: string,
): Promise<WorktreeInfo[]> {
  const groups = groupWorktreesByDate(worktrees);
  const choices = buildGroupedChoices(groups);
  const groupMembershipMap = buildGroupMembershipMap(groups);

  // 收集所有组全选的 name，用于判断某个 choice 是否为组全选项
  const groupSelectAllNames = new Set(groupMembershipMap.keys());

  // 收集所有实际分支的 name
  const allBranchNames = new Set(worktrees.map((wt) => wt.branch));

  // @ts-expect-error enquirer 类型声明未导出 MultiSelect 类，但运行时存在
  const MultiSelect: new (options: Record<string, unknown>) => MultiSelectInstance = Enquirer.MultiSelect;

  /**
   * 扩展 MultiSelect，实现三级联动的 space() 覆写
   * - 全局全选：切换所有 choices（含组全选）
   * - 组级全选：切换该组内所有分支，同步全局全选状态
   * - 普通分支：toggle 该分支，同步所属组全选和全局全选状态
   */
  class MultiSelectWithGroupSelectAll extends MultiSelect {
    space(this: MultiSelectInstance) {
      if (!this.focused) return;

      const focusedName = this.focused.name;

      if (focusedName === SELECT_ALL_NAME) {
        // 全局全选：切换所有 choices
        const willEnable = !this.focused.enabled;
        for (const ch of this.choices) {
          ch.enabled = willEnable;
        }
        return this.render();
      }

      if (groupSelectAllNames.has(focusedName)) {
        // 组级全选：切换该组内所有分支
        const willEnable = !this.focused.enabled;
        const memberNames = groupMembershipMap.get(focusedName)!;
        // 切换组全选自身
        this.focused.enabled = willEnable;
        // 切换该组的所有分支
        for (const ch of this.choices) {
          if (memberNames.includes(ch.name)) {
            ch.enabled = willEnable;
          }
        }
        // 同步全局全选状态：检查所有实际分支是否全选
        syncGlobalSelectAll(this.choices);
        return this.render();
      }

      // 普通分支：toggle 该分支
      this.toggle(this.focused);

      // 同步所属组全选状态
      syncGroupSelectAll(this.choices, focusedName);
      // 同步全局全选状态
      syncGlobalSelectAll(this.choices);

      return this.render();
    }
  }

  /**
   * 同步全局全选状态
   * 根据所有实际分支的选中状态更新全局全选项
   * @param {MultiSelectChoice[]} choiceList - choices 列表
   */
  function syncGlobalSelectAll(choiceList: MultiSelectChoice[]): void {
    const selectAllChoice = choiceList.find((ch) => ch.name === SELECT_ALL_NAME);
    if (!selectAllChoice) return;

    const branchItems = choiceList.filter((ch) => allBranchNames.has(ch.name));
    selectAllChoice.enabled = branchItems.length > 0 && branchItems.every((ch) => ch.enabled);
  }

  /**
   * 同步指定分支所属组的全选状态
   * 根据该组内所有分支的选中状态更新组全选项
   * @param {MultiSelectChoice[]} choiceList - choices 列表
   * @param {string} branchName - 刚被 toggle 的分支名
   */
  function syncGroupSelectAll(choiceList: MultiSelectChoice[], branchName: string): void {
    for (const [groupName, memberNames] of groupMembershipMap) {
      if (!memberNames.includes(branchName)) continue;

      const groupChoice = choiceList.find((ch) => ch.name === groupName);
      if (!groupChoice) continue;

      const memberChoices = choiceList.filter((ch) => memberNames.includes(ch.name));
      groupChoice.enabled = memberChoices.length > 0 && memberChoices.every((ch) => ch.enabled);
      break;
    }
  }

  const selectedBranches: string[] = await new MultiSelectWithGroupSelectAll({
    message,
    choices,
    // 使用空心圆/实心圆作为选中指示符
    symbols: {
      indicator: { on: '●', off: '○' },
    },
  }).run();

  // 过滤掉全选项和组全选项，只返回实际选中的 worktree
  return worktrees.filter((wt) => selectedBranches.includes(wt.branch));
}
