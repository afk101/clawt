/** 提示消息模板 */
export const MESSAGES = {
  /** 不在主 worktree 根目录 */
  NOT_MAIN_WORKTREE: '请在主 worktree 的根目录下执行 clawt',
  /** Git 未安装 */
  GIT_NOT_INSTALLED: 'Git 未安装或不在 PATH 中，请先安装 Git',
  /** Claude Code CLI 未安装 */
  CLAUDE_NOT_INSTALLED: 'Claude Code CLI 未安装，请先安装：npm install -g @anthropic-ai/claude-code',
  /** 分支已存在 */
  BRANCH_EXISTS: (name: string) => `分支 ${name} 已存在，无法创建`,
  /** 分支已存在时提示使用 resume */
  BRANCH_EXISTS_USE_RESUME: (name: string) =>
    `分支 ${name} 已存在，请使用 clawt resume -b ${name} 恢复会话`,
  /** 分支名清理后为空 */
  BRANCH_NAME_EMPTY: (original: string) =>
    `分支名 "${original}" 中不包含合法字符，无法创建分支`,
  /** 分支名被转换 */
  BRANCH_SANITIZED: (original: string, sanitized: string) =>
    `分支名已转换: ${original} → ${sanitized}`,
  /** worktree 创建成功 */
  WORKTREE_CREATED: (count: number) => `✓ 已创建 ${count} 个 worktree`,
  /** worktree 移除成功 */
  WORKTREE_REMOVED: (path: string) => `✓ 已移除 worktree: ${path}`,
  /** 没有 worktree */
  NO_WORKTREES: '(无 worktree)',
  /** 目标 worktree 不存在 */
  WORKTREE_NOT_FOUND: (name: string) => `worktree ${name} 不存在`,
  /** 主 worktree 有未提交更改 */
  MAIN_WORKTREE_DIRTY: '主 worktree 有未提交的更改，请先处理',
  /** 目标 worktree 无更改 */
  TARGET_WORKTREE_CLEAN: '该 worktree 的分支上没有任何更改，无需验证',
  /** validate 成功 */
  VALIDATE_SUCCESS: (branch: string) =>
    `✓ 已将分支 ${branch} 的变更应用到主 worktree\n  可以开始验证了`,
  /** merge 成功 */
  MERGE_SUCCESS: (branch: string, message: string, pushed: boolean) =>
    `✓ 分支 ${branch} 已成功合并到当前分支\n  提交信息: ${message}${pushed ? '\n  已推送到远程仓库' : ''}`,
  /** merge 成功（无提交信息，目标 worktree 已提交过） */
  MERGE_SUCCESS_NO_MESSAGE: (branch: string, pushed: boolean) =>
    `✓ 分支 ${branch} 已成功合并到当前分支${pushed ? '\n  已推送到远程仓库' : ''}`,
  /** merge 冲突 */
  MERGE_CONFLICT: '合并存在冲突，请手动处理',
  /** merge 后清理 worktree 和分支成功 */
  WORKTREE_CLEANED: (branch: string) => `✓ 已清理 worktree 和分支: ${branch}`,
  /** 请提供提交信息 */
  COMMIT_MESSAGE_REQUIRED: '请提供提交信息（-m 参数）',
  /** 目标 worktree 有未提交修改但未指定 -m */
  TARGET_WORKTREE_DIRTY_NO_MESSAGE: '目标 worktree 有未提交的修改，请通过 -m 参数提供提交信息',
  /** 目标 worktree 既干净又无本地提交 */
  TARGET_WORKTREE_NO_CHANGES: '目标 worktree 没有任何可合并的变更（工作区干净且无本地提交）',
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
  /** 配置文件损坏，已重新生成默认配置 */
  CONFIG_CORRUPTED: '配置文件损坏或无法解析，已重新生成默认配置',
  /** 分隔线 */
  SEPARATOR: '────────────────────────────────────────',
  /** 粗分隔线 */
  DOUBLE_SEPARATOR: '════════════════════════════════════════',
  /** 创建数量参数无效 */
  INVALID_COUNT: (value: string) => `无效的创建数量: "${value}"，请输入正整数`,
  /** worktree 状态获取失败 */
  WORKTREE_STATUS_UNAVAILABLE: '(状态不可用)',
  /** 增量 validate 成功提示 */
  INCREMENTAL_VALIDATE_SUCCESS: (branch: string) =>
    `✓ 已将分支 ${branch} 的最新变更应用到主 worktree（增量模式）\n  暂存区 = 上次快照，工作目录 = 最新变更`,
  /** 增量 validate 降级为全量模式提示 */
  INCREMENTAL_VALIDATE_FALLBACK: '增量对比失败，已降级为全量模式',
  /** validate 状态已清理 */
  VALIDATE_CLEANED: (branch: string) => `✓ 分支 ${branch} 的 validate 状态已清理`,
  /** merge 命令检测到 validate 状态的提示 */
  MERGE_VALIDATE_STATE_HINT: (branch: string) =>
    `主 worktree 可能存在 validate 残留状态，可先执行 clawt validate -b ${branch} --clean 清理`,
  /** sync 自动保存未提交变更 */
  SYNC_AUTO_COMMITTED: (branch: string) =>
    `已自动保存 ${branch} 分支的未提交变更`,
  /** sync 开始合并 */
  SYNC_MERGING: (targetBranch: string, mainBranch: string) =>
    `正在将 ${mainBranch} 合并到 ${targetBranch} ...`,
  /** sync 成功 */
  SYNC_SUCCESS: (targetBranch: string, mainBranch: string) =>
    `✓ 已将 ${mainBranch} 的最新代码同步到 ${targetBranch}`,
  /** sync 冲突 */
  SYNC_CONFLICT: (worktreePath: string) =>
    `合并存在冲突，请进入目标 worktree 手动解决：\n  cd ${worktreePath}\n  解决冲突后执行 git add . && git merge --continue\n  clawt validate -b <branch> 验证变更`,
  /** validate patch apply 失败，提示用户同步主分支 */
  VALIDATE_PATCH_APPLY_FAILED: (branch: string) =>
    `变更迁移失败：目标分支与主分支差异过大\n  请先执行 clawt sync -b ${branch} 同步主分支后重试`,
  /** merge 检测到 auto-save 提交，提示用户是否压缩 */
  MERGE_SQUASH_PROMPT: '检测到 sync 产生的临时提交，是否将所有提交压缩为一个？\n  压缩后变更将保留在目标worktree的暂存区，需要重新提交（可使用 Claude Code Cli或其他工具生成提交信息）',
  /** squash 完成且通过 -m 直接提交后的提示 */
  MERGE_SQUASH_COMMITTED: (branch: string) =>
    `✓ 已将分支 ${branch} 的所有提交压缩为一个`,
  /** squash 完成但未提供 -m，提示用户自行提交 */
  MERGE_SQUASH_PENDING: (worktreePath: string, branch: string) =>
    `✓ 已将所有提交压缩到暂存区\n  请在目标 worktree 中提交后重新执行 merge：\n  cd ${worktreePath}\n  提交完成后执行：clawt merge -b ${branch}`,
  /** 用户取消破坏性操作 */
  DESTRUCTIVE_OP_CANCELLED: '已取消操作',
  /** reset 成功 */
  RESET_SUCCESS: '✓ 主 worktree 工作区和暂存区已重置',
  /** reset 时工作区和暂存区已干净 */
  RESET_ALREADY_CLEAN: '主 worktree 工作区和暂存区已是干净状态，无需重置',
  /** 批量移除部分失败 */
  REMOVE_PARTIAL_FAILURE: (failures: Array<{ path: string; error: string }>) =>
    `以下 worktree 移除失败：\n${failures.map((f) => `  ✗ ${f.path}: ${f.error}`).join('\n')}`,
  /** resume 无可用 worktree */
  RESUME_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** resume 模糊匹配无结果，列出可用分支 */
  RESUME_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** resume 交互选择提示 */
  RESUME_SELECT_BRANCH: '请选择要恢复的分支',
  /** resume 模糊匹配到多个结果提示 */
  RESUME_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  /** validate 无可用 worktree */
  VALIDATE_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** validate 模糊匹配无结果，列出可用分支 */
  VALIDATE_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** validate 交互选择提示 */
  VALIDATE_SELECT_BRANCH: '请选择要验证的分支',
  /** validate 模糊匹配到多个结果提示 */
  VALIDATE_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  /** merge 无可用 worktree */
  MERGE_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** merge 模糊匹配无结果，列出可用分支 */
  MERGE_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** merge 交互选择提示 */
  MERGE_SELECT_BRANCH: '请选择要合并的分支',
  /** merge 模糊匹配到多个结果提示 */
  MERGE_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  /** sync 无可用 worktree */
  SYNC_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** sync 模糊匹配无结果，列出可用分支 */
  SYNC_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** sync 交互选择提示 */
  SYNC_SELECT_BRANCH: '请选择要同步的分支',
  /** sync 模糊匹配到多个结果提示 */
  SYNC_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
} as const;
