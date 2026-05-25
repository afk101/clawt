import chalk from 'chalk';
import stringWidth from 'string-width';
import {
  MESSAGES,
  SELECTED_INDICATOR,
  UNSELECTED_INDICATOR,
  PANEL_DATE_SEPARATOR_PREFIX,
  PANEL_FIXED_ROWS,
  PANEL_SEPARATOR_MAX_WIDTH,
  PANEL_DATE_COLOR,
  UNKNOWN_DATE_GROUP,
  VALIDATE_BRANCH_PREFIX,
} from '../constants/index.js';
import { getCurrentLanguage } from './i18n.js';
import {
  PANEL_FOOTER_SHORTCUTS,
  PANEL_FOOTER_COUNTDOWN,
  PANEL_OVERFLOW_DOWN_HINT,
  PANEL_OVERFLOW_UP_HINT,
  PANEL_SNAPSHOT_SUMMARY,
  PANEL_NO_WORKTREES_MSG,
  PANEL_TITLE,
  PANEL_CONFIGURED_BRANCH,
  PANEL_CONFIGURED_BRANCH_DELETED,
  PANEL_CONFIGURED_BRANCH_MISMATCH,
  PANEL_NOT_INITIALIZED,
  PANEL_UNKNOWN_DATE,
  PANEL_SYNCED_WITH_MAIN,
  PANEL_COMMITS_AHEAD,
  PANEL_COMMITS_BEHIND,
} from '../constants/messages/index.js';
import type { StatusResult, WorktreeDetailedStatus, MainWorktreeStatus } from '../types/index.js';
import { formatRelativeTime, groupWorktreesByDate, formatRelativeDate } from './index.js';

/** 面板行类型 */
export interface PanelLine {
  /** 行类型：separator（日期分隔线）或 worktree-content（worktree 内容行） */
  type: 'separator' | 'worktree-content';
  /** 行文本内容 */
  text: string;
  /** worktree 在原列表中的索引（仅 worktree-content 行有值，用于滚动定位） */
  worktreeIndex?: number;
}

/**
 * 构建带可选溢出提示的分隔线
 * 提示文本居中嵌入分隔线中间，不额外占用行数
 * @param {number} cols - 终端列数
 * @param {string} hint - 溢出提示文本（为空则输出纯分隔线）
 * @returns {string} 格式化的分隔线
 */
function buildSeparatorWithHint(cols: number, hint: string): string {
  const maxWidth = Math.min(cols, PANEL_SEPARATOR_MAX_WIDTH);
  if (!hint) {
    return chalk.gray('─'.repeat(maxWidth));
  }
  const hintWidth = stringWidth(hint);
  // 左右各留一个空格包裹提示文本，剩余宽度平分给两侧分隔线
  const remaining = Math.max(maxWidth - 2 - hintWidth, 0);
  const leftLen = Math.floor(remaining / 2);
  const rightLen = remaining - leftLen;
  return `${chalk.gray('─'.repeat(leftLen))} ${hint} ${chalk.gray('─'.repeat(rightLen))}`;
}

/**
 * 构建完整的面板帧内容
 * @param {StatusResult} statusResult - 状态数据
 * @param {number} selectedIndex - 当前选中的 worktree 索引
 * @param {number} scrollOffset - 滚动偏移（基于行数）
 * @param {number} rows - 终端行数
 * @param {number} cols - 终端列数
 * @param {number} countdown - 刷新倒计时秒数
 * @param {PanelLine[]} [cachedPanelLines] - 缓存的面板行列表（传入时复用，不传则重新构建）
 * @returns {string[]} 帧内容行数组
 */
