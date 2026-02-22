/** 任务文件中单个任务条目 */
export interface TaskFileEntry {
  /** 分支名（使用 -b 模式时可选） */
  branch?: string;
  /** 任务描述 */
  task: string;
}

/** parseTaskFile 解析选项 */
export interface ParseTaskFileOptions {
  /** 是否要求每个任务块必须包含分支名，默认 true */
  branchRequired?: boolean;
}
