import { createMessages } from '../../utils/i18n.js';

/** 各包管理器对应的全局安装命令（双语映射，命令本身不需要翻译） */
const UPDATE_COMMANDS_I18N = {
  npm: {
    en: 'npm i -g clawt',
    'zh-CN': 'npm i -g clawt',
  },
  pnpm: {
    en: 'pnpm add -g clawt',
    'zh-CN': 'pnpm add -g clawt',
  },
  yarn: {
    en: 'yarn global add clawt',
    'zh-CN': 'yarn global add clawt',
  },
};

/** 各包管理器对应的全局安装命令 */
export const UPDATE_COMMANDS = createMessages(UPDATE_COMMANDS_I18N);

/** 更新检查相关提示消息（双语映射） */
const UPDATE_MESSAGES_I18N = {
  /** 版本更新提示 */
  UPDATE_AVAILABLE: {
    en: (currentVersion: string, latestVersion: string) =>
      `clawt update available: ${currentVersion} → ${latestVersion}`,
    'zh-CN': (currentVersion: string, latestVersion: string) =>
      `clawt 有新版本可用: ${currentVersion} → ${latestVersion}`,
  },
  /** 更新操作提示 */
  UPDATE_HINT: {
    en: (command: string) => `Run ${command} to update`,
    'zh-CN': (command: string) => `执行 ${command} 进行更新`,
  },
};

/** 更新检查相关提示消息 */
export const UPDATE_MESSAGES = createMessages(UPDATE_MESSAGES_I18N);
