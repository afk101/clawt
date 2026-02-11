/** create 命令选项 */
export interface CreateOptions {
  /** 分支名 */
  branch: string;
  /** 创建数量，默认 1 */
  number: number;
}

/** run 命令选项 */
export interface RunOptions {
  /** 分支名 */
  branch: string;
  /** 任务列表（支持多次 --tasks 传入），不传则在 worktree 中打开 Claude Code 交互式界面 */
  tasks?: string[];
}

/** validate 命令选项 */
export interface ValidateOptions {
  /** 要验证的分支名 */
  branch: string;
}

/** merge 命令选项 */
export interface MergeOptions {
  /** 要合并的分支名 */
  branch: string;
  /** 提交信息（工作区有修改时必填） */
  message?: string;
}

/** remove 命令选项 */
export interface RemoveOptions {
  /** 移除所有 worktree */
  all?: boolean;
  /** 分支名 */
  branch?: string;
  /** 指定索引 */
  index?: number;
}
