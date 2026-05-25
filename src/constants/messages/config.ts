import { createMessages } from '../../utils/i18n.js';

/** 对象类型配置项禁用提示（如 aliases 需通过专用命令管理） */
const CONFIG_ALIAS_DISABLED_HINT_I18N = {
  en: '(Manage via clawt alias command)',
  'zh-CN': '(通过 clawt alias 命令管理)',
};

export const CONFIG_ALIAS_DISABLED_HINT = createMessages({ HINT: CONFIG_ALIAS_DISABLED_HINT_I18N }).HINT;

/** config 命令专属提示消息（双语映射） */
const CONFIG_CMD_MESSAGES_I18N = {
  /** 配置已恢复为默认值 */
  CONFIG_RESET_SUCCESS: {
    en: '✓ Configuration reset to defaults',
    'zh-CN': '✓ 配置已恢复为默认值',
  },
  /** 配置项设置成功 */
  CONFIG_SET_SUCCESS: {
    en: (key: string, value: string) => `✓ ${key} set to ${value}`,
    'zh-CN': (key: string, value: string) => `✓ ${key} 已设置为 ${value}`,
  },
  /** 获取配置值显示 */
  CONFIG_GET_VALUE: {
    en: (key: string, value: string) => `${key} = ${value}`,
    'zh-CN': (key: string, value: string) => `${key} = ${value}`,
  },
  /** 无效配置项名称 */
  CONFIG_INVALID_KEY: {
    en: (key: string, validKeys: string[]) =>
      `Invalid config key: ${key}\nAvailable keys: ${validKeys.join(', ')}`,
    'zh-CN': (key: string, validKeys: string[]) =>
      `无效的配置项: ${key}\n可用的配置项: ${validKeys.join(', ')}`,
  },
  /** 布尔类型值无效 */
  CONFIG_INVALID_BOOLEAN: {
    en: (key: string) =>
      `Config key ${key} is boolean, only accepts true or false`,
    'zh-CN': (key: string) =>
      `配置项 ${key} 为布尔类型，仅接受 true 或 false`,
  },
  /** 数字类型值无效 */
  CONFIG_INVALID_NUMBER: {
    en: (key: string) =>
      `Config key ${key} is numeric, please enter a valid number`,
    'zh-CN': (key: string) =>
      `配置项 ${key} 为数字类型，请输入有效的数字`,
  },
  /** 枚举类型配置项值无效（通用版） */
  CONFIG_INVALID_ENUM: {
    en: (key: string, validValues: readonly string[]) =>
      `Config key ${key} only accepts: ${validValues.join(', ')}`,
    'zh-CN': (key: string, validValues: readonly string[]) =>
      `配置项 ${key} 仅接受以下值: ${validValues.join(', ')}`,
  },
  /** 交互式选择配置项提示 */
  CONFIG_SELECT_PROMPT: {
    en: 'Select a config key to modify',
    'zh-CN': '选择要修改的配置项',
  },
  /** 交互式输入新值提示 */
  CONFIG_INPUT_PROMPT: {
    en: (key: string) => `Enter new value for ${key}`,
    'zh-CN': (key: string) => `输入 ${key} 的新值`,
  },
  /** 缺少 value 参数提示 */
  CONFIG_MISSING_VALUE: {
    en: (key: string) => `Missing value, usage: clawt config set ${key} <value>`,
    'zh-CN': (key: string) => `缺少配置值，用法: clawt config set ${key} <value>`,
  },
};

export const CONFIG_CMD_MESSAGES = createMessages(CONFIG_CMD_MESSAGES_I18N);