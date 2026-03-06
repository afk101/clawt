/** tasks 命令相关提示消息 */
export const TASKS_CMD_MESSAGES = {
  /** 任务模板文件已存在 */
  TASK_INIT_FILE_EXISTS: (path: string) => `文件已存在: ${path}，如需覆盖请先删除`,
  /** 任务模板生成成功 */
  TASK_INIT_SUCCESS: (path: string) => `✓ 任务模板已生成: ${path}`,
  /** 任务模板使用提示 */
  TASK_INIT_HINT: (path: string) => `使用 clawt run -f ${path} 执行任务`,
} as const;
