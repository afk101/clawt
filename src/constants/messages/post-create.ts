import { createMessages } from '../../utils/i18n.js';

/** postCreate hook 相关提示消息（双语映射） */
const POST_CREATE_MESSAGES_I18N = {
  /** hook 执行跳过（--no-post-create） */
  HOOK_SKIPPED: {
    en: 'Skipped postCreate hook (--no-post-create)',
    'zh-CN': '已跳过 postCreate hook（--no-post-create）',
  },
  /** 无 hook 配置 */
  HOOK_NOT_CONFIGURED: {
    en: 'postCreate hook not configured, skipping',
    'zh-CN': '未配置 postCreate hook，跳过',
  },
  /** hook 来源提示 */
  HOOK_SOURCE_INFO: {
    en: (source: string) => `postCreate hook source: ${source}`,
    'zh-CN': (source: string) => `postCreate hook 来源: ${source}`,
  },
  /** hook 开始执行 */
  HOOK_EXECUTING: {
    en: (branch: string, command: string) =>
      `[${branch}] Executing postCreate hook: ${command}`,
    'zh-CN': (branch: string, command: string) =>
      `[${branch}] 正在执行 postCreate hook: ${command}`,
  },
  /** hook 执行成功 */
  HOOK_SUCCESS: {
    en: (branch: string) => `[${branch}] postCreate hook executed successfully`,
    'zh-CN': (branch: string) => `[${branch}] postCreate hook 执行成功`,
  },
  /** hook 执行失败 */
  HOOK_FAILED: {
    en: (branch: string, error: string) =>
      `[${branch}] postCreate hook execution failed: ${error}`,
    'zh-CN': (branch: string, error: string) =>
      `[${branch}] postCreate hook 执行失败: ${error}`,
  },
  /** hook 执行汇总 */
  HOOK_SUMMARY: {
    en: (succeeded: number, failed: number) =>
      `postCreate hook completed: ${succeeded} succeeded, ${failed} failed`,
    'zh-CN': (succeeded: number, failed: number) =>
      `postCreate hook 执行完成: ${succeeded} 成功, ${failed} 失败`,
  },
  /** hook 后台执行中提示 */
  HOOK_BACKGROUND_START: {
    en: (count: number, command: string) =>
      `postCreate hook running in background (${count} worktree(s)): ${command}`,
    'zh-CN': (count: number, command: string) =>
      `postCreate hook 正在后台执行 (${count} 个 worktree): ${command}`,
  },
  /** postCreate.sh 自动添加执行权限 */
  POST_CREATE_SCRIPT_AUTO_CHMOD: {
    en: (path: string) =>
      `${path} is not executable, auto-added execute permission`,
    'zh-CN': (path: string) =>
      `${path} 不可执行，已自动添加执行权限`,
  },
  /** postCreate.sh 不可执行（自动 chmod 失败时降级提示） */
  POST_CREATE_SCRIPT_NOT_EXECUTABLE: {
    en: (path: string) =>
      `Detected ${path} but not executable, auto-chmod failed. Please run chmod +x ${path} manually`,
    'zh-CN': (path: string) =>
      `检测到 ${path} 但不可执行，自动添加权限失败，请手动执行 chmod +x ${path}`,
  },
};

export const POST_CREATE_MESSAGES = createMessages(POST_CREATE_MESSAGES_I18N);
