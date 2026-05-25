import chalk from 'chalk';
import { PANEL_SHORTCUT_KEYS } from '../interactive-panel.js';
import { createMessages } from '../../utils/i18n.js';

/** 快捷键标签映射 - 英文版 */
const SHORTCUT_LABELS_EN: Record<keyof typeof PANEL_SHORTCUT_KEYS, string> = {
  VALIDATE: 'Validate',
  MERGE: 'Merge',
  DELETE: 'Delete',
  RESUME: 'Resume',
  SYNC: 'Sync',
  COVER: 'Cover',
  REFRESH: 'Refresh',
  QUIT: 'Quit',
};

/** 快捷键标签映射 - 中文版 */
const SHORTCUT_LABELS_ZH: Record<keyof typeof PANEL_SHORTCUT_KEYS, string> = {
  VALIDATE: '验证',
  MERGE: '合并',
  DELETE: '删除',
  RESUME: '恢复',
  SYNC: '同步',
  COVER: '覆盖',
  REFRESH: '刷新',
  QUIT: '退出',
};

/** 底栏快捷键提示文本（双语映射） */
const PANEL_FOOTER_SHORTCUTS_I18N = {
  PANEL_FOOTER_SHORTCUTS: {
    en: Object.entries(SHORTCUT_LABELS_EN)
      .map(([key, label]) => `[${chalk.cyan(PANEL_SHORTCUT_KEYS[key as keyof typeof PANEL_SHORTCUT_KEYS])}]${label}`)
      .join('  '),
    'zh-CN': Object.entries(SHORTCUT_LABELS_ZH)
      .map(([key, label]) => `[${chalk.cyan(PANEL_SHORTCUT_KEYS[key as keyof typeof PANEL_SHORTCUT_KEYS])}]${label}`)
      .join('  '),
  },
};

/** 底栏快捷键提示文本（从 PANEL_SHORTCUT_KEYS 自动生成） */
export const PANEL_FOOTER_SHORTCUTS = createMessages(PANEL_FOOTER_SHORTCUTS_I18N).PANEL_FOOTER_SHORTCUTS;

/** 底栏倒计时文本（双语映射） */
const PANEL_FOOTER_COUNTDOWN_I18N = {
  PANEL_FOOTER_COUNTDOWN: {
    en: (seconds: number): string => chalk.gray(`(refresh in ${seconds}s)`),
    'zh-CN': (seconds: number): string => chalk.gray(`(${seconds}s 后刷新)`),
  },
};

/**
 * 底栏倒计时文本
 * @param {number} seconds - 剩余秒数
 * @returns {string} 格式化的倒计时文本
 */
export const PANEL_FOOTER_COUNTDOWN = createMessages(PANEL_FOOTER_COUNTDOWN_I18N).PANEL_FOOTER_COUNTDOWN;

/** 向下溢出提示（双语映射） */
const PANEL_OVERFLOW_DOWN_HINT_I18N = {
  PANEL_OVERFLOW_DOWN_HINT: {
    en: chalk.gray('↓ more worktrees...'),
    'zh-CN': chalk.gray('↓ 更多 worktree...'),
  },
};

/** 向下溢出提示 */
export const PANEL_OVERFLOW_DOWN_HINT = createMessages(PANEL_OVERFLOW_DOWN_HINT_I18N).PANEL_OVERFLOW_DOWN_HINT;

/** 向上溢出提示（双语映射） */
const PANEL_OVERFLOW_UP_HINT_I18N = {
  PANEL_OVERFLOW_UP_HINT: {
    en: chalk.gray('↑ more worktrees...'),
    'zh-CN': chalk.gray('↑ 更多 worktree...'),
  },
};

/** 向上溢出提示 */
export const PANEL_OVERFLOW_UP_HINT = createMessages(PANEL_OVERFLOW_UP_HINT_I18N).PANEL_OVERFLOW_UP_HINT;

