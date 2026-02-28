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
  /** 最大并发数（Commander 传入为字符串），0 表示不限制 */
  concurrency?: string;
  /** 任务文件路径（与 --tasks 互斥） */
  file?: string;
  /** 预览模式，仅展示任务计划不实际执行 */
  dryRun?: boolean;
}

/** validate 命令选项 */
export interface ValidateOptions {
  /** 要验证的分支名（可选，支持模糊匹配，不传则列出所有分支供选择） */
  branch?: string;
  /** 清理 validate 状态 */
  clean?: boolean;
  /** validate 成功后在主 worktree 中执行的命令 */
  run?: string;
}

/** merge 命令选项 */
export interface MergeOptions {
  /** 要合并的分支名（可选，支持模糊匹配，不传则列出所有分支供选择） */
  branch?: string;
  /** 提交信息（目标 worktree 工作区有修改时必填） */
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
  /** 要同步的分支名（可选，支持模糊匹配，不传则列出所有分支供选择） */
  branch?: string;
}

/** list 命令选项 */
export interface ListOptions {
  /** 以 JSON 格式输出 */
  json?: boolean;
}

/** status 命令选项 */
export interface StatusOptions {
  /** 以 JSON 格式输出 */
  json?: boolean;
}

/** projects 命令选项 */
export interface ProjectsOptions {
  /** 指定项目名（可选，不传则展示所有项目概览） */
  name?: string;
  /** 以 JSON 格式输出 */
  json?: boolean;
}

/** init 命令选项 */
export interface InitOptions {
  /** 指定主工作分支名（可选，默认使用当前分支） */
  branch?: string;
}