export function buildPanelFrame(
  statusResult: StatusResult,
  selectedIndex: number,
  scrollOffset: number,
  rows: number,
  cols: number,
  countdown: number,
  cachedPanelLines?: PanelLine[],
): string[] {
  const lines: string[] = [];

  // 标题行
  lines.push(PANEL_TITLE(statusResult.main.projectName));

  // 配置分支信息行
  lines.push(renderConfiguredBranchLine(statusResult.main));

  // 主工作分支 diff 信息行
  lines.push(renderMainBranchDiff(statusResult.main));

  // 计算可用的 worktree 显示区域行数
  const visibleRows = calculateVisibleRows(rows);

  if (statusResult.worktrees.length === 0) {
    // 顶部分隔线（无溢出提示）
    lines.push(buildSeparatorWithHint(cols, ''));
    lines.push(PANEL_NO_WORKTREES_MSG);
    // 底部分隔线（无溢出提示）
    lines.push(buildSeparatorWithHint(cols, ''));
  } else {
    // 构建分组的 worktree 行列表（优先使用缓存）
    const panelLines = cachedPanelLines ?? buildGroupedWorktreeLines(statusResult.worktrees, selectedIndex);

    // 判断溢出状态
    const hasOverflowUp = scrollOffset > 0;
    const hasOverflowDown = scrollOffset + visibleRows < panelLines.length;

    // 顶部分隔线（带可选的上溢出提示）
    lines.push(buildSeparatorWithHint(cols, hasOverflowUp ? PANEL_OVERFLOW_UP_HINT : ''));

    // 根据滚动偏移截取可见区域
    const visibleLines = panelLines.slice(scrollOffset, scrollOffset + visibleRows);
    for (const pl of visibleLines) {
      lines.push(pl.text);
    }

    // 底部分隔线（带可选的下溢出提示）
    lines.push(buildSeparatorWithHint(cols, hasOverflowDown ? PANEL_OVERFLOW_DOWN_HINT : ''));
  }

  // 底栏
  lines.push(renderFooter(countdown));

  return lines;
}

/**
 * 构建按日期分组后的显示顺序索引列表
 * 用于将"显示中第 N 个 worktree"映射到原始 worktrees 数组中的索引
 * @param {WorktreeDetailedStatus[]} worktrees - worktree 详细状态列表
 * @returns {number[]} 按显示顺序排列的原始索引数组
 */
export function buildDisplayOrder(worktrees: WorktreeDetailedStatus[]): number[] {
  const worktreeInfos = worktrees.map((wt) => ({ path: wt.path, branch: wt.branch }));
  const groups = groupWorktreesByDate(worktreeInfos);

  // 构建分支名到原始索引的映射
  const branchIndexMap = new Map<string, number>();
  for (let i = 0; i < worktrees.length; i++) {
    branchIndexMap.set(worktrees[i].branch, i);
  }

  const displayOrder: number[] = [];
  for (const [, groupWorktrees] of groups) {
    for (const gwt of groupWorktrees) {
      displayOrder.push(branchIndexMap.get(gwt.branch)!);
    }
  }
  return displayOrder;
}

/**
 * 按日期分组构建 worktree 行列表
 * @param {WorktreeDetailedStatus[]} worktrees - worktree 详细状态列表
 * @param {number} selectedIndex - 当前选中的 worktree 原始索引
 * @returns {PanelLine[]} 扁平的面板行列表
 */
export function buildGroupedWorktreeLines(worktrees: WorktreeDetailedStatus[], selectedIndex: number): PanelLine[] {
  const panelLines: PanelLine[] = [];

  // 构建临时 WorktreeInfo 兼容结构用于分组（groupWorktreesByDate 需要 path 字段）
  const worktreeInfos = worktrees.map((wt) => ({ path: wt.path, branch: wt.branch }));
  const groups = groupWorktreesByDate(worktreeInfos);

  // 构建分支名到原始索引的映射
  const branchIndexMap = new Map<string, number>();
  for (let i = 0; i < worktrees.length; i++) {
    branchIndexMap.set(worktrees[i].branch, i);
  }

  for (const [dateKey, groupWorktrees] of groups) {
    // 日期分隔线
    panelLines.push({
      type: 'separator',
      text: renderDateSeparator(dateKey),
    });

    // 日期分隔线下方空行
    panelLines.push({
      type: 'separator',
      text: '',
    });

    // 该组内的每个 worktree
    for (const gwt of groupWorktrees) {
      const wtIndex = branchIndexMap.get(gwt.branch)!;
      const wt = worktrees[wtIndex];
      const isSelected = wtIndex === selectedIndex;
      const blockLines = renderWorktreeBlock(wt, isSelected);

      for (const line of blockLines) {
        panelLines.push({
          type: 'worktree-content',
          text: line,
          worktreeIndex: wtIndex,
        });
      }
    }
  }

  return panelLines;
}

