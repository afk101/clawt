/** validate 命令专属提示消息 */
export const VALIDATE_MESSAGES = {
  /** validate 成功 */
  VALIDATE_SUCCESS: (branch: string) =>
    `✓ 已将分支 ${branch} 的变更应用到主 worktree\n  可以开始验证了`,
  /** 增量 validate 成功提示 */
  INCREMENTAL_VALIDATE_SUCCESS: (branch: string) =>
    `✓ 已将分支 ${branch} 的最新变更应用到主 worktree（增量模式）\n  暂存区 = 上次快照，工作目录 = 最新变更`,
  /** 增量 validate 降级为全量模式提示 */
  INCREMENTAL_VALIDATE_FALLBACK: '增量对比失败，已降级为全量模式',
  /** 增量 validate 检测到目标 worktree 无新变更 */
  INCREMENTAL_VALIDATE_NO_CHANGES: (branch: string) =>
    `分支 ${branch} 自上次 validate 以来没有新的变更，已恢复到上次验证状态`,
  /** validate 状态已清理 */
  VALIDATE_CLEANED: (branch: string) => `✓ 分支 ${branch} 的 validate 状态已清理`,
  /** validate patch apply 失败，提示用户同步主分支 */
  VALIDATE_PATCH_APPLY_FAILED: (branch: string) =>
    `变更迁移失败：目标分支与主分支差异过大\n  请先执行 clawt sync -b ${branch} 同步主分支后重试`,
  /** validate 无可用 worktree */
  VALIDATE_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** validate 模糊匹配无结果，列出可用分支 */
  VALIDATE_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** validate 交互选择提示 */
  VALIDATE_SELECT_BRANCH: '请选择要验证的分支',
  /** validate 模糊匹配到多个结果提示 */
  VALIDATE_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  /** --run 命令开始执行提示 */
  VALIDATE_RUN_START: (command: string) => `正在主 worktree 中执行命令: ${command}`,
  /** --run 命令执行成功（退出码 0） */
  VALIDATE_RUN_SUCCESS: (command: string) => `✓ 命令执行完成: ${command}，退出码: 0`,
  /** --run 命令执行失败（退出码非 0） */
  VALIDATE_RUN_FAILED: (command: string, exitCode: number) =>
    `✗ 命令执行完成: ${command}，退出码: ${exitCode}`,
  /** --run 命令执行异常（进程启动失败等） */
  VALIDATE_RUN_ERROR: (command: string, errorMessage: string) =>
    `✗ 命令执行出错: ${errorMessage}`,
  /** 并行命令开始执行提示 */
  VALIDATE_PARALLEL_RUN_START: (count: number) =>
    `正在并行执行 ${count} 个命令...`,
  /** 并行执行中单个命令开始提示（带序号） */
  VALIDATE_PARALLEL_CMD_START: (index: number, total: number, command: string) =>
    `[${index}/${total}] ${command}`,
  /** 并行执行全部成功汇总提示 */
  VALIDATE_PARALLEL_RUN_ALL_SUCCESS: (count: number) =>
    `✓ 全部 ${count} 个命令执行成功`,
  /** 并行执行部分失败汇总提示 */
  VALIDATE_PARALLEL_RUN_SUMMARY: (successCount: number, failedCount: number) =>
    `共 ${successCount + failedCount} 个命令，${successCount} 个成功，${failedCount} 个失败`,
  /** 并行执行中单个命令成功 */
  VALIDATE_PARALLEL_CMD_SUCCESS: (command: string) =>
    `  ✓ ${command}`,
  /** 并行执行中单个命令失败 */
  VALIDATE_PARALLEL_CMD_FAILED: (command: string, exitCode: number) =>
    `  ✗ ${command}（退出码: ${exitCode}）`,
  /** 并行执行中单个命令启动失败 */
  VALIDATE_PARALLEL_CMD_ERROR: (command: string, errorMessage: string) =>
    `  ✗ ${command}（错误: ${errorMessage}）`,
  /** patch apply 失败后询问用户是否执行 sync */
  VALIDATE_CONFIRM_AUTO_SYNC: (branch: string) =>
    `是否立即执行 sync 同步主分支到 ${branch}？`,
  /** 自动 sync 开始提示 */
  VALIDATE_AUTO_SYNC_START: (branch: string) =>
    `正在自动同步主分支到 ${branch} ...`,
  /** 用户拒绝自动 sync */
  VALIDATE_AUTO_SYNC_DECLINED: (branch: string) =>
    `请手动执行 clawt sync -b ${branch} 同步主分支后重试`,
  /** 验证分支不存在 */
  VALIDATE_BRANCH_NOT_FOUND: (validateBranch: string, branch: string) =>
    `验证分支 ${validateBranch} 不存在，请先执行 clawt create 或 clawt run 创建分支 ${branch}`,
  /** validate 成功（含验证分支信息） */
  VALIDATE_SUCCESS_WITH_BRANCH: (branch: string, validateBranch: string) =>
    `✓ 已切换到验证分支 ${validateBranch} 并应用分支 ${branch} 的变更\n  可以开始验证了`,
  /** 错误信息已复制到剪贴板提示 */
  VALIDATE_RUN_ERROR_COPIED: '✂ 错误信息已复制到剪贴板',
  /** 剪贴板复制失败提示 */
  VALIDATE_RUN_ERROR_COPY_FAILED: '⚠ 错误信息复制到剪贴板失败',
  /** 检测到外部软链接警告 */
  VALIDATE_EXTERNAL_SYMLINKS_FOUND: (count: number) =>
    `⚠ 检测到 ${count} 个指向 worktree 外部的软链接（可能由 AI Agent 创建），已自动移除`,
  /** 无外部软链接时的调试日志 */
  VALIDATE_NO_EXTERNAL_SYMLINKS: '未检测到外部软链接',
  /** 单命令（含 && 链）剪贴板错误格式 */
  VALIDATE_CLIPBOARD_SINGLE_ERROR: (command: string, stderr: string) =>
    `${command} 指令执行出错，错误信息：\n${stderr}`,
  /** 并行命令中单个命令的剪贴板错误格式 */
  VALIDATE_CLIPBOARD_PARALLEL_ERROR: (command: string, stderr: string) =>
    `${command} 指令执行出错，错误信息：\n${stderr}`,
  /** 多个错误之间的分隔符 */
  VALIDATE_CLIPBOARD_SEPARATOR: '\n\n---\n\n',
} as const;
