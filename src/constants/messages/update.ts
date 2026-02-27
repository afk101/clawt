/** 各包管理器对应的全局安装命令 */
export const UPDATE_COMMANDS: Record<string, string> = {
  npm: 'npm i -g clawt',
  pnpm: 'pnpm add -g clawt',
  yarn: 'yarn global add clawt',
} as const;

/** 更新检查相关提示消息 */
export const UPDATE_MESSAGES = {
  /** 版本更新提示 */
  UPDATE_AVAILABLE: (currentVersion: string, latestVersion: string) =>
    `clawt 有新版本可用: ${currentVersion} → ${latestVersion}`,
  /** 更新操作提示 */
  UPDATE_HINT: (command: string) => `执行 ${command} 进行更新`,
} as const;