/** 快照摘要文本（双语映射） */
const PANEL_SNAPSHOT_SUMMARY_I18N = {
  PANEL_SNAPSHOT_SUMMARY: {
    en: (total: number, orphaned: number): string => {
      const base = `Snapshots: ${total}`;
      if (orphaned > 0) {
        return `${base} (${chalk.yellow(`${orphaned} orphaned`)})`;
      }
      return base;
    },
    'zh-CN': (total: number, orphaned: number): string => {
      const base = `快照: ${total} 个`;
      if (orphaned > 0) {
        return `${base}（${chalk.yellow(`${orphaned} 个孤立`)}）`;
      }
      return base;
    },
  },
};

/**
 * 快照摘要文本
 * @param {number} total - 快照总数
 * @param {number} orphaned - 孤立快照数
 * @returns {string} 格式化的快照摘要
 */
export const PANEL_SNAPSHOT_SUMMARY = createMessages(PANEL_SNAPSHOT_SUMMARY_I18N).PANEL_SNAPSHOT_SUMMARY;

/** 无 worktree 提示（双语映射） */
const PANEL_NO_WORKTREES_I18N = {
  PANEL_NO_WORKTREES: {
    en: '(No active worktrees)',
    'zh-CN': '(无活跃 worktree)',
  },
};

/** 无 worktree 提示 */
export const PANEL_NO_WORKTREES = createMessages(PANEL_NO_WORKTREES_I18N).PANEL_NO_WORKTREES;

/** 操作后返回提示（双语映射） */
const PANEL_PRESS_ENTER_TO_RETURN_I18N = {
  PANEL_PRESS_ENTER_TO_RETURN: {
    en: chalk.gray('\nPress Enter to return to panel...'),
    'zh-CN': chalk.gray('\n按 Enter 返回面板...'),
  },
};

/** 操作后返回提示 */
export const PANEL_PRESS_ENTER_TO_RETURN = createMessages(PANEL_PRESS_ENTER_TO_RETURN_I18N).PANEL_PRESS_ENTER_TO_RETURN;

/** 非 TTY 降级提示（双语映射） */
const PANEL_NOT_TTY_I18N = {
  PANEL_NOT_TTY: {
    en: 'Interactive panel requires a TTY terminal. Please run clawt status -i directly in a terminal',
    'zh-CN': '交互式面板需要 TTY 终端环境，请直接在终端中运行 clawt status -i',
  },
};

/** 非 TTY 降级提示 */
export const PANEL_NOT_TTY = createMessages(PANEL_NOT_TTY_I18N).PANEL_NOT_TTY;

/** 面板标题（双语映射） */
const PANEL_TITLE_I18N = {
  PANEL_TITLE: {
    en: (projectName: string): string => chalk.bold.cyan(`Project Status: ${projectName}`),
    'zh-CN': (projectName: string): string => chalk.bold.cyan(`项目状态总览: ${projectName}`),
  },
};

/**
 * 面板标题
 * @param {string} projectName - 项目名
 * @returns {string} 格式化的标题
 */
export const PANEL_TITLE = createMessages(PANEL_TITLE_I18N).PANEL_TITLE;

/** 面板配置分支信息（正常）（双语映射） */
const PANEL_CONFIGURED_BRANCH_I18N = {
  PANEL_CONFIGURED_BRANCH: {
    en: (branchName: string): string => chalk.gray(`Main work branch: ${branchName}`),
    'zh-CN': (branchName: string): string => chalk.gray(`主工作分支: ${branchName}`),
  },
};

/**
 * 面板配置分支信息（正常）
 * @param {string} branchName - 分支名
 * @returns {string} 格式化的分支信息
 */
export const PANEL_CONFIGURED_BRANCH = createMessages(PANEL_CONFIGURED_BRANCH_I18N).PANEL_CONFIGURED_BRANCH;

/** 面板配置分支信息（分支已删除）（双语映射） */
const PANEL_CONFIGURED_BRANCH_DELETED_I18N = {
  PANEL_CONFIGURED_BRANCH_DELETED: {
    en: (branchName: string): string => chalk.red(`✗ Main work branch: ${branchName} (deleted)`),
    'zh-CN': (branchName: string): string => chalk.red(`✗ 主工作分支: ${branchName}（已不存在）`),
  },
};

