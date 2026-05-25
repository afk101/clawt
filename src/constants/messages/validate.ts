import { createMessages } from '../../utils/i18n.js';

/** validate 命令专属提示消息（双语映射） */
const VALIDATE_MESSAGES_I18N = {
  /** validate 成功 */
  VALIDATE_SUCCESS: {
    en: (branch: string) =>
      `✓ Changes from branch ${branch} applied to main worktree\n  Ready for validation`,
    'zh-CN': (branch: string) =>
      `✓ 已将分支 ${branch} 的变更应用到主 worktree\n  可以开始验证了`,
  },
  /** 增量 validate 成功提示 */
  INCREMENTAL_VALIDATE_SUCCESS: {
    en: (branch: string) =>
      `✓ Latest changes from branch ${branch} applied to main worktree (incremental mode)\n  Staging area = last snapshot, Working directory = latest changes`,
    'zh-CN': (branch: string) =>
      `✓ 已将分支 ${branch} 的最新变更应用到主 worktree（增量模式）\n  暂存区 = 上次快照，工作目录 = 最新变更`,
  },
  /** 增量 validate 降级为全量模式提示 */
  INCREMENTAL_VALIDATE_FALLBACK: {
    en: 'Incremental comparison failed, fell back to full mode',
    'zh-CN': '增量对比失败，已降级为全量模式',
  },
  /** 增量 validate 检测到目标 worktree 无新变更 */
  INCREMENTAL_VALIDATE_NO_CHANGES: {
    en: (branch: string) =>
      `Branch ${branch} has no new changes since last validate, restored to previous validation state`,
    'zh-CN': (branch: string) =>
      `分支 ${branch} 自上次 validate 以来没有新的变更，已恢复到上次验证状态`,
  },
  /** validate 状态已清理 */
  VALIDATE_CLEANED: {
    en: (branch: string) => `✓ Validate state for branch ${branch} cleaned`,
    'zh-CN': (branch: string) => `✓ 分支 ${branch} 的 validate 状态已清理`,
  },
  /** validate patch apply 失败，提示用户同步主分支 */
  VALIDATE_PATCH_APPLY_FAILED: {
    en: (branch: string) =>
      `Change migration failed: target branch has diverged too far from main\n  Please run clawt sync -b ${branch} first, then retry`,
    'zh-CN': (branch: string) =>
      `变更迁移失败：目标分支与主分支差异过大\n  请先执行 clawt sync -b ${branch} 同步主分支后重试`,
  },
  /** validate 无可用 worktree */
  VALIDATE_NO_WORKTREES: {
    en: 'No worktrees available, please create one with clawt run or clawt create first',
    'zh-CN': '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  },
  /** validate 模糊匹配无结果，列出可用分支 */
  VALIDATE_NO_MATCH: {
    en: (name: string, branches: string[]) =>
      `No branch matching "${name}"\n  Available branches:\n${branches.map((b) => `    - ${b}`).join('\n')}`,
    'zh-CN': (name: string, branches: string[]) =>
      `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  },
  /** validate 交互选择提示 */
  VALIDATE_SELECT_BRANCH: {
    en: 'Select a branch to validate',
    'zh-CN': '请选择要验证的分支',
  },
  /** validate 模糊匹配到多个结果提示 */
  VALIDATE_MULTIPLE_MATCHES: {
    en: (name: string) => `"${name}" matched multiple branches, please select:`,
    'zh-CN': (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  },
  /** --run 命令开始执行提示 */
  VALIDATE_RUN_START: {
    en: (command: string) => `Running command in main worktree: ${command}`,
    'zh-CN': (command: string) => `正在主 worktree 中执行命令: ${command}`,
  },
  /** --run 命令执行成功（退出码 0） */
  VALIDATE_RUN_SUCCESS: {
    en: (command: string) => `✓ Command completed: ${command}, exit code: 0`,
    'zh-CN': (command: string) => `✓ 命令执行完成: ${command}，退出码: 0`,
  },
  /** --run 命令执行失败（退出码非 0） */
  VALIDATE_RUN_FAILED: {
    en: (command: string, exitCode: number) =>
      `✗ Command completed: ${command}, exit code: ${exitCode}`,
    'zh-CN': (command: string, exitCode: number) =>
      `✗ 命令执行完成: ${command}，退出码: ${exitCode}`,
  },
  /** --run 命令执行异常（进程启动失败等） */
  VALIDATE_RUN_ERROR: {
    en: (command: string, errorMessage: string) =>
      `✗ Command execution error: ${errorMessage}`,
    'zh-CN': (command: string, errorMessage: string) =>
      `✗ 命令执行出错: ${errorMessage}`,
  },
  /** 并行命令开始执行提示 */
  VALIDATE_PARALLEL_RUN_START: {
    en: (count: number) =>
      `Running ${count} command(s) in parallel...`,
    'zh-CN': (count: number) =>
      `正在并行执行 ${count} 个命令...`,
  },
  /** 并行执行中单个命令开始提示（带序号） */
  VALIDATE_PARALLEL_CMD_START: {
    en: (index: number, total: number, command: string) =>
      `[${index}/${total}] ${command}`,
    'zh-CN': (index: number, total: number, command: string) =>
      `[${index}/${total}] ${command}`,
  },
  /** 并行执行全部成功汇总提示 */
  VALIDATE_PARALLEL_RUN_ALL_SUCCESS: {
    en: (count: number) =>
      `✓ All ${count} command(s) completed successfully`,
    'zh-CN': (count: number) =>
      `✓ 全部 ${count} 个命令执行成功`,
  },
  /** 并行执行部分失败汇总提示 */
  VALIDATE_PARALLEL_RUN_SUMMARY: {
    en: (successCount: number, failedCount: number) =>
      `${successCount + failedCount} command(s), ${successCount} succeeded, ${failedCount} failed`,
    'zh-CN': (successCount: number, failedCount: number) =>
      `共 ${successCount + failedCount} 个命令，${successCount} 个成功，${failedCount} 个失败`,
  },
  /** 并行执行中单个命令成功 */
  VALIDATE_PARALLEL_CMD_SUCCESS: {
    en: (command: string) =>
      `  ✓ ${command}`,
    'zh-CN': (command: string) =>
      `  ✓ ${command}`,
  },
  /** 并行执行中单个命令失败 */
  VALIDATE_PARALLEL_CMD_FAILED: {
    en: (command: string, exitCode: number) =>
      `  ✗ ${command} (exit code: ${exitCode})`,
    'zh-CN': (command: string, exitCode: number) =>
      `  ✗ ${command}（退出码: ${exitCode}）`,
  },
  /** 并行执行中单个命令启动失败 */
  VALIDATE_PARALLEL_CMD_ERROR: {
    en: (command: string, errorMessage: string) =>
      `  ✗ ${command} (error: ${errorMessage})`,
    'zh-CN': (command: string, errorMessage: string) =>
      `  ✗ ${command}（错误: ${errorMessage}）`,
  },
  /** patch apply 失败后询问用户是否执行 sync */
  VALIDATE_CONFIRM_AUTO_SYNC: {
    en: (branch: string) =>
      `Run sync now to sync main branch to ${branch}?`,
    'zh-CN': (branch: string) =>
      `是否立即执行 sync 同步主分支到 ${branch}？`,
  },
  /** 自动 sync 开始提示 */
  VALIDATE_AUTO_SYNC_START: {
    en: (branch: string) =>
      `Auto-syncing main branch to ${branch} ...`,
    'zh-CN': (branch: string) =>
      `正在自动同步主分支到 ${branch} ...`,
  },
  /** 用户拒绝自动 sync */
  VALIDATE_AUTO_SYNC_DECLINED: {
    en: (branch: string) =>
      `Please run clawt sync -b ${branch} manually, then retry`,
    'zh-CN': (branch: string) =>
      `请手动执行 clawt sync -b ${branch} 同步主分支后重试`,
  },
  /** 验证分支不存在 */
  VALIDATE_BRANCH_NOT_FOUND: {
    en: (validateBranch: string, branch: string) =>
      `Validation branch ${validateBranch} does not exist, please run clawt create or clawt run to create branch ${branch} first`,
    'zh-CN': (validateBranch: string, branch: string) =>
      `验证分支 ${validateBranch} 不存在，请先执行 clawt create 或 clawt run 创建分支 ${branch}`,
  },
  /** validate 成功（含验证分支信息） */
  VALIDATE_SUCCESS_WITH_BRANCH: {
    en: (branch: string, validateBranch: string) =>
      `✓ Switched to validation branch ${validateBranch} and applied changes from branch ${branch}\n  Ready for validation`,
    'zh-CN': (branch: string, validateBranch: string) =>
      `✓ 已切换到验证分支 ${validateBranch} 并应用分支 ${branch} 的变更\n  可以开始验证了`,
  },
  /** 错误信息已复制到剪贴板提示 */
  VALIDATE_RUN_ERROR_COPIED: {
    en: '✂ Error information copied to clipboard',
    'zh-CN': '✂ 错误信息已复制到剪贴板',
  },
  /** 剪贴板复制失败提示 */
  VALIDATE_RUN_ERROR_COPY_FAILED: {
    en: '⚠ Failed to copy error information to clipboard',
    'zh-CN': '⚠ 错误信息复制到剪贴板失败',
  },
  /** 检测到外部软链接警告 */
  VALIDATE_EXTERNAL_SYMLINKS_FOUND: {
    en: (count: number) =>
      `⚠ Detected ${count} symlink(s) pointing outside the worktree (possibly created by AI Agent), auto-removed`,
    'zh-CN': (count: number) =>
      `⚠ 检测到 ${count} 个指向 worktree 外部的软链接（可能由 AI Agent 创建），已自动移除`,
  },
  /** 单命令（含 && 链）剪贴板错误格式 */
  VALIDATE_CLIPBOARD_SINGLE_ERROR: {
    en: (command: string, stderr: string) =>
      `${command} command error:\n${stderr}`,
    'zh-CN': (command: string, stderr: string) =>
      `${command} 指令执行出错，错误信息：\n${stderr}`,
  },
  /** 并行命令中单个命令的剪贴板错误格式 */
  VALIDATE_CLIPBOARD_PARALLEL_ERROR: {
    en: (command: string, stderr: string) =>
      `${command} command error:\n${stderr}`,
    'zh-CN': (command: string, stderr: string) =>
      `${command} 指令执行出错，错误信息：\n${stderr}`,
  },
  /** 多个错误之间的分隔符 */
  VALIDATE_CLIPBOARD_SEPARATOR: {
    en: '\n\n---\n\n',
    'zh-CN': '\n\n---\n\n',
  },
  // --- 从 validate-branch.ts 迁移 ---
  /** 工作区仍然不干净 */
  WORKSPACE_STILL_DIRTY: {
    en: 'Workspace is still dirty, please resolve manually',
    'zh-CN': '工作区仍然不干净，请手动处理',
  },
  /** 当前分支有未提交的更改 */
  UNCOMMITTED_CHANGES_ON_BRANCH: {
    en: 'Current branch has uncommitted changes, please choose how to handle:\n',
    'zh-CN': '当前分支有未提交的更改，请选择处理方式：\n',
  },
  /** 选择处理方式 */
  SELECT_ACTION: {
    en: 'Select action',
    'zh-CN': '选择处理方式',
  },
  /** 是否继续执行？ */
  CONFIRM_CONTINUE_VALIDATE: {
    en: 'Continue?',
    'zh-CN': '是否继续执行？',
  },
  /** 用户选择退出 */
  USER_CHOSE_EXIT: {
    en: 'User chose to exit, please resolve workspace changes manually and retry',
    'zh-CN': '用户选择退出，请手动处理工作区更改后重试',
  },
  // --- 从 validate-runner.ts 迁移 ---
  /** 指令执行出错，退出码 */
  COMMAND_EXEC_ERROR: {
    en: (command: string, exitCode: number) =>
      `${command} command error, exit code: ${exitCode}`,
    'zh-CN': (command: string, exitCode: number) =>
      `${command} 指令执行出错，退出码: ${exitCode}`,
  },
  /** 退出码标签 */
  EXIT_CODE_LABEL: {
    en: (exitCode: number) => `Exit code: ${exitCode}`,
    'zh-CN': (exitCode: number) => `退出码: ${exitCode}`,
  },
};

export const VALIDATE_MESSAGES = createMessages(VALIDATE_MESSAGES_I18N);
