/** worktree 来源分支元数据 */
export interface WorktreeMetadata {
  /** worktree 分支名 */
  branch: string;
  /** 创建 worktree 时所在的真实当前分支 */
  baseBranch: string;
  /** 元数据创建时间 */
  createdAt: string;
}

/** worktree 信息 */
export interface WorktreeInfo {
  /** worktree 路径 */
  path: string;
  /** 分支名 */
  branch: string;
}

/** worktree 变更统计信息 */
export interface WorktreeStatus {
  /** 相对于主分支的新增提交数 */
  commitCount: number;
  /** 工作区和暂存区的新增行数 */
  insertions: number;
  /** 工作区和暂存区的删除行数 */
  deletions: number;
  /** 工作区是否有未提交修改 */
  hasDirtyFiles: boolean;
}
