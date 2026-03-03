### 项目级配置

#### 概述

项目级配置是每个 Git 项目独立的 clawt 配置，用于记录该项目特有的设置（如主工作分支名、validate 自动运行命令等）。与全局配置（`~/.clawt/config.json`，见 [config-file.md](./config-file.md)）不同，项目级配置按项目隔离存储。

#### 存放路径

```
~/.clawt/projects/<projectName>/config.json
```

其中 `<projectName>` 为项目根目录的目录名（通过 `git rev-parse --show-toplevel` 获取后取 `basename`）。

#### 配置项列表

```json
{
  "clawtMainWorkBranch": "main",
  "validateRunCommand": "npm test"
}
```

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `clawtMainWorkBranch` | `string` | 是 | `""` | 项目的主工作分支名，用于 create 时检测当前分支是否为主分支，以及 sync、merge 等命令获取主分支名 |
| `validateRunCommand` | `string` | 否 | `undefined` | validate 成功后自动执行的命令（作为 `-r` 选项的默认值）。不传 `-r` 时，validate 命令会自动从此项读取 |

#### 配置项定义数据源

项目级配置项的完整定义集中在 `src/constants/project-config.ts` 中的 `PROJECT_CONFIG_DEFINITIONS` 常量，作为**单一数据源**（Single Source of Truth）。新增项目配置项只需在此处维护，`PROJECT_DEFAULT_CONFIG` 和 `PROJECT_CONFIG_DESCRIPTIONS` 会自动从中派生：

```typescript
// src/constants/project-config.ts

export const PROJECT_CONFIG_DEFINITIONS: ProjectConfigDefinitions = {
  clawtMainWorkBranch: {
    defaultValue: '',
    description: '主 worktree 的工作分支名',
  },
  validateRunCommand: {
    defaultValue: undefined as unknown as string | undefined,
    description: 'validate 成功后自动执行的命令（-r 的默认值）',
  },
};

/** 项目默认配置（从 PROJECT_CONFIG_DEFINITIONS 自动派生） */
export const PROJECT_DEFAULT_CONFIG: Required<ProjectConfig> = deriveDefaultConfig(PROJECT_CONFIG_DEFINITIONS);

/** 项目配置项描述映射（从 PROJECT_CONFIG_DEFINITIONS 自动派生） */
export const PROJECT_CONFIG_DESCRIPTIONS: Record<keyof Required<ProjectConfig>, string> = deriveConfigDescriptions(PROJECT_CONFIG_DEFINITIONS);
```

#### 相关类型定义

类型定义位于 `src/types/projectConfig.ts`：

| 类型 | 说明 |
| --- | --- |
| `ProjectConfig` | 项目级配置接口，包含 `clawtMainWorkBranch`（必填）和 `validateRunCommand`（可选） |
| `ProjectConfigItemDefinition<T>` | 单个配置项定义，含 `defaultValue`（默认值）、`description`（描述）、可选 `allowedValues`（枚举值列表，仅对 string 类型有效） |
| `ProjectConfigDefinitions` | 所有配置项的完整定义映射，键为 `ProjectConfig` 的所有属性名，值为对应的 `ProjectConfigItemDefinition` |

```typescript
// src/types/projectConfig.ts

export interface ProjectConfig {
  clawtMainWorkBranch: string;
  validateRunCommand?: string;
}

export interface ProjectConfigItemDefinition<T> {
  defaultValue: T;
  description: string;
  allowedValues?: T extends string ? readonly string[] : never;
}

export type ProjectConfigDefinitions = {
  [K in keyof Required<ProjectConfig>]: ProjectConfigItemDefinition<ProjectConfig[K]>;
};
```

#### 工具函数

工具函数位于 `src/utils/project-config.ts`：

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `getProjectConfigPath` | `(projectName: string) => string` | 获取项目配置文件的完整路径 |
| `loadProjectConfig` | `() => ProjectConfig \| null` | 加载当前项目的配置，配置文件不存在或解析失败时返回 `null` |
| `saveProjectConfig` | `(config: ProjectConfig) => void` | 保存项目配置到文件，自动创建项目子目录 |
| `requireProjectConfig` | `() => ProjectConfig` | 获取当前项目配置，不存在或缺少 `clawtMainWorkBranch` 时抛出 `ClawtError` |
| `getMainWorkBranch` | `() => string` | 从项目配置中获取主工作分支名（内部调用 `requireProjectConfig`） |
| `getValidateRunCommand` | `() => string \| undefined` | 从项目配置中获取 validate 自动执行命令，未配置时返回 `undefined` |

#### 设置方式

通过 `clawt init` 命令设置（详见 [init.md](./init.md)）：

```bash
# 以当前分支作为主工作分支初始化
clawt init

# 指定主工作分支名
clawt init -b <branchName>

# 交互式查看和修改所有项目配置项
clawt init show
```

`init show` 子命令调用通用的 `interactiveConfigEditor`（`src/utils/config-strategy.ts`），基于 `PROJECT_CONFIG_DEFINITIONS` 构建配置项列表，提供交互式面板供用户查看和修改所有项目配置项。

#### 前置校验

除 `clawt init` 以外的所有核心命令（create、run、validate、sync、remove、merge、reset），执行时都会校验项目级配置是否存在。如果未执行过 `clawt init`，命令会直接报错并提示用户先初始化：

```
✗ 该项目尚未初始化，请先执行 clawt init -b<branchName>设置主工作分支
```

> **实现细节**：`ensureOnMainWorkBranch()` 内部已通过 `getMainWorkBranch()` -> `requireProjectConfig()` 完成了项目配置校验，因此调用了 `ensureOnMainWorkBranch` 的命令（create、run、validate、sync、remove、merge）无需再显式调用 `requireProjectConfig()`，避免重复校验。仅 reset 命令因不调用 `ensureOnMainWorkBranch`，需要自行调用 `requireProjectConfig()`。

#### 路径常量

在 `src/constants/paths.ts` 中定义：

```typescript
/** 项目级配置目录 ~/.clawt/projects/ */
export const PROJECTS_CONFIG_DIR = join(CLAWT_HOME, 'projects');
```

---
