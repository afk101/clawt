/** config 命令专属提示消息 */
export const CONFIG_CMD_MESSAGES = {
  /** 配置已恢复为默认值 */
  CONFIG_RESET_SUCCESS: '✓ 配置已恢复为默认值',
  /** 配置项设置成功 */
  CONFIG_SET_SUCCESS: (key: string, value: string) => `✓ ${key} 已设置为 ${value}`,
  /** 获取配置值显示 */
  CONFIG_GET_VALUE: (key: string, value: string) => `${key} = ${value}`,
  /** 无效配置项名称 */
  CONFIG_INVALID_KEY: (key: string, validKeys: string[]) =>
    `无效的配置项: ${key}\n可用的配置项: ${validKeys.join(', ')}`,
  /** 布尔类型值无效 */
  CONFIG_INVALID_BOOLEAN: (key: string) =>
    `配置项 ${key} 为布尔类型，仅接受 true 或 false`,
  /** 数字类型值无效 */
  CONFIG_INVALID_NUMBER: (key: string) =>
    `配置项 ${key} 为数字类型，请输入有效的数字`,
  /** 枚举类型配置项值无效（通用版） */
  CONFIG_INVALID_ENUM: (key: string, validValues: readonly string[]) =>
    `配置项 ${key} 仅接受以下值: ${validValues.join(', ')}`,
  /** 交互式选择配置项提示 */
  CONFIG_SELECT_PROMPT: '选择要修改的配置项',
  /** 交互式输入新值提示 */
  CONFIG_INPUT_PROMPT: (key: string) => `输入 ${key} 的新值`,
  /** 缺少 value 参数提示 */
  CONFIG_MISSING_VALUE: (key: string) => `缺少配置值，用法: clawt config set ${key} <value>`,
} as const;
