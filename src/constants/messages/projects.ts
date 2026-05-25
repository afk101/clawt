import { createMessages } from '../../utils/i18n.js';

/** projects 命令专属提示消息（双语映射） */
const PROJECTS_MESSAGES_I18N = {
  /** projects 命令全局概览标题 */
  PROJECTS_OVERVIEW_TITLE: {
    en: 'Project Overview',
    'zh-CN': '项目概览',
  },
  /** projects 命令指定项目详情标题 */
  PROJECTS_DETAIL_TITLE: {
    en: (projectName: string) => `Project Details: ${projectName}`,
    'zh-CN': (projectName: string) => `项目详情: ${projectName}`,
  },
  /** 无项目提示 */
  PROJECTS_NO_PROJECTS: {
    en: '(No projects, worktrees directory is empty)',
    'zh-CN': '(暂无项目，worktrees 目录为空)',
  },
  /** 项目不存在提示 */
  PROJECTS_NOT_FOUND: {
    en: (name: string) => `Project ${name} does not exist`,
    'zh-CN': (name: string) => `项目 ${name} 不存在`,
  },
  /** worktree 数量标签 */
  PROJECTS_WORKTREE_COUNT: {
    en: (count: number) => `${count} worktree(s)`,
    'zh-CN': (count: number) => `${count} 个 worktree`,
  },
  /** 最近活跃时间标签 */
  PROJECTS_LAST_ACTIVE: {
    en: (relativeTime: string) => `Last active: ${relativeTime}`,
    'zh-CN': (relativeTime: string) => `最近活跃: ${relativeTime}`,
  },
  /** 磁盘占用标签 */
  PROJECTS_DISK_USAGE: {
    en: (size: string) => `Disk usage: ${size}`,
    'zh-CN': (size: string) => `磁盘占用: ${size}`,
  },
  /** 总磁盘占用标签 */
  PROJECTS_TOTAL_DISK_USAGE: {
    en: (size: string) => `Total: ${size}`,
    'zh-CN': (size: string) => `总占用: ${size}`,
  },
  /** projects 详情无 worktree */
  PROJECTS_DETAIL_NO_WORKTREES: {
    en: '(No worktrees in this project)',
    'zh-CN': '(该项目下无 worktree)',
  },
  /** 路径标签 */
  PROJECTS_PATH: {
    en: (path: string) => `Path: ${path}`,
    'zh-CN': (path: string) => `路径: ${path}`,
  },
  /** 最后修改时间标签 */
  PROJECTS_LAST_MODIFIED: {
    en: (relativeTime: string) => `Last modified: ${relativeTime}`,
    'zh-CN': (relativeTime: string) => `最后修改: ${relativeTime}`,
  },
};

export const PROJECTS_MESSAGES = createMessages(PROJECTS_MESSAGES_I18N);
