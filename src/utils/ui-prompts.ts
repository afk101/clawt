import Enquirer from 'enquirer';
import {
  SELECT_ALL_NAME,
  SELECT_ALL_LABEL,
} from '../constants/index.js';
import type { WorktreeInfo } from '../types/index.js';
import { groupWorktreesByDate, buildGroupedChoices, buildGroupMembershipMap } from './worktree-matcher.js';
import { isNonInteractive } from './interactive.js';
import { ClawtError } from '../errors/index.js';

/** enquirer MultiSelect 选项条目的运行时结构 */
export interface MultiSelectChoice {
  name: string;
  message: string;
  enabled: boolean;
}

/**
 * enquirer MultiSelect 实例的运行时接口
 * enquirer 类型声明未导出 MultiSelect，手动声明以消除 TypeScript 类型错误
 */
export interface MultiSelectInstance {
  focused: MultiSelectChoice | undefined;
  choices: MultiSelectChoice[];
  render(): void;
  toggle(choice: MultiSelectChoice): void;
  run(): Promise<string[]>;
}

/** enquirer MultiSelect 分隔线条目结构 */
export interface MultiSelectSeparator {
  role: 'separator';
  message: string;
}

/** enquirer MultiSelect choices 数组的条目类型 */
export type GroupedChoice = { name: string; message: string } | MultiSelectSeparator;

/**
 * 通过交互式列表让用户从 worktree 列表中选择一个分支
 * @param {WorktreeInfo[]} worktrees - 可供选择的 worktree 列表
 * @param {string} message - 选择提示信息
 * @returns {Promise<WorktreeInfo>} 用户选择的 worktree
 */
export async function promptSelectBranch(worktrees: WorktreeInfo[], message: string): Promise<WorktreeInfo> {
  // 非交互模式下无法进行交互选择，要求用户通过 -b 精确指定
  if (isNonInteractive()) {
    throw new ClawtError('非交互模式下无法进行分支选择，请通过 -b 参数精确指定分支名');
  }
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
  // 非交互模式下无法进行交互多选，要求用户通过 -b 精确指定
  if (isNonInteractive()) {
    throw new ClawtError('非交互模式下无法进行分支多选，请通过 -b 参数精确指定分支名');
  }
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
  // 非交互模式下无法进行交互多选，要求用户通过 -b 精确指定
  if (isNonInteractive()) {
    throw new ClawtError('非交互模式下无法进行分支多选，请通过 -b 参数精确指定分支名');
  }
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
