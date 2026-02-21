/** remove 命令专属提示消息 */
export const REMOVE_MESSAGES = {
  /** 批量移除部分失败 */
  REMOVE_PARTIAL_FAILURE: (failures: Array<{ path: string; error: string }>) =>
    `以下 worktree 移除失败：\n${failures.map((f) => `  ✗ ${f.path}: ${f.error}`).join('\n')}`,
} as const;
