import type { StatusResult } from '../types/index.js';
import { buildDisplayOrder, calculateVisibleRows, buildGroupedWorktreeLines } from './interactive-panel-render.js';
import type { PanelLine } from './interactive-panel-render.js';

/**
 * 面板状态管理器
 * 负责维护面板的数据状态、滚动偏移和选中项
 * 缓存 panelLines 和 displayOrder 避免重复计算 groupWorktreesByDate
 */
export class PanelStateManager {
  /** 当前状态数据 */
  private statusResult: StatusResult | null = null;
  /** 当前选中的显示位置索引（对应 displayOrder 数组的下标） */
  private selectedDisplayIndex: number = 0;
  /** 显示顺序到原始索引的映射（按日期分组后的排列顺序） */
  private displayOrder: number[] = [];
  /** 滚动偏移（基于行数） */
  private scrollOffset: number = 0;
  /** 缓存的面板行列表，在 updateData 和导航时更新 */
  private cachedPanelLines: PanelLine[] = [];

  /**
   * 更新状态数据
   * 一次性计算 displayOrder 和 cachedPanelLines，后续 adjustScrollForSelection 和 render 复用缓存
   * @param {StatusResult} newStatus - 新的状态数据
   * @param {string} [previousBranch] - 刷新前选中的分支名
   */
  updateData(newStatus: StatusResult, previousBranch?: string): void {
    this.statusResult = newStatus;
    this.displayOrder = buildDisplayOrder(this.statusResult.worktrees);

    if (previousBranch && this.displayOrder.length > 0) {
      const newDisplayIndex = this.displayOrder.findIndex(
        (origIdx) => this.statusResult!.worktrees[origIdx]?.branch === previousBranch,
      );
      if (newDisplayIndex >= 0) {
        this.selectedDisplayIndex = newDisplayIndex;
      } else {
        this.selectedDisplayIndex = Math.min(this.selectedDisplayIndex, Math.max(0, this.displayOrder.length - 1));
      }
    } else {
      this.selectedDisplayIndex = 0;
    }

    // 一次性构建缓存的 panelLines
    this.rebuildCachedPanelLines();
  }

  /** 获取当前状态数据 */
  getStatusResult(): StatusResult | null {
    return this.statusResult;
  }

  /** 获取当前选中的原始索引 */
  getSelectedOriginalIndex(): number {
    return this.displayOrder[this.selectedDisplayIndex] ?? -1;
  }

  /** 获取当前滚动偏移 */
  getScrollOffset(): number {
    return this.scrollOffset;
  }

  /**
   * 获取缓存的面板行列表
   * @returns {PanelLine[]} 缓存的面板行列表
   */
  getCachedPanelLines(): PanelLine[] {
    return this.cachedPanelLines;
  }

  /**
   * 向上导航
   * @returns {boolean} 是否发生变化
   */
  navigateUp(): boolean {
    if (!this.statusResult || this.displayOrder.length === 0) return false;

    if (this.selectedDisplayIndex > 0) {
      this.selectedDisplayIndex--;
      // 导航后重建缓存（选中标记变化）
      this.rebuildCachedPanelLines();
      this.adjustScrollForSelection();
      return true;
    }
    return false;
  }

  /**
   * 向下导航
   * @returns {boolean} 是否发生变化
   */
  navigateDown(): boolean {
    if (!this.statusResult || this.displayOrder.length === 0) return false;

    if (this.selectedDisplayIndex < this.displayOrder.length - 1) {
      this.selectedDisplayIndex++;
      // 导航后重建缓存（选中标记变化）
      this.rebuildCachedPanelLines();
      this.adjustScrollForSelection();
      return true;
    }
    return false;
  }

  /**
   * 获取当前选中的分支名
   * @returns {string | null} 分支名
   */
  getSelectedBranch(): string | null {
    const originalIndex = this.getSelectedOriginalIndex();
    if (originalIndex === -1 || !this.statusResult) return null;
    return this.statusResult.worktrees[originalIndex]?.branch || null;
  }

  /**
   * 调整滚动位置以确保选中项在可见区域内
   * 复用 cachedPanelLines，不再重新调用 buildGroupedWorktreeLines
   */
  adjustScrollForSelection(): void {
    if (!this.statusResult || this.displayOrder.length === 0) return;

    const originalIndex = this.getSelectedOriginalIndex();
    const rows = process.stdout.rows || 24;
    const visibleRows = calculateVisibleRows(rows);
    const panelLines = this.cachedPanelLines;

    // 找到选中 worktree 对应的第一行和最后一行
    let firstLine = -1;
    let lastLine = -1;
    for (let i = 0; i < panelLines.length; i++) {
      if (panelLines[i].worktreeIndex === originalIndex) {
        if (firstLine === -1) firstLine = i;
        lastLine = i;
      }
    }

    if (firstLine === -1) return;

    // 向前查找该 worktree 所属日期分组的分隔线行
    let groupStart = firstLine;
    while (groupStart > 0 && panelLines[groupStart - 1].type === 'separator') {
      groupStart--;
    }

    if (groupStart < this.scrollOffset) {
      this.scrollOffset = groupStart;
    }

    if (lastLine >= this.scrollOffset + visibleRows) {
      this.scrollOffset = lastLine - visibleRows + 1;
    }

    if (this.scrollOffset > groupStart) {
      this.scrollOffset = groupStart;
    }
  }

  /**
   * 重建缓存的 panelLines
   * 在数据更新或导航变化时调用
   */
  private rebuildCachedPanelLines(): void {
    if (!this.statusResult) {
      this.cachedPanelLines = [];
      return;
    }
    const originalIndex = this.getSelectedOriginalIndex();
    this.cachedPanelLines = buildGroupedWorktreeLines(this.statusResult.worktrees, originalIndex);
  }
}
