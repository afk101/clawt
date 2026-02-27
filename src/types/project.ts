/** 单个项目的概览信息 */
export interface ProjectOverview {
  /** 项目名称 */
  name: string;
  /** worktree 数量 */
  worktreeCount: number;
  /** 最近活跃时间（ISO 8601 格式），无 worktree 时为目录修改时间 */
  lastActiveTime: string;
  /** 磁盘占用（字节） */
  diskUsage: number;
}

/** 单个项目的 worktree 详情 */
export interface ProjectWorktreeDetail {
  /** 分支名 */
  branch: string;
  /** worktree 路径 */
  path: string;
  /** 最后修改时间（ISO 8601 格式） */
  lastModifiedTime: string;
  /** 磁盘占用（字节） */
  diskUsage: number;
}

/** projects 命令展示指定项目时的完整结果 */
export interface ProjectDetailResult {
  /** 项目名称 */
  name: string;
  /** 项目 worktree 根目录 */
  projectDir: string;
  /** worktree 详情列表（按最近活跃时间排序） */
  worktrees: ProjectWorktreeDetail[];
  /** 总磁盘占用（字节） */
  totalDiskUsage: number;
}

/** projects 命令展示所有项目概览时的完整结果 */
export interface ProjectsOverviewResult {
  /** 所有项目概览列表（按最近活跃时间排序） */
  projects: ProjectOverview[];
  /** 项目总数 */
  totalProjects: number;
  /** 总磁盘占用（字节） */
  totalDiskUsage: number;
}
