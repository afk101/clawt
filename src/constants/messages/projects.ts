/** projects 命令专属提示消息 */
export const PROJECTS_MESSAGES = {
  /** projects 命令全局概览标题 */
  PROJECTS_OVERVIEW_TITLE: '项目概览',
  /** projects 命令指定项目详情标题 */
  PROJECTS_DETAIL_TITLE: (projectName: string) => `项目详情: ${projectName}`,
  /** 无项目提示 */
  PROJECTS_NO_PROJECTS: '(暂无项目，worktrees 目录为空)',
  /** 项目不存在提示 */
  PROJECTS_NOT_FOUND: (name: string) => `项目 ${name} 不存在`,
  /** worktree 数量标签 */
  PROJECTS_WORKTREE_COUNT: (count: number) => `${count} 个 worktree`,
  /** 最近活跃时间标签 */
  PROJECTS_LAST_ACTIVE: (relativeTime: string) => `最近活跃: ${relativeTime}`,
  /** 磁盘占用标签 */
  PROJECTS_DISK_USAGE: (size: string) => `磁盘占用: ${size}`,
  /** 总磁盘占用标签 */
  PROJECTS_TOTAL_DISK_USAGE: (size: string) => `总占用: ${size}`,
  /** projects 详情无 worktree */
  PROJECTS_DETAIL_NO_WORKTREES: '(该项目下无 worktree)',
  /** 路径标签 */
  PROJECTS_PATH: (path: string) => `路径: ${path}`,
  /** 最后修改时间标签 */
  PROJECTS_LAST_MODIFIED: (relativeTime: string) => `最后修改: ${relativeTime}`,
} as const;
