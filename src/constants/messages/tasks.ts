import { createMessages } from '../../utils/i18n.js';

/** tasks 命令相关提示消息（双语映射） */
const TASKS_CMD_MESSAGES_I18N = {
  /** 任务模板文件已存在 */
  TASK_INIT_FILE_EXISTS: {
    en: (path: string) => `File already exists: ${path}, delete it first to overwrite`,
    'zh-CN': (path: string) => `文件已存在: ${path}，如需覆盖请先删除`,
  },
  /** 任务模板生成成功 */
  TASK_INIT_SUCCESS: {
    en: (path: string) => `✓ Task template generated: ${path}`,
    'zh-CN': (path: string) => `✓ 任务模板已生成: ${path}`,
  },
  /** 任务模板使用提示（分行列出 run 和 resume 两种用法） */
  TASK_INIT_HINT: {
    en: (path: string) =>
      `Run task:\n  clawt run -f ${path}     # Create worktree and execute (branch name must not exist)\n  clawt resume -f ${path}  # Resume in existing worktree (branch name must exist)`,
    'zh-CN': (path: string) =>
      `执行任务:\n  clawt run -f ${path}     # 创建 worktree 并执行（分支名需不存在）\n  clawt resume -f ${path}  # 在已有 worktree 中追问（分支名需已存在）`,
  },
};

export const TASKS_CMD_MESSAGES = createMessages(TASKS_CMD_MESSAGES_I18N);
