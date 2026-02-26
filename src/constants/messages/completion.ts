/**
 * 自动补全命令相关的提示消息常量
 */
export const COMPLETION_MESSAGES = {
  /** completion 命令的主描述 */
  COMPLETION_COMMAND_DESC: '生成和安装 shell 自动补全脚本',
  /** bash 子命令描述 */
  COMPLETION_BASH_DESC: '输出 bash 自动补全脚本',
  /** zsh 子命令描述 */
  COMPLETION_ZSH_DESC: '输出 zsh 自动补全脚本',
  /** install 子命令描述 */
  COMPLETION_INSTALL_DESC: '自动安装补全脚本到当前用户的 shell 配置文件',
  /** 安装成功提示 */
  COMPLETION_INSTALL_SUCCESS: '自动补全配置已成功写入',
  /** 安装失败或未知的 shell 提示 */
  COMPLETION_INSTALL_UNKNOWN_SHELL: '未知的 Shell 环境或无法自动安装，请手动配置。',
  /** 补全配置已存在提示 */
  COMPLETION_INSTALL_EXISTS: '自动补全配置已存在于目标文件中',
  /** 提示用户重启生效 */
  COMPLETION_INSTALL_RESTART: (filePath: string) => `请重启终端或运行 \`source ${filePath}\` 以使补全生效。`,
  /** 安装写入失败提示 */
  COMPLETION_INSTALL_WRITE_ERROR: (filePath: string) => `无法写入文件 ${filePath}，请检查文件权限或手动配置。`,
} as const;
