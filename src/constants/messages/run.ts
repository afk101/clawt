/** run 命令专属提示消息 */
export const RUN_MESSAGES = {
  /** 分支已存在时提示使用 resume */
  BRANCH_EXISTS_USE_RESUME: (name: string) =>
    `分支 ${name} 已存在，请使用 clawt resume -b ${name} 恢复会话`,
  /** 检测到用户中断 */
  INTERRUPTED: '检测到退出指令，已停止 Claude Code 任务',
  /** 中断后自动清理完成 */
  INTERRUPT_AUTO_CLEANED: (count: number) => `✓ 已自动清理 ${count} 个 worktree 和对应分支`,
  /** 中断后手动确认清理 */
  INTERRUPT_CONFIRM_CLEANUP: '是否移除刚刚创建的 worktree 和对应分支？',
  /** 中断后清理完成 */
  INTERRUPT_CLEANED: (count: number) => `✓ 已清理 ${count} 个 worktree 和对应分支`,
  /** 中断后保留 worktree */
  INTERRUPT_KEPT: '已保留 worktree，可稍后使用 clawt remove 手动清理',
  /** 非 TTY 环境降级输出：任务启动 */
  PROGRESS_TASK_STARTED: (index: number, total: number, branch: string, path: string) =>
    `[${index}/${total}] ${branch} 启动  ${path}`,
  /** 非 TTY 环境降级输出：任务完成 */
  PROGRESS_TASK_DONE: (index: number, total: number, branch: string, duration: string, cost: string, detail: string) =>
    `[${index}/${total}] ${branch} ✓ 完成 ${duration} ${cost}  ${detail}`,
  /** 非 TTY 环境降级输出：任务失败 */
  PROGRESS_TASK_FAILED: (index: number, total: number, branch: string, duration: string, detail: string) =>
    `[${index}/${total}] ${branch} ✗ 失败 ${duration}  ${detail}`,
  /** 并发限制提示 */
  CONCURRENCY_INFO: (concurrency: number, total: number) =>
    `并发限制: ${concurrency}，共 ${total} 个任务`,
  /** 并发数无效提示 */
  CONCURRENCY_INVALID: '并发数必须为正整数',
  /** 任务文件不存在 */
  TASK_FILE_NOT_FOUND: (path: string) => `任务文件不存在: ${path}`,
  /** 任务文件中没有解析到有效任务 */
  TASK_FILE_EMPTY: '任务文件中没有解析到有效任务',
  /** 任务文件中某个任务块缺少分支名 */
  TASK_FILE_MISSING_BRANCH: (blockIndex: number) => `任务文件第 ${blockIndex} 个任务块缺少分支名（# branch: ...）`,
  /** 任务文件中某个任务块缺少任务描述 */
  TASK_FILE_MISSING_TASK: (branch: string) => `任务文件中分支 ${branch} 缺少任务描述`,
  /** 任务文件中某个任务块缺少任务描述（无分支名时按索引定位） */
  TASK_FILE_MISSING_TASK_BY_INDEX: (blockIndex: number) => `任务文件第 ${blockIndex} 个任务块缺少任务描述`,
  /** --file 和 --tasks 不能同时使用 */
  FILE_AND_TASKS_CONFLICT: '--file 和 --tasks 不能同时使用',
  /** 任务文件加载成功 */
  TASK_FILE_LOADED: (count: number, path: string) => `✓ 从 ${path} 加载了 ${count} 个任务`,
  /** 未指定 -b 或 -f */
  BRANCH_OR_FILE_REQUIRED: '请指定 -b 分支名或 -f 任务文件',
  /** dry-run 预览标题 */
  DRY_RUN_TITLE: 'Dry Run 预览',
  /** dry-run 任务数量 */
  DRY_RUN_TASK_COUNT: (count: number) => `任务数: ${count}`,
  /** dry-run 并发数 */
  DRY_RUN_CONCURRENCY: (concurrency: number) => `并发数: ${concurrency === 0 ? '不限制' : concurrency}`,
  /** dry-run worktree 目录 */
  DRY_RUN_WORKTREE_DIR: (dir: string) => `Worktree: ${dir}`,
  /** dry-run 分支已存在警告 */
  DRY_RUN_BRANCH_EXISTS_WARNING: (name: string) => `分支 ${name} 已存在`,
  /** dry-run 交互式模式提示（无任务描述） */
  DRY_RUN_INTERACTIVE_MODE: '模式: 交互式（无预设任务）',
  /** dry-run 预览完成且无冲突 */
  DRY_RUN_READY: '预览完成，无冲突。移除 --dry-run 即可正式执行。',
  /** dry-run 存在分支冲突 */
  DRY_RUN_HAS_CONFLICT: '存在分支冲突，实际执行时将会报错。请先处理冲突的分支。',
} as const;
