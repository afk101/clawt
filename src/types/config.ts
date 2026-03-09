/** clawt 全局配置 */
export interface ClawtConfig {
  /** 移除 worktree 时是否自动删除对应本地分支 */
  autoDeleteBranch: boolean;
  /** Claude Code CLI 启动指令（不传 --tasks 时在 worktree 中直接打开交互式界面） */
  claudeCodeCommand: string;
  /** merge 成功后是否自动执行 git pull 和 git push */
  autoPullPush: boolean;
  /** 执行破坏性操作（reset、validate --clean）前是否提示确认 */
  confirmDestructiveOps: boolean;
  /** run 命令默认最大并发数，0 表示不限制 */
  maxConcurrency: number;
  /** 批量 resume 使用的终端应用：'auto'（自动检测）、'iterm2'、'terminal'（macOS） */
  terminalApp: string;
  /** resume 单选时是否在当前终端就地打开，false 则通过 terminalApp 在新 Tab 中打开 */
  resumeInPlace: boolean;
  /** 命令别名映射，键为别名，值为目标内置命令名 */
  aliases: Record<string, string>;
  /** 是否启用自动更新检查 */
  autoUpdate: boolean;
  /** merge 冲突时的解决模式：ask（询问）、auto（自动 AI 解决）、manual（手动解决） */
  conflictResolveMode: string;
}

/** 单个配置项的完整定义（默认值 + 描述） */
export interface ConfigItemDefinition<T> {
  /** 默认值 */
  defaultValue: T;
  /** 配置项描述，用于 config 命令展示 */
  description: string;
  /** 可选：允许的枚举值列表，仅对 string 类型有效 */
  allowedValues?: T extends string ? readonly string[] : never;
}

/** 所有配置项的完整定义映射 */
export type ConfigDefinitions = {
  [K in keyof ClawtConfig]: ConfigItemDefinition<ClawtConfig[K]>;
};
