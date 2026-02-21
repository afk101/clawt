/** create 命令选项 */
export interface CreateOptions {
  /** 分支名 */
  branch: string;
  /** 创建数量（Commander 传入为字符串），默认 '1' */
  number: string;
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
  /** 要验证的分支名（可选，支持模糊匹配，不传则列出所有分支供选择） */
  branch?: string;
  /** 清理 validate 状态 */
  clean?: boolean;
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
}

/** resume 命令选项 */
export interface ResumeOptions {
  /** 要恢复的分支名（可选，不传则列出所有分支供选择） */
  branch?: string;
}

/** sync 命令选项 */
export interface SyncOptions {
  /** 要同步的分支名 */
  branch: string;
}

/** list 命令选项 */
export interface ListOptions {
  /** 以 JSON 格式输出 */
  json?: boolean;
}
