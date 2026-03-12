/** 项目级配置（存储在 ~/.clawt/projects/<projectName>/config.json） */
export interface ProjectConfig {
  /** 主 worktree 的工作分支名 */
  clawtMainWorkBranch: string;
  /** validate 成功后自动执行的命令（-r 的默认值） */
  validateRunCommand?: string;
  /** worktree 创建后自动执行的命令，用于安装依赖等初始化操作 */
  postCreate?: string;
}

/** 单个项目配置项的完整定义（默认值 + 描述） */
export interface ProjectConfigItemDefinition<T> {
  /** 默认值 */
  defaultValue: T;
  /** 配置项描述，用于交互式面板展示 */
  description: string;
  /** 可选：允许的枚举值列表，仅对 string 类型有效 */
  allowedValues?: T extends string ? readonly string[] : never;
}

/** 所有项目配置项的完整定义映射 */
export type ProjectConfigDefinitions = {
  [K in keyof Required<ProjectConfig>]: ProjectConfigItemDefinition<ProjectConfig[K]>;
};
