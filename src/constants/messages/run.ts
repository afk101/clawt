import { createMessages } from '../../utils/i18n.js';

/** run 命令专属提示消息（双语映射） */
const RUN_MESSAGES_I18N = {
  /** 分支已存在时提示使用 resume */
  BRANCH_EXISTS_USE_RESUME: {
    en: (name: string) => `Branch ${name} already exists, please use clawt resume -b ${name} to resume session`,
    'zh-CN': (name: string) => `分支 ${name} 已存在，请使用 clawt resume -b ${name} 恢复会话`,
  },
  /** 检测到用户中断 */
  INTERRUPTED: {
    en: 'Exit signal detected, Claude Code tasks stopped',
    'zh-CN': '检测到退出指令，已停止 Claude Code 任务',
  },
  /** 中断后自动清理完成 */
  INTERRUPT_AUTO_CLEANED: {
    en: (count: number) => `✓ Auto-cleaned ${count} worktree(s) and corresponding branches`,
    'zh-CN': (count: number) => `✓ 已自动清理 ${count} 个 worktree 和对应分支`,
  },
  /** 中断后手动确认清理 */
  INTERRUPT_CONFIRM_CLEANUP: {
    en: 'Remove the newly created worktrees and corresponding branches?',
    'zh-CN': '是否移除刚刚创建的 worktree 和对应分支？',
  },
  /** 中断后清理完成 */
  INTERRUPT_CLEANED: {
    en: (count: number) => `✓ Cleaned ${count} worktree(s) and corresponding branches`,
    'zh-CN': (count: number) => `✓ 已清理 ${count} 个 worktree 和对应分支`,
  },
  /** 中断后保留 worktree */
  INTERRUPT_KEPT: {
    en: 'Worktrees kept, use clawt remove to clean up later',
    'zh-CN': '已保留 worktree，可稍后使用 clawt remove 手动清理',
  },
  /** 非 TTY 环境降级输出：任务启动 */
  PROGRESS_TASK_STARTED: {
    en: (index: number, total: number, branch: string, path: string) =>
      `[${index}/${total}] ${branch} started  ${path}`,
    'zh-CN': (index: number, total: number, branch: string, path: string) =>
      `[${index}/${total}] ${branch} 启动  ${path}`,
  },
  /** 非 TTY 环境降级输出：任务完成 */
  PROGRESS_TASK_DONE: {
    en: (index: number, total: number, branch: string, duration: string, cost: string, detail: string) =>
      `[${index}/${total}] ${branch} ✓ done ${duration} ${cost}  ${detail}`,
    'zh-CN': (index: number, total: number, branch: string, duration: string, cost: string, detail: string) =>
      `[${index}/${total}] ${branch} ✓ 完成 ${duration} ${cost}  ${detail}`,
  },
  /** 非 TTY 环境降级输出：任务失败 */
  PROGRESS_TASK_FAILED: {
    en: (index: number, total: number, branch: string, duration: string, detail: string) =>
      `[${index}/${total}] ${branch} ✗ failed ${duration}  ${detail}`,
    'zh-CN': (index: number, total: number, branch: string, duration: string, detail: string) =>
      `[${index}/${total}] ${branch} ✗ 失败 ${duration}  ${detail}`,
  },
  /** 并发限制提示 */
  CONCURRENCY_INFO: {
    en: (concurrency: number, total: number) =>
      `Concurrency: ${concurrency}, total tasks: ${total}`,
    'zh-CN': (concurrency: number, total: number) =>
      `并发限制: ${concurrency}，共 ${total} 个任务`,
  },
  /** 并发数无效提示 */
  CONCURRENCY_INVALID: {
    en: 'Concurrency must be a positive integer',
    'zh-CN': '并发数必须为正整数',
  },
  /** 任务文件不存在 */
  TASK_FILE_NOT_FOUND: {
    en: (path: string) => `Task file not found: ${path}`,
    'zh-CN': (path: string) => `任务文件不存在: ${path}`,
  },
  /** 任务文件中没有解析到有效任务 */
  TASK_FILE_EMPTY: {
    en: 'No valid tasks found in the task file',
    'zh-CN': '任务文件中没有解析到有效任务',
  },
  /** 任务文件中某个任务块缺少分支名 */
  TASK_FILE_MISSING_BRANCH: {
    en: (blockIndex: number) => `Task block #${blockIndex} is missing branch name (# branch: ...)`,
    'zh-CN': (blockIndex: number) => `任务文件第 ${blockIndex} 个任务块缺少分支名（# branch: ...）`,
  },
  /** 任务文件中某个任务块缺少任务描述 */
  TASK_FILE_MISSING_TASK: {
    en: (branch: string) => `Task file is missing task description for branch ${branch}`,
    'zh-CN': (branch: string) => `任务文件中分支 ${branch} 缺少任务描述`,
  },
  /** 任务文件中某个任务块缺少任务描述（无分支名时按索引定位） */
  TASK_FILE_MISSING_TASK_BY_INDEX: {
    en: (blockIndex: number) => `Task block #${blockIndex} is missing task description`,
    'zh-CN': (blockIndex: number) => `任务文件第 ${blockIndex} 个任务块缺少任务描述`,
  },
  /** --file 和 --tasks 不能同时使用 */
  FILE_AND_TASKS_CONFLICT: {
    en: '--file and --tasks cannot be used together',
    'zh-CN': '--file 和 --tasks 不能同时使用',
  },
  /** 任务文件加载成功 */
  TASK_FILE_LOADED: {
    en: (count: number, path: string) => `✓ Loaded ${count} task(s) from ${path}`,
    'zh-CN': (count: number, path: string) => `✓ 从 ${path} 加载了 ${count} 个任务`,
  },
  /** 未指定 -b 或 -f */
  BRANCH_OR_FILE_REQUIRED: {
    en: 'Please specify -b <branch> or -f <task-file>',
    'zh-CN': '请指定 -b 分支名或 -f 任务文件',
  },
  /** dry-run 预览标题 */
  DRY_RUN_TITLE: {
    en: 'Dry Run Preview',
    'zh-CN': 'Dry Run 预览',
  },
  /** dry-run 任务数量 */
  DRY_RUN_TASK_COUNT: {
    en: (count: number) => `Tasks: ${count}`,
    'zh-CN': (count: number) => `任务数: ${count}`,
  },
  /** dry-run 并发数 */
  DRY_RUN_CONCURRENCY: {
    en: (concurrency: number) => `Concurrency: ${concurrency === 0 ? 'unlimited' : concurrency}`,
    'zh-CN': (concurrency: number) => `并发数: ${concurrency === 0 ? '不限制' : concurrency}`,
  },
  /** dry-run worktree 目录 */
  DRY_RUN_WORKTREE_DIR: {
    en: (dir: string) => `Worktree: ${dir}`,
    'zh-CN': (dir: string) => `Worktree: ${dir}`,
  },
  /** dry-run 分支已存在警告 */
  DRY_RUN_BRANCH_EXISTS_WARNING: {
    en: (name: string) => `Branch ${name} already exists`,
    'zh-CN': (name: string) => `分支 ${name} 已存在`,
  },
  /** dry-run 交互式模式提示（无任务描述） */
  DRY_RUN_INTERACTIVE_MODE: {
    en: 'Mode: Interactive (no preset task)',
    'zh-CN': '模式: 交互式（无预设任务）',
  },
  /** dry-run 预览完成且无冲突 */
  DRY_RUN_READY: {
    en: 'Preview complete, no conflicts. Remove --dry-run to execute.',
    'zh-CN': '预览完成，无冲突。移除 --dry-run 即可正式执行。',
  },
  /** dry-run 存在分支冲突 */
  DRY_RUN_HAS_CONFLICT: {
    en: 'Branch conflicts detected. Execution will fail. Please resolve conflicting branches first.',
    'zh-CN': '存在分支冲突，实际执行时将会报错。请先处理冲突的分支。',
  },
  // --- 从 dry-run.ts 迁移 ---
  /** 路径标签 */
  PATH_LABEL: {
    en: 'Path:',
    'zh-CN': '路径:',
  },
  /** 任务标签 */
  TASK_LABEL: {
    en: 'Task:',
    'zh-CN': '任务:',
  },
  // --- 从 task-executor.ts 迁移 ---
  /** 任务执行失败 */
  TASK_FAILED: {
    en: 'Task execution failed',
    'zh-CN': '任务执行失败',
  },
  /** 全部任务已完成 */
  ALL_TASKS_COMPLETED: {
    en: (total: number) => `All tasks completed (${total}/${total})`,
    'zh-CN': (total: number) => `全部任务已完成 (${total}/${total})`,
  },
  /** 成功标签 */
  SUCCESS_LABEL: {
    en: 'Succeeded:',
    'zh-CN': '成功:',
  },
  /** 失败标签 */
  FAILURE_LABEL: {
    en: 'Failed:',
    'zh-CN': '失败:',
  },
  /** 总耗时标签 */
  TOTAL_DURATION_LABEL: {
    en: 'Total duration:',
    'zh-CN': '总耗时:',
  },
  /** 总花费标签 */
  TOTAL_COST_LABEL: {
    en: 'Total cost:',
    'zh-CN': '总花费:',
  },
};

export const RUN_MESSAGES = createMessages(RUN_MESSAGES_I18N);
