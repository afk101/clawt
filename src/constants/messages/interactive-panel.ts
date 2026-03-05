import chalk from 'chalk';
import { PANEL_SHORTCUT_KEYS } from '../interactive-panel.js';

/** 快捷键标签映射（键名 → 中文标签） */
const SHORTCUT_LABELS: Record<keyof typeof PANEL_SHORTCUT_KEYS, string> = {
  VALIDATE: '验证',
  MERGE: '合并',
  DELETE: '删除',
  RESUME: '恢复',
  SYNC: '同步',
  COVER: '覆盖',
  REFRESH: '刷新',
  QUIT: '退出',
};

/** 底栏快捷键提示文本（从 PANEL_SHORTCUT_KEYS 自动生成） */
export const PANEL_FOOTER_SHORTCUTS = Object.entries(SHORTCUT_LABELS)
  .map(([key, label]) => `[${chalk.cyan(PANEL_SHORTCUT_KEYS[key as keyof typeof PANEL_SHORTCUT_KEYS])}]${label}`)
  .join('  ');

/**
 * 底栏倒计时文本
 * @param {number} seconds - 剩余秒数
 * @returns {string} 格式化的倒计时文本
 */
export const PANEL_FOOTER_COUNTDOWN = (seconds: number): string => chalk.gray(`(${seconds}s 后刷新)`);

/** 向下溢出提示 */
export const PANEL_OVERFLOW_DOWN_HINT = chalk.gray('↓ 更多 worktree...');

/** 向上溢出提示 */
export const PANEL_OVERFLOW_UP_HINT = chalk.gray('↑ 更多 worktree...');

/**
 * 快照摘要文本
 * @param {number} total - 快照总数
 * @param {number} orphaned - 孤立快照数
 * @returns {string} 格式化的快照摘要
 */
export const PANEL_SNAPSHOT_SUMMARY = (total: number, orphaned: number): string => {
  const base = `快照: ${total} 个`;
  if (orphaned > 0) {
    return `${base}（${chalk.yellow(`${orphaned} 个孤立`)}）`;
  }
  return base;
};

/** 无 worktree 提示 */
export const PANEL_NO_WORKTREES = '(无活跃 worktree)';

/** 操作后返回提示 */
export const PANEL_PRESS_ENTER_TO_RETURN = chalk.gray('\n按 Enter 返回面板...');

/** 非 TTY 降级提示 */
export const PANEL_NOT_TTY = '交互式面板需要 TTY 终端环境，请直接在终端中运行 clawt status -i';

/**
 * 面板标题
 * @param {string} projectName - 项目名
 * @returns {string} 格式化的标题
 */
export const PANEL_TITLE = (projectName: string): string => chalk.bold.cyan(`项目状态总览: ${projectName}`);

/**
 * 面板配置分支信息（正常）
 * @param {string} branchName - 分支名
 * @returns {string} 格式化的分支信息
 */
export const PANEL_CONFIGURED_BRANCH = (branchName: string): string =>
  chalk.gray(`主工作分支: ${branchName}`);

/**
 * 面板配置分支信息（分支已删除）
 * @param {string} branchName - 分支名
 * @returns {string} 格式化的分支信息
 */
export const PANEL_CONFIGURED_BRANCH_DELETED = (branchName: string): string =>
  chalk.red(`✗ 主工作分支: ${branchName}（已不存在）`);

/**
 * 面板配置分支信息（分支不一致）
 * @param {string} branchName - 分支名
 * @returns {string} 格式化的分支信息
 */
export const PANEL_CONFIGURED_BRANCH_MISMATCH = (branchName: string): string =>
  chalk.yellow(`⚠ 主工作分支: ${branchName}（不一致）`);

/** 面板配置分支信息（未初始化） */
export const PANEL_NOT_INITIALIZED = chalk.gray('未初始化（执行 clawt init 设置主工作分支）');
