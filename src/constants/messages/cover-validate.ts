/** cover-validate 命令专属提示消息 */
export const COVER_VALIDATE_MESSAGES = {
  /** 当前不在验证分支上 */
  COVER_VALIDATE_NOT_ON_VALIDATE_BRANCH: '当前分支不是验证分支（需以 clawt-validate- 开头）\n  请先通过 clawt validate 切换到验证分支',
  /** 无增量修改 */
  COVER_VALIDATE_NO_CHANGES: '验证分支上没有相对于快照的增量修改，无需覆盖',
  /** 目标 worktree 不存在 */
  COVER_VALIDATE_TARGET_NOT_FOUND: (branch: string) =>
    `未找到分支 ${branch} 对应的 worktree，请确认该 worktree 尚未被移除`,
  /** 无快照，提示先执行 validate */
  COVER_VALIDATE_NO_SNAPSHOT: (branch: string) =>
    `未找到分支 ${branch} 的 validate 快照\n  请先执行 clawt validate -b ${branch} 创建快照`,
  /** patch 应用失败 */
  COVER_VALIDATE_APPLY_FAILED: (branch: string) =>
    `覆盖变更到 worktree ${branch} 失败：patch 应用出错\n  请检查目标 worktree 工作区状态后重试`,
  /** 工作区和暂存区无修改，可能为误操作 */
  COVER_VALIDATE_WORKING_DIR_CLEAN: '当前验证分支的工作区和暂存区没有任何修改，可能为误操作',
  /** 覆盖成功 */
  COVER_VALIDATE_SUCCESS: (branch: string) =>
    `✓ 已将验证分支上的修改覆盖到 worktree => ${branch}`,
} as const;