/**
 * 面板配置分支信息（分支已删除）
 * @param {string} branchName - 分支名
 * @returns {string} 格式化的分支信息
 */
export const PANEL_CONFIGURED_BRANCH_DELETED = createMessages(PANEL_CONFIGURED_BRANCH_DELETED_I18N).PANEL_CONFIGURED_BRANCH_DELETED;

/** 面板配置分支信息（分支不一致）（双语映射） */
const PANEL_CONFIGURED_BRANCH_MISMATCH_I18N = {
  PANEL_CONFIGURED_BRANCH_MISMATCH: {
    en: (branchName: string): string => chalk.red(`⚠ Main work branch: ${branchName} (mismatch)`),
    'zh-CN': (branchName: string): string => chalk.red(`⚠ 主工作分支: ${branchName}（不一致）`),
  },
};

/**
 * 面板配置分支信息（分支不一致）
 * @param {string} branchName - 分支名
 * @returns {string} 格式化的分支信息
 */
export const PANEL_CONFIGURED_BRANCH_MISMATCH = createMessages(PANEL_CONFIGURED_BRANCH_MISMATCH_I18N).PANEL_CONFIGURED_BRANCH_MISMATCH;

/** 面板配置分支信息（未初始化）（双语映射） */
const PANEL_NOT_INITIALIZED_I18N = {
  PANEL_NOT_INITIALIZED: {
    en: chalk.gray('Not initialized (run clawt init to set main work branch)'),
    'zh-CN': chalk.gray('未初始化（执行 clawt init 设置主工作分支）'),
  },
};

/** 面板配置分支信息（未初始化） */
export const PANEL_NOT_INITIALIZED = createMessages(PANEL_NOT_INITIALIZED_I18N).PANEL_NOT_INITIALIZED;

/** 交互面板日期分隔线：未知日期文案（双语映射） */
const PANEL_UNKNOWN_DATE_I18N = {
  PANEL_UNKNOWN_DATE: {
    en: 'Unknown date',
    'zh-CN': '未知日期',
  },
};

/** 交互面板日期分隔线：未知日期文案 */
export const PANEL_UNKNOWN_DATE = createMessages(PANEL_UNKNOWN_DATE_I18N).PANEL_UNKNOWN_DATE;

/** 交互面板：与主分支同步（双语映射） */
const PANEL_SYNCED_WITH_MAIN_I18N = {
  PANEL_SYNCED_WITH_MAIN: {
    en: 'Synced with main branch',
    'zh-CN': '与主分支同步',
  },
};

/** 交互面板：与主分支同步 */
export const PANEL_SYNCED_WITH_MAIN = createMessages(PANEL_SYNCED_WITH_MAIN_I18N).PANEL_SYNCED_WITH_MAIN;

/** 交互面板：本地提交数量提示（双语映射） */
const PANEL_COMMITS_AHEAD_I18N = {
  PANEL_COMMITS_AHEAD: {
    en: (count: number): string => `${count} local commit(s)`,
    'zh-CN': (count: number): string => `${count} 个本地提交`,
  },
};

/** 交互面板：本地提交数量提示 */
export const PANEL_COMMITS_AHEAD = createMessages(PANEL_COMMITS_AHEAD_I18N).PANEL_COMMITS_AHEAD;

/** 交互面板：落后主分支提交数量提示（双语映射） */
const PANEL_COMMITS_BEHIND_I18N = {
  PANEL_COMMITS_BEHIND: {
    en: (count: number): string => `${count} commit(s) behind main`,
    'zh-CN': (count: number): string => `落后主分支 ${count} 个提交`,
  },
};

/** 交互面板：落后主分支提交数量提示 */
export const PANEL_COMMITS_BEHIND = createMessages(PANEL_COMMITS_BEHIND_I18N).PANEL_COMMITS_BEHIND;