/**
 * 渲染日期分隔线
 * 左侧预留空格与箭头指示器对齐，日期部分橙色高亮
 * @param {string} dateKey - 日期字符串（YYYY-MM-DD 或 UNKNOWN_DATE_GROUP）
 * @returns {string} 格式化的日期分隔线
 */
export function renderDateSeparator(dateKey: string): string {
  // 左侧空格与指示器 '▶ ' 等宽对齐
  const leftPad = '  ';
  if (dateKey === UNKNOWN_DATE_GROUP) {
    return `${leftPad}${chalk.gray(PANEL_DATE_SEPARATOR_PREFIX)} ${chalk.bold.hex(PANEL_DATE_COLOR)(PANEL_UNKNOWN_DATE)} ${chalk.gray(PANEL_DATE_SEPARATOR_PREFIX)}`;
  }
  const relativeDate = formatRelativeDate(dateKey);
  const relativeDateText = getCurrentLanguage() === 'en' ? `(${relativeDate})` : `（${relativeDate}）`;
  return `${leftPad}${chalk.gray(PANEL_DATE_SEPARATOR_PREFIX)} ${chalk.bold.hex(PANEL_DATE_COLOR)(dateKey)}${chalk.hex(PANEL_DATE_COLOR)(relativeDateText)} ${chalk.gray(PANEL_DATE_SEPARATOR_PREFIX)}`;
}

/**
 * 渲染单个 worktree 的多行块
 * 与 printWorktreeItem 逻辑一致，但返回字符串数组而非直接打印
 * @param {WorktreeDetailedStatus} wt - worktree 详细状态
 * @param {boolean} isSelected - 是否为选中项
 * @returns {string[]} 渲染后的行数组
 */
export function renderWorktreeBlock(wt: WorktreeDetailedStatus, isSelected: boolean): string[] {
  const lines: string[] = [];
  const indicator = isSelected ? chalk.cyan(SELECTED_INDICATOR) : UNSELECTED_INDICATOR;
  const branchStyle = isSelected ? chalk.bold.cyan : chalk.bold;

  // 分支名 + 变更状态标签
  const statusLabel = formatChangeStatusLabel(wt.changeStatus);
  lines.push(`${indicator} ${branchStyle(wt.branch)}   [${statusLabel}]`);

  // 缩进前缀（与指示器对齐）
  const indent = '    ';

  // 变更行数
  if (wt.insertions > 0 || wt.deletions > 0) {
    lines.push(`${indent}${chalk.green(`+${wt.insertions}`)} ${chalk.red(`-${wt.deletions}`)}`);
  }

  // 本地提交数
  if (wt.commitsAhead > 0) {
    lines.push(`${indent}${chalk.yellow(PANEL_COMMITS_AHEAD(wt.commitsAhead))}`);
  }

  // 与主分支的同步状态
  if (wt.commitsBehind > 0) {
    lines.push(`${indent}${chalk.yellow(PANEL_COMMITS_BEHIND(wt.commitsBehind))}`);
  } else {
    lines.push(`${indent}${chalk.green(PANEL_SYNCED_WITH_MAIN)}`);
  }

  // 分支创建时间
  if (wt.createdAt) {
    const relativeTime = formatRelativeTime(wt.createdAt);
    if (relativeTime) {
      lines.push(`${indent}${chalk.gray(MESSAGES.STATUS_CREATED_AT(relativeTime))}`);
    }
  }

  // 验证状态
  if (wt.snapshotTime) {
    const relativeTime = formatRelativeTime(wt.snapshotTime);
    if (relativeTime) {
      lines.push(`${indent}${chalk.green(MESSAGES.STATUS_LAST_VALIDATED(relativeTime))}`);
    }
  } else {
    lines.push(`${indent}${chalk.red(MESSAGES.STATUS_NOT_VALIDATED)}`);
  }

  // worktree 块之间的空行
  lines.push('');

  return lines;
}

