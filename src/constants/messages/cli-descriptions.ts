import { createMessages } from '../../utils/i18n.js';

/** Commander description/option 文本（双语映射） */
const CLI_DESCRIPTIONS_I18N = {
  // 主程序
  PROGRAM_DESC: {
    en: 'Run multiple Claude Code Agent tasks in parallel based on Git Worktree',
    'zh-CN': '本地并行执行多个Claude Code Agent任务，融合 Git Worktree 与 Claude Code CLI 的命令行工具',
  },
  OPTION_DEBUG: {
    en: 'Output debug information to terminal',
    'zh-CN': '输出详细调试信息到终端',
  },
  OPTION_YES: {
    en: 'Skip all interactive confirmations, suitable for scripts/CI',
    'zh-CN': '跳过所有交互式确认，适用于脚本/CI 环境',
  },
  // config 命令
  CONFIG_DESC: { en: 'Interactively view and modify global configuration', 'zh-CN': '交互式查看和修改全局配置' },
  CONFIG_RESET_DESC: { en: 'Reset configuration to defaults', 'zh-CN': '将配置恢复为默认值' },
  CONFIG_SET_DESC: { en: 'Set a configuration item (interactive without args)', 'zh-CN': '修改配置项（无参数进入交互式配置）' },
  CONFIG_GET_DESC: { en: 'Get a configuration item value', 'zh-CN': '获取单个配置项的值' },
  // init 命令
  INIT_DESC: { en: 'Initialize project-level configuration, set main work branch', 'zh-CN': '初始化项目级配置，设置主工作分支' },
  INIT_OPTION_BRANCH: { en: 'Specify main work branch name (defaults to current branch)', 'zh-CN': '指定主工作分支名（默认使用当前分支）' },
  INIT_SHOW_DESC: { en: 'Interactively view and modify project configuration (supports --json)', 'zh-CN': '交互式查看和修改项目配置（支持 --json 格式输出）' },
  INIT_OPTION_JSON: { en: 'Output in JSON format', 'zh-CN': '以 JSON 格式输出' },
  // create 命令
  CREATE_DESC: { en: 'Batch create worktrees and branches (with validate branches)', 'zh-CN': '批量创建 worktree 及对应分支（含验证分支）' },
  CREATE_OPTION_NUMBER: { en: 'Number of worktrees to create', 'zh-CN': '创建数量' },
  CREATE_OPTION_POST_CREATE: { en: 'Run postCreate hook (default on, --no-post-create to skip)', 'zh-CN': '执行 postCreate hook（默认开启，--no-post-create 跳过）' },
  // run 命令
  RUN_DESC: { en: 'Batch create worktrees + run Claude Code tasks (supports task files)', 'zh-CN': '批量创建 worktree + 启动 Claude Code 执行任务（支持任务文件）' },
  RUN_OPTION_BRANCH: { en: 'Branch name', 'zh-CN': '分支名' },
  RUN_OPTION_TASKS: { en: 'Task list (can be specified multiple times)', 'zh-CN': '任务列表（可多次指定），不传则在 worktree 中打开 Claude Code 交互式界面' },
  RUN_OPTION_CONCURRENCY: { en: 'Max concurrency, 0 means unlimited', 'zh-CN': '最大并发数，0 表示不限制' },
  RUN_OPTION_FILE: { en: 'Read task list from file (mutually exclusive with --tasks)', 'zh-CN': '从任务文件读取任务列表（与 --tasks 互斥）' },
  RUN_OPTION_DRY_RUN: { en: 'Preview mode, show task plan without executing', 'zh-CN': '预览模式，仅展示任务计划不实际执行' },
  RUN_OPTION_POST_CREATE: { en: 'Run postCreate hook (default on, --no-post-create to skip)', 'zh-CN': '执行 postCreate hook（默认开启，--no-post-create 跳过）' },
  // validate 命令
  VALIDATE_DESC: { en: 'Validate a worktree branch changes in the main worktree', 'zh-CN': '在主 worktree 验证某个 worktree 分支的变更（通过验证分支）' },
  VALIDATE_OPTION_BRANCH: { en: 'Branch name to validate (supports fuzzy match)', 'zh-CN': '要验证的分支名（支持模糊匹配，不传则列出所有分支）' },
  VALIDATE_OPTION_CLEAN: { en: 'Clean up validate state (reset main worktree and delete snapshots)', 'zh-CN': '清理 validate 状态（重置主 worktree 并删除快照）' },
  VALIDATE_OPTION_RUN: { en: 'Command to run in main worktree after successful validation', 'zh-CN': 'validate 成功后在主 worktree 中执行的命令' },
  // merge 命令
  MERGE_DESC: { en: 'Merge a validated worktree branch into the main worktree', 'zh-CN': '合并某个已验证的 worktree 分支到主 worktree' },
  MERGE_OPTION_BRANCH: { en: 'Branch to merge (supports fuzzy match)', 'zh-CN': '要合并的分支名（支持模糊匹配，不传则列出所有分支供选择）' },
  MERGE_OPTION_MESSAGE: { en: 'Commit message (required if target worktree has modifications)', 'zh-CN': '提交信息（目标 worktree 工作区有修改时必填）' },
  MERGE_OPTION_AUTO: { en: 'Auto-resolve conflicts with AI without asking', 'zh-CN': '遇到冲突直接调用 AI 解决，不再询问' },
  // remove 命令
  REMOVE_DESC: { en: 'Remove worktree (supports fuzzy match/multi-select/all)', 'zh-CN': '移除 worktree（支持模糊匹配/多选/全部）' },
  REMOVE_OPTION_ALL: { en: 'Remove all worktrees for the current project', 'zh-CN': '移除当前项目下所有 worktree' },
  REMOVE_OPTION_BRANCH: { en: 'Branch name (supports fuzzy match)', 'zh-CN': '指定分支名（支持模糊匹配，不传则列出所有分支）' },
  // resume 命令
  RESUME_DESC: { en: 'Resume a Claude Code session in an existing worktree', 'zh-CN': '在已有 worktree 中恢复 Claude Code 会话（支持多选批量恢复）' },
  RESUME_OPTION_BRANCH: { en: 'Branch to resume (supports fuzzy match)', 'zh-CN': '要恢复的分支名（支持模糊匹配，不传则列出所有分支）' },
  RESUME_OPTION_PROMPT: { en: 'Non-interactive follow-up (requires -b)', 'zh-CN': '非交互式追问（需配合 -b 指定分支）' },
  RESUME_OPTION_FILE: { en: 'Batch follow-up from task file (matches by branch name)', 'zh-CN': '从任务文件批量追问（通过 branch 名匹配已有 worktree）' },
  RESUME_OPTION_CONCURRENCY: { en: 'Max concurrency for batch follow-up, 0 means unlimited', 'zh-CN': '批量追问最大并发数，0 表示不限制' },
  // sync 命令
  SYNC_DESC: { en: 'Sync main branch code to target worktree', 'zh-CN': '将主分支最新代码同步到目标 worktree' },
  SYNC_OPTION_BRANCH: { en: 'Branch to sync (supports fuzzy match)', 'zh-CN': '要同步的分支名（支持模糊匹配，不传则列出所有分支）' },
  // status 命令
  STATUS_DESC: { en: 'Show project status overview (supports --json)', 'zh-CN': '显示项目全局状态总览（支持 --json 格式输出）' },
  STATUS_OPTION_JSON: { en: 'Output in JSON format', 'zh-CN': '以 JSON 格式输出' },
  STATUS_OPTION_INTERACTIVE: { en: 'Interactive panel mode', 'zh-CN': '交互式面板模式' },
  // list 命令
  LIST_DESC: { en: 'List all worktrees (supports --json)', 'zh-CN': '列出当前项目所有 worktree（支持 --json 格式输出）' },
  LIST_OPTION_JSON: { en: 'Output in JSON format', 'zh-CN': '以 JSON 格式输出' },
  // reset 命令
  RESET_DESC: { en: 'Reset main worktree working directory and staging area', 'zh-CN': '重置主 worktree 工作区和暂存区（保留 validate 快照）' },
  // home 命令
  HOME_DESC: { en: 'Switch back to the main work branch', 'zh-CN': '切换回主工作分支' },
  // projects 命令
  PROJECTS_DESC: { en: 'Show worktree overview across projects', 'zh-CN': '展示所有项目的 worktree 概览，或查看指定项目的 worktree 详情' },
  PROJECTS_OPTION_JSON: { en: 'Output in JSON format', 'zh-CN': '以 JSON 格式输出' },
  // alias 命令
  ALIAS_DESC: { en: 'Manage command aliases (list / set / remove)', 'zh-CN': '管理命令别名（列出 / 设置 / 移除）' },
  ALIAS_LIST_DESC: { en: 'List all aliases', 'zh-CN': '列出所有别名' },
  ALIAS_SET_DESC: { en: 'Set a command alias', 'zh-CN': '设置命令别名' },
  ALIAS_REMOVE_DESC: { en: 'Remove a command alias', 'zh-CN': '移除命令别名' },
  // completion 命令
  COMPLETION_DESC: { en: 'Internal dynamic completion method (not public)', 'zh-CN': '内部使用的动态补全方法，不对外公开' },
  // tasks 命令
  TASKS_DESC: { en: 'Task file management', 'zh-CN': '任务文件管理' },
  TASKS_INIT_DESC: { en: 'Generate task template file', 'zh-CN': '生成任务模板文件' },
  // cover 命令
  COVER_DESC: { en: 'Cover validate branch changes back to target worktree', 'zh-CN': '将验证分支上的修改覆盖回目标 worktree（自动推导目标分支）' },
};

export const CLI_DESCRIPTIONS = createMessages(CLI_DESCRIPTIONS_I18N);
