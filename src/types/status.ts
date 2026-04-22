/** 单个 worktree 的详细状态信息 */
export interface WorktreeDetailedStatus {
  /** worktree 路径 */
  path: string;
  /** 分支名 */
  branch: string;
  /** 变更状态: committed(有已提交内容) / uncommitted(有未提交修改) / conflict(存在合并冲突) / clean(无变更) */
  changeStatus: 'committed' | 'uncommitted' | 'conflict' | 'clean';
  /** 相对于主分支的新增提交数（领先） */
  commitsAhead: number;
  /** 落后于主分支的提交数 */
  commitsBehind: number;
  /** 上次 validate 验证时间（ISO 8601 时间字符串），无快照时为 null */
  snapshotTime: string | null;
  /** 工作区和暂存区的新增行数 */
  insertions: number;
  /** 工作区和暂存区的删除行数 */
  deletions: number;
  /** 分支创建时间（首次分叉提交的 ISO 8601 时间字符串），无分叉提交时为 null */
  createdAt: string | null;
}

/** 主 worktree 状态信息 */
export interface MainWorktreeStatus {
  /** 当前分支名 */
  branch: string;
  /** 工作区是否干净 */
  isClean: boolean;
  /** 项目名 */
  projectName: string;
  /** 配置的主工作分支名（项目未初始化时为 null） */
  configuredMainBranch: string | null;
  /** 配置的主工作分支是否存在（项目未初始化时为 null） */
  configuredBranchExists: boolean | null;
  /** 工作区和暂存区的新增行数 */
  insertions: number;
  /** 工作区和暂存区的删除行数 */
  deletions: number;
}

/** validate 快照信息 */
export interface SnapshotInfo {
  /** 分支名 */
  branch: string;
  /** 是否对应的 worktree 仍然存在 */
  worktreeExists: boolean;
}

/** validate 快照摘要信息 */
export interface SnapshotSummary {
  /** 快照总数 */
  total: number;
  /** 孤立快照数（对应 worktree 已不存在） */
  orphaned: number;
}

/** status 命令的完整输出结构 */
export interface StatusResult {
  /** 主 worktree 状态 */
  main: MainWorktreeStatus;
  /** 各 worktree 的详细状态 */
  worktrees: WorktreeDetailedStatus[];
  /** validate 快照摘要 */
  snapshots: SnapshotSummary;
  /** worktree 总数 */
  totalWorktrees: number;
}
