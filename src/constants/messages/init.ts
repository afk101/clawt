import { createMessages } from '../../utils/i18n.js';

/** init 命令专属提示消息（双语映射） */
const INIT_MESSAGES_I18N = {
  /** init 成功 */
  INIT_SUCCESS: {
    en: (branch: string) =>
      `✓ Project initialized, main work branch set to: ${branch}`,
    'zh-CN': (branch: string) =>
      `✓ 项目初始化成功，主工作分支设置为: ${branch}`,
  },
  /** init 更新 */
  INIT_UPDATED: {
    en: (oldBranch: string, newBranch: string) =>
      `✓ Main work branch updated from ${oldBranch} to ${newBranch}`,
    'zh-CN': (oldBranch: string, newBranch: string) =>
      `✓ 已将主工作分支从 ${oldBranch} 更新为 ${newBranch}`,
  },
  /** init show 查看当前项目完整配置（JSON 格式） */
  INIT_SHOW: {
    en: (configJson: string) =>
      `${configJson}`,
    'zh-CN': (configJson: string) =>
      `${configJson}`,
  },
  /** init 未初始化 */
  INIT_NOT_INITIALIZED: {
    en: 'Project not initialized. Please run clawt init to set the main work branch',
    'zh-CN': '项目尚未初始化，请先执行 clawt init 设置主工作分支',
  },
  /** 项目未初始化（requireProjectConfig 使用） */
  PROJECT_NOT_INITIALIZED: {
    en: 'Project not initialized. Please run clawt init to set the main work branch',
    'zh-CN': '项目尚未初始化，请先执行 clawt init 设置主工作分支',
  },
  /** 项目配置缺少 clawtMainWorkBranch 字段 */
  PROJECT_CONFIG_MISSING_BRANCH: {
    en: 'Project config missing main work branch info. Please run clawt init to set the main work branch',
    'zh-CN': '项目配置缺少主工作分支信息，请重新执行 clawt init 设置主工作分支',
  },
  /** init show 交互式面板选择配置项提示 */
  INIT_SELECT_PROMPT: {
    en: 'Select project config item to modify',
    'zh-CN': '选择要修改的项目配置项',
  },
  /** init show 交互式面板配置项修改成功 */
  INIT_SET_SUCCESS: {
    en: (key: string, value: string) => `✓ Project config ${key} set to ${value}`,
    'zh-CN': (key: string, value: string) => `✓ 项目配置 ${key} 已设置为 ${value}`,
  },
};

export const INIT_MESSAGES = createMessages(INIT_MESSAGES_I18N);
