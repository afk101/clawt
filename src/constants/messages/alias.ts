/** alias 命令专属提示消息 */
export const ALIAS_MESSAGES = {
  /** 别名列表为空 */
  ALIAS_LIST_EMPTY: '(无别名)',
  /** 别名设置成功 */
  ALIAS_SET_SUCCESS: (alias: string, command: string) =>
    `✓ 已设置别名: ${alias} → ${command}`,
  /** 别名移除成功 */
  ALIAS_REMOVE_SUCCESS: (alias: string) =>
    `✓ 已移除别名: ${alias}`,
  /** 别名不存在 */
  ALIAS_NOT_FOUND: (alias: string) =>
    `别名 "${alias}" 不存在`,
  /** 别名与内置命令冲突 */
  ALIAS_CONFLICTS_BUILTIN: (alias: string) =>
    `别名 "${alias}" 与内置命令冲突，不允许覆盖内置命令`,
  /** 目标命令不存在 */
  ALIAS_TARGET_NOT_FOUND: (command: string) =>
    `目标命令 "${command}" 不存在，请指定已注册的内置命令名`,
  /** 别名列表标题 */
  ALIAS_LIST_TITLE: '当前别名列表：',
} as const;
