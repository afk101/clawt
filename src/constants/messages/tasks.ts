/** tasks 命令相关提示消息 */
export const TASKS_CMD_MESSAGES = {
  /** 任务模板文件已存在 */
  TASK_INIT_FILE_EXISTS: (path: string) => `文件已存在: ${path}，如需覆盖请先删除`,
  /** 任务模板生成成功 */
  TASK_INIT_SUCCESS: (path: string) => `✓ 任务模板已生成: ${path}`,
  /** 任务模板使用提示（分行列出 run 和 resume 两种用法） */
  TASK_INIT_HINT: (path: string) =>
    `执行任务:\n  clawt run -f ${path}     # 创建 worktree 并执行（分支名需不存在）\n  clawt resume -f ${path}  # 在已有 worktree 中追问（分支名需已存在）`,
} as const;