/**
 * 将变更状态枚举格式化为带颜色的标签文本
 * @param {WorktreeDetailedStatus['changeStatus']} status - 变更状态
 * @returns {string} 格式化后的标签
 */
function formatChangeStatusLabel(status: WorktreeDetailedStatus['changeStatus']): string {
  switch (status) {
    case 'committed':
      return chalk.green(MESSAGES.STATUS_CHANGE_COMMITTED);
    case 'uncommitted':
      return chalk.yellow(MESSAGES.STATUS_CHANGE_UNCOMMITTED);
    case 'conflict':
      return chalk.red(MESSAGES.STATUS_CHANGE_CONFLICT);
    case 'clean':
      return chalk.gray(MESSAGES.STATUS_CHANGE_CLEAN);
  }
}

/**
 * 渲染配置的主工作分支信息行（面板模式）
 * @param {MainWorktreeStatus} main - 主 worktree 状态
 * @returns {string} 格式化的配置分支信息
 */
function renderConfiguredBranchLine(main: MainWorktreeStatus): string {
  if (main.configuredMainBranch === null) {
    return PANEL_NOT_INITIALIZED;
  }
  if (main.configuredBranchExists === false) {
    return PANEL_CONFIGURED_BRANCH_DELETED(main.configuredMainBranch);
  }
  if (main.branch !== main.configuredMainBranch && !main.branch.startsWith(VALIDATE_BRANCH_PREFIX)) {
    return PANEL_CONFIGURED_BRANCH_MISMATCH(main.configuredMainBranch);
  }
  return PANEL_CONFIGURED_BRANCH(main.configuredMainBranch);
}

/**
 * 渲染主工作分支的 diff 信息行
 * 格式：工作区: +N -M（绿色新增，红色删除）或 工作区: 无变更（绿色）
 * @param {MainWorktreeStatus} main - 主 worktree 状态
 * @returns {string} 格式化的 diff 信息
 */
function renderMainBranchDiff(main: MainWorktreeStatus): string {
  const workingDirLabel = getCurrentLanguage() === 'en' ? 'Working dir:' : '工作区:';
  if (main.insertions === 0 && main.deletions === 0) {
    return `${workingDirLabel} ${chalk.green(MESSAGES.STATUS_CHANGE_CLEAN)}`;
  }
  const insertText = chalk.green(`+${main.insertions}`);
  const deleteText = chalk.red(`-${main.deletions}`);
  return `${workingDirLabel} ${insertText} ${deleteText}`;
}

/**
 * 渲染快照摘要行
 * @param {number} total - 快照总数
 * @param {number} orphaned - 孤立快照数
 * @returns {string} 格式化的快照摘要文本
 */
export function renderSnapshotSummary(total: number, orphaned: number): string {
  return PANEL_SNAPSHOT_SUMMARY(total, orphaned);
}

/**
 * 渲染底栏（快捷键提示 + 倒计时）
 * @param {number} countdown - 刷新倒计时秒数
 * @returns {string} 底栏文本
 */
export function renderFooter(countdown: number): string {
  return `${PANEL_FOOTER_SHORTCUTS}  ${PANEL_FOOTER_COUNTDOWN(countdown)}`;
}

/**
 * 计算 worktree 滚动区域的总高度
 * 溢出提示已嵌入分隔线，不再占用滚动区域行数
 * @param {number} terminalRows - 终端总行数
 * @returns {number} 滚动区域总行数
 */
export function calculateVisibleRows(terminalRows: number): number {
  // 固定行：标题(1) + 配置分支信息 + 快照摘要 + 顶部分隔线 + 底部分隔线 + 底栏（后五项 = PANEL_FIXED_ROWS）
  const fixedRows = PANEL_FIXED_ROWS + 1;
  return Math.max(terminalRows - fixedRows, 3);
}
