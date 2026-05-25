import { createMessages } from '../../utils/i18n.js';

/** alias 命令专属提示消息（双语映射） */
const ALIAS_MESSAGES_I18N = {
  /** 别名列表为空 */
  ALIAS_LIST_EMPTY: {
    en: '(No aliases)',
    'zh-CN': '(无别名)',
  },
  /** 别名设置成功 */
  ALIAS_SET_SUCCESS: {
    en: (alias: string, command: string) =>
      `✓ Alias set: ${alias} → ${command}`,
    'zh-CN': (alias: string, command: string) =>
      `✓ 已设置别名: ${alias} → ${command}`,
  },
  /** 别名移除成功 */
  ALIAS_REMOVE_SUCCESS: {
    en: (alias: string) =>
      `✓ Alias removed: ${alias}`,
    'zh-CN': (alias: string) =>
      `✓ 已移除别名: ${alias}`,
  },
  /** 别名不存在 */
  ALIAS_NOT_FOUND: {
    en: (alias: string) =>
      `Alias "${alias}" does not exist`,
    'zh-CN': (alias: string) =>
      `别名 "${alias}" 不存在`,
  },
  /** 别名与内置命令冲突 */
  ALIAS_CONFLICTS_BUILTIN: {
    en: (alias: string) =>
      `Alias "${alias}" conflicts with a built-in command. Overriding built-in commands is not allowed`,
    'zh-CN': (alias: string) =>
      `别名 "${alias}" 与内置命令冲突，不允许覆盖内置命令`,
  },
  /** 目标命令不存在 */
  ALIAS_TARGET_NOT_FOUND: {
    en: (command: string) =>
      `Target command "${command}" does not exist. Please specify a registered built-in command name`,
    'zh-CN': (command: string) =>
      `目标命令 "${command}" 不存在，请指定已注册的内置命令名`,
  },
  /** 别名列表标题 */
  ALIAS_LIST_TITLE: {
    en: 'Current aliases:',
    'zh-CN': '当前别名列表：',
  },
} as const;

export const ALIAS_MESSAGES = createMessages(ALIAS_MESSAGES_I18N);
