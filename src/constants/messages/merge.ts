/** merge 命令专属提示消息 */
export const MERGE_MESSAGES = {
  /** merge 成功 */
  MERGE_SUCCESS: (branch: string, message: string, pushed: boolean) =>
    `✓ 分支 ${branch} 已成功合并到当前分支\n  提交信息: ${message}${pushed ? '\n  已推送到远程仓库' : ''}`,
  /** merge 成功（无提交信息，目标 worktree 已提交过） */
  MERGE_SUCCESS_NO_MESSAGE: (branch: string, pushed: boolean) =>
    `✓ 分支 ${branch} 已成功合并到当前分支${pushed ? '\n  已推送到远程仓库' : ''}`,
  /** merge 冲突 */
  MERGE_CONFLICT: '合并存在冲突，请手动处理：\n  解决冲突后执行 git add . && git merge --continue',
  /** merge 后清理 worktree 和分支成功 */
  WORKTREE_CLEANED: (branch: string) => `✓ 已清理 worktree 和分支: ${branch}`,
  /** 目标 worktree 有未提交修改但未指定 -m */
  TARGET_WORKTREE_DIRTY_NO_MESSAGE: (worktreePath: string) =>
    `${worktreePath} 有未提交的修改，请通过 -m 参数提供提交信息`,
  /** 目标 worktree 既干净又无本地提交 */
  TARGET_WORKTREE_NO_CHANGES: '目标 worktree 没有任何可合并的变更（工作区干净且无本地提交）',
  /** merge 命令检测到 validate 状态的提示 */
  MERGE_VALIDATE_STATE_HINT: (branch: string) =>
    `主 worktree 可能存在 validate 残留状态，可先执行 clawt validate -b ${branch} --clean 清理`,
  /** merge 检测到 auto-save 提交，提示用户是否压缩 */
  MERGE_SQUASH_PROMPT: '检测到 sync 产生的临时提交，是否将所有提交压缩为一个？\n  压缩后变更将保留在目标worktree的暂存区，需要重新提交（可使用 Claude Code Cli或其他工具生成提交信息）',
  /** squash 完成且通过 -m 直接提交后的提示 */
  MERGE_SQUASH_COMMITTED: (branch: string) =>
    `✓ 已将分支 ${branch} 的所有提交压缩为一个`,
  /** squash 完成但未提供 -m，提示用户自行提交 */
  MERGE_SQUASH_PENDING: (worktreePath: string, branch: string) =>
    `✓ 已将所有提交压缩到暂存区\n  请在目标 worktree 中提交后重新执行 merge：\n  cd ${worktreePath}\n  提交完成后执行：clawt merge -b ${branch}`,
  /** merge 后 pull 冲突 */
  PULL_CONFLICT:
    '自动 pull 时发生冲突，merge 已完成但远程同步失败\n  请手动解决冲突：\n  解决冲突后执行 git add . && git commit\n  然后执行 git push 推送到远程',
  /** push 失败 */
  PUSH_FAILED: '自动 push 失败，merge 和 pull 已完成\n  请手动执行 git push',
  /** merge 无可用 worktree */
  MERGE_NO_WORKTREES: '当前项目没有可用的 worktree，请先通过 clawt run 或 clawt create 创建',
  /** merge 模糊匹配无结果，列出可用分支 */
  MERGE_NO_MATCH: (name: string, branches: string[]) =>
    `未找到与 "${name}" 匹配的分支\n  可用分支：\n${branches.map((b) => `    - ${b}`).join('\n')}`,
  /** merge 交互选择提示 */
  MERGE_SELECT_BRANCH: '请选择要合并的分支',
  /** merge 模糊匹配到多个结果提示 */
  MERGE_MULTIPLE_MATCHES: (name: string) => `"${name}" 匹配到多个分支，请选择：`,
  /** 询问是否使用 AI 辅助解决冲突 */
  MERGE_CONFLICT_ASK_AI: '检测到合并冲突，是否使用 Claude Code 自动解决？',
  /** AI 冲突解决开始 */
  MERGE_CONFLICT_AI_START: (fileCount: number) =>
    `正在使用 Claude Code 分析并解决 ${fileCount} 个冲突文件...`,
  /** AI 冲突解决成功 */
  MERGE_CONFLICT_AI_SUCCESS: '✓ Claude Code 已成功解决所有冲突',
  /** AI 冲突解决后仍有未解决的冲突 */
  MERGE_CONFLICT_AI_PARTIAL: (remaining: number) =>
    `Claude Code 已处理冲突文件，但仍有 ${remaining} 个文件存在冲突\n  请手动处理剩余冲突后执行 git add . && git merge --continue`,
  /** AI 冲突解决失败 */
  MERGE_CONFLICT_AI_FAILED: (errorMsg: string) =>
    `Claude Code 解决冲突失败: ${errorMsg}\n  请手动处理：\n  解决冲突后执行 git add . && git merge --continue`,
  /** --auto 模式下的冲突手动解决（配置为 manual） */
  MERGE_CONFLICT_MANUAL: '合并存在冲突，请手动处理：\n  解决冲突后执行 git add . && git merge --continue',
  /** 目标 worktree 有未提交修改时的交互式提交信息提示 */
  MERGE_PROMPT_COMMIT_MESSAGE: '目标 worktree 有未提交的修改，请输入提交信息',
  /** squash 后的交互式提交信息提示 */
  MERGE_SQUASH_PROMPT_COMMIT_MESSAGE: '请输入 squash 后的提交信息',
} as const;
