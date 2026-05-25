import chalk from 'chalk';
import { getCurrentLanguage } from '../utils/i18n.js';

/** 多选列表中全选选项的标识名称 */
export const SELECT_ALL_NAME = '__select_all__';

/** 多选列表中全选选项的显示文本 */
export const SELECT_ALL_LABEL = '[select-all]';

/** 组级全选选项的 name 前缀 */
export const GROUP_SELECT_ALL_PREFIX = '__group_select_all_';

/**
 * 生成组级全选选项的显示文本
 * @param {string} dateLabel - 日期标签
 * @returns {string} 格式化的组全选显示文本
 */
export const GROUP_SELECT_ALL_LABEL = (dateLabel: string): string => `[select-all: ${dateLabel}]`;

/**
 * 生成日期分组分隔线的显示文本
 * 日期部分高亮显示，两侧使用 === 分隔线增强视觉区分
 * @param {string} dateLabel - 日期标签
 * @param {string} relativeTime - 相对时间描述
 * @returns {string} 格式化的分隔线文本
 */
export const GROUP_SEPARATOR_LABEL = (dateLabel: string, relativeTime: string): string => {
  const lang = getCurrentLanguage();
  const separator = lang === 'en' ? `════ ${chalk.bold.hex('#FF8C00')(dateLabel)} (${chalk.hex('#FF8C00')(relativeTime)}) ════` : `════ ${chalk.bold.hex('#FF8C00')(dateLabel)}（${chalk.hex('#FF8C00')(relativeTime)}） ════`;
  return separator;
};

/** 无法获取创建日期时的默认分组名称 */
export function getUnknownDateGroup(): string {
  return getCurrentLanguage() === 'en' ? 'Unknown date' : '未知日期';
}

/** 兼容旧代码：保留静态常量 */
export const UNKNOWN_DATE_GROUP = '未知日期';

/** 未知日期分组的分隔线显示文本 */
export function getUnknownDateSeparatorLabel(): string {
  const lang = getCurrentLanguage();
  const label = lang === 'en' ? 'Unknown date' : '未知日期';
  return `════ ${chalk.bold.hex('#FF8C00')(label)} ════`;
}

/** 兼容旧代码：保留静态常量 */
export const UNKNOWN_DATE_SEPARATOR_LABEL = `════ ${chalk.bold.hex('#FF8C00')('未知日期')} ════`;
