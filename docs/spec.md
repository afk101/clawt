# Clawt - Software Specification


> 一个深度融合 Git Worktree 与 Claude Code CLI 的命令行工具，基于本地 Git 项目创建多个隔离的 worktree 环境，并行执行多个 Claude Code Agent 任务，所有 Agent 的代码修改互不干扰。

---

## 目录

- [1. 技术栈](#1-技术栈)
- [2. 核心概念](#2-核心概念)
  - [2.5 验证分支](#25-验证分支)
  - [2.6 项目级配置](#26-项目级配置)（详见 [project-config.md](./project-config.md)）
  - [2.7 通用交互式配置编辑器](#27-通用交互式配置编辑器)
- [3. 全局目录结构](#3-全局目录结构)
- [4. 命令总览](#4-命令总览)
- [5. 需求场景详细设计](#5-需求场景详细设计)
  - [5.1 批量创建 Worktree](./create.md)
  - [5.2 批量创建 Worktree + 执行 Claude Code 任务](./run.md)
  - [5.3 任务完成通知机制](./notification.md)
  - [5.4 在主 Worktree 验证其他分支](./validate.md)
  - [5.5 移除 Worktree](./remove.md)
  - [5.6 合并验证过的分支](./merge.md)
  - [5.7 默认配置文件](./config-file.md)
  - [5.8 获取当前项目所有 Worktree](./list.md)
  - [5.9 日志系统](./log.md)
  - [5.10 交互式查看和修改全局配置](./config.md)
  - [5.11 在已有 Worktree 中恢复会话](./resume.md)
  - [5.12 将主分支代码同步到目标 Worktree](./sync.md)
  - [5.13 重置主 Worktree 工作区和暂存区](./reset.md)
  - [5.14 项目全局状态总览](./status.md)
  - [5.15 命令别名管理](./alias.md)
  - [5.16 Shell 自动补全](./completion.md)
  - [5.17 自动更新检查](./update-check.md)
  - [5.18 跨项目 Worktree 概览](./projects.md)
  - [5.19 初始化项目级配置](./init.md)
  - [5.20 切换回主工作分支](./home.md)
  - [5.21 将验证分支修改覆盖回目标 Worktree](./cover-validate.md)
- [6. 验证架构规则](#6-验证架构规则)
- [7. 错误处理规范](#7-错误处理规范)
- [8. 非功能性需求](#8-非功能性需求)
  - [8.1 性能](#81-性能)
  - [8.2 兼容性](#82-兼容性)
  - [8.3 测试](#83-测试)
  - [8.4 安全性](#84-安全性)

---

## 1. 技术栈

| 类别     | 选型                          |
| -------- | ----------------------------- |
| 运行时   | Node.js >= 18                 |
| 语言     | TypeScript                    |
| 包管理   | pnpm                          |
| CLI 框架 | Commander.js                  |
| 日志库   | winston (按日期滚动文件)       |
| 交互式   | enquirer (选项选择/确认对话)   |
| 终端宽度 | string-width (ANSI 安全的字符宽度计算) |
| 测试     | Vitest + @vitest/coverage-v8               |
| 构建     | tsup / tsc                    |
| 分发     | pnpm 全局安装 (`pnpm add -g clawt`) |

---

## 2. 核心概念

### 2.1 "主 Worktree" 的定义与定位规则

**主 worktree** = `git rev-parse --git-common-dir` 所在的原始 worktree。

**强制约束：**

- `clawt` 命令 **只能** 在主 worktree 的仓库**根目录**执行。
- 校验条件：`git rev-parse --git-common-dir === ".git"`
  - 如果不等于 `.git`（例如返回了绝对路径如 `/xxx/.git`），说明当前目录是子 worktree 或子目录，必须拒绝执行并提示用户。
- 还需校验当前目录是否为仓库根目录（存在 `.git` 目录）。

**校验伪代码：**

```typescript
const gitCommonDir = execSync('git rev-parse --git-common-dir').toString().trim();
if (gitCommonDir !== '.git') {
  // 报错：请在主 worktree 的根目录下执行 clawt
  process.exit(1);
}
```

### 2.2 项目名获取

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

等价 TypeScript：

```typescript
const projectRoot = execSync('git rev-parse --show-toplevel').toString().trim();
const projectName = path.basename(projectRoot);
```

### 2.3 分支名合法性校验与转换

用户提供的 `branchName` 需要校验，凡是会影响文件系统路径 `~/.clawt/worktrees/<project>/<branchName>` 的非法字符，一律替换为 `-`。

**非法字符列表（至少包含）：**

| 字符    | 说明                           |
| ------- | ------------------------------ |
| `/`     | 路径分隔符                      |
| `\`     | 路径分隔符（Windows）           |
| `.`     | 可能导致隐藏目录               |
| `..`    | 目录遍历                       |
| ` `     | 空格                           |
| `~`     | Home 目录展开                  |
| `:`     | Windows 驱动器号 / 特殊用途    |
| `*`     | 通配符                         |
| `?`     | 通配符                         |
| `[` `]` | 通配符                         |
| `^`     | Git ref 特殊字符               |

**转换规则：**

1. 将所有非法字符替换为 `-`
2. 将连续的 `-` 压缩为一个 `-`
3. 去除首尾 `-`
4. 如果转换后结果为空串（原始分支名不包含任何合法字符），报错退出

**示例输出：**

```
原始分支名: feature/a.b
实际使用分支名: feature-a-b
```

如果发生了转换，**必须**在终端输出提示告知用户。

### 2.4 分支名存在性校验

创建前先检验分支名是否已经存在：

```bash
git show-ref --verify refs/heads/<branchName> 2>/dev/null
```

- 有输出 → 分支已存在 → 报错并退出
- 无输出 → 分支不存在 → 可以继续

> 注意：当 `n > 1` 时，需要校验的是 `branchName-1`、`branchName-2`、……、`branchName-n` 这些分支名。只要有一个已存在，就报错并退出（在创建任何 worktree 之前完成全部校验）。

### 2.5 验证分支

validate 命令通过创建**验证分支**（validate branch）来杜绝 patch apply 冲突。每个目标 worktree 对应一个验证分支，validate 时在主 worktree 中切换到验证分支后再 apply patch，而不是在主工作分支上直接 apply。

#### 命名规则

验证分支命名格式：`clawt-validate-<原始分支名>`

| 目标分支 | 验证分支 |
| --- | --- |
| `feat-login` | `clawt-validate-feat-login` |
| `fix-bug-1` | `clawt-validate-fix-bug-1` |
| `fix-bug-2` | `clawt-validate-fix-bug-2` |

#### 创建时机

与目标 worktree 分支同时创建。在 `git worktree add -b <branchName>` 之后，立即执行：

```bash
git branch clawt-validate-<branchName>
```

验证分支是一个普通的本地分支（不关联 worktree），指向创建时主 worktree 的 HEAD commit。

#### 为什么能杜绝冲突

验证分支在创建后不会被修改（不受主分支 HEAD 推进的影响），它与目标 worktree 的分支共享同一个创建基点。因此 `git diff HEAD...<branchName> --binary` 中的 HEAD（验证分支的 HEAD）永远与目标分支的分叉点一致，patch apply 永远不会冲突。

#### 生命周期

验证分支的生命周期与目标 worktree 的分支**完全一致**：

| 事件 | 目标分支 | 验证分支 |
| --- | --- | --- |
| create / run | 创建 | 同步创建 |
| remove（用户选择删除分支） | 删除 | 同步删除 |
| remove（用户选择保留分支） | 保留 | 保留 |
| merge 后清理（用户确认） | 删除 | 同步删除 |
| merge 后清理（用户拒绝） | 保留 | 保留 |
| sync | 不变 | 重建（删除后重新创建，基于当前主分支 HEAD） |

#### 验证分支前缀常量

在 `src/constants/branch.ts` 中新增：

```typescript
/** 验证分支名前缀 */
export const VALIDATE_BRANCH_PREFIX = 'clawt-validate-';
```

### 2.6 项目级配置

每个 Git 项目独立的 clawt 配置，存放在 `~/.clawt/projects/<projectName>/config.json`。包含项目的主工作分支名（`clawtMainWorkBranch`）、validate 自动运行命令（`validateRunCommand`）等配置项。通过 `clawt init` 命令设置，核心命令执行前会校验该配置是否存在。

详细的配置项列表、类型定义、工具函数和设置方式见 [项目级配置文档](./project-config.md)。

### 2.7 通用交互式配置编辑器

`interactiveConfigEditor`（`src/utils/config-strategy.ts`）是一个通用的交互式配置编辑函数，供全局配置（`config` 命令）和项目级配置（`init show` 子命令）复用。

**函数签名：**

```typescript
async function interactiveConfigEditor<T extends object>(
  config: T,
  definitions: Record<string, { description: string; allowedValues?: readonly string[] }>,
  options?: { selectPrompt?: string; disabledKeys?: Record<string, string> },
): Promise<{ key: keyof T; newValue: unknown }>
```

**参数说明：**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `config` | `T` | 当前配置对象 |
| `definitions` | `Record<string, { description; allowedValues? }>` | 配置项定义映射（含描述和可选枚举值） |
| `options.selectPrompt` | `string` | 可选，选择配置项的提示语（默认使用全局配置的提示语） |
| `options.disabledKeys` | `Record<string, string>` | 可选，不可编辑的键及其禁用提示文本 |

**行为：**

1. 根据 `definitions` 构建选择列表，显示配置项名称、当前值（通过 `formatConfigValue` 格式化）和描述
2. `disabledKeys` 中的配置项标灰不可选，显示禁用提示
3. 用户选择配置项后，根据值类型自动选择输入方式（布尔 → Select、数字 → Input、字符串+枚举 → Select、字符串 → Input）
4. 返回用户修改的 key 和新值，由调用方负责持久化

**调用场景：**

- `config` 命令：传入 `loadConfig()` + `CONFIG_DEFINITIONS` + `disabledKeys`（对象类型配置项禁用）
- `init show`：传入 `requireProjectConfig()` + `PROJECT_CONFIG_DEFINITIONS` + `selectPrompt`

同时，`promptConfigValue` 和 `formatConfigValue` 的类型签名已从 `ClawtConfig` 专用类型放宽为通用类型（`string` / `unknown`），以支持不同配置体系复用。`formatConfigValue` 新增了 `undefined` / `null` 值的处理，显示为暗淡色的 `(未设置)`。

---

## 3. 全局目录结构

```
~/.clawt/
├── config.json                          # 全局配置文件
├── update-check.json                    # 更新检查缓存文件（自动生成）
├── logs/                                # 日志目录
│   ├── clawt-2025-02-06.log
│   └── ...
├── validate-snapshots/                  # validate 快照目录
│   └── <project-name>/                  # 以项目名分组
│       ├── <branchName>.tree            # 每个分支一个 tree hash 快照文件（存储 git tree 对象的 hash）
│       ├── <branchName>.head            # 每个分支一个 HEAD commit hash 快照文件（存储快照时验证分支的 HEAD commit hash）
│       ├── <branchName>.staged          # 每个分支一个 staged tree hash 快照文件（存储 validate 结束时暂存区对应的 tree hash，用于无变更时恢复）
│       └── ...
├── projects/<project-name>/             # 项目级配置目录
│   └── config.json                      # 项目级配置（含 clawtMainWorkBranch）
└── worktrees/                           # 所有 worktree 的统一存放目录
    └── <project-name>/                  # 以项目名分组
        ├── <branchName>/                # n=1 时直接使用分支名
        ├── <branchName>-1/              # n>1 时使用后缀编号
        ├── <branchName>-2/
        └── ...
```

**注意：** 不需要支持多个不同路径下同名 repo 的区分。如果两个不同目录都叫 `main-project`，不做处理（视为同一个项目）。

---

## 4. 命令总览

| 命令                  | 说明                                           | 对应场景 |
| --------------------- | ---------------------------------------------- | -------- |
| `clawt init`          | 初始化项目级配置，设置主工作分支                     | 5.19     |
| `clawt create`        | 批量创建 worktree 及对应分支（含验证分支）            | 5.1      |
| `clawt run`           | 批量创建 worktree + 启动 Claude Code 执行任务（支持任务文件）    | 5.2      |
| `clawt validate`      | 在主 worktree 验证某个 worktree 分支的变更（通过验证分支）| 5.4      |
| `clawt merge`         | 合并某个已验证的 worktree 分支到主 worktree       | 5.6      |
| `clawt remove`        | 移除 worktree（支持模糊匹配/多选/全部）             | 5.5      |
| `clawt list`          | 列出当前项目所有 worktree（支持 `--json` 格式输出） | 5.8      |
| `clawt config`        | 交互式查看和修改全局配置（等同于 `config set`）      | 5.10     |
| `clawt config set`    | 修改配置项（无参数进入交互式，有参数直接设置）          | 5.10     |
| `clawt config get`    | 获取单个配置项的值                                 | 5.10     |
| `clawt config reset`  | 将配置恢复为默认值                                | 5.10     |
| `clawt resume`        | 在已有 worktree 中恢复 Claude Code 会话（支持多选批量恢复） | 5.11     |
| `clawt sync`          | 将主分支最新代码同步到目标 worktree（含验证分支重建）    | 5.12     |
| `clawt reset`         | 重置主 worktree 工作区和暂存区                       | 5.13     |
| `clawt status`        | 显示项目全局状态总览（支持 `--json` 格式输出和 `-i` 交互式面板模式）| 5.14     |
| `clawt alias`         | 管理命令别名（列出 / 设置 / 移除）                       | 5.15     |
| `clawt completion`    | 为终端提供 shell 自动补全功能（bash/zsh）              | 5.16     |
| `clawt projects`      | 展示所有项目的 worktree 概览，或查看指定项目的 worktree 详情 | 5.17     |
| `clawt home`          | 快速切换回主工作分支                                      | 5.20     |
| `clawt cover`         | 将验证分支上的修改覆盖回目标 worktree（自动推导目标分支）     | 5.21     |

**全局选项：**

| 选项      | 说明                                     |
| --------- | ---------------------------------------- |
| `--debug` | 输出详细调试信息到终端（启用 Console transport） |

所有命令执行前，都必须先执行**主 worktree 校验**（见 [2.1](#21-主-worktree-的定义与定位规则)）。

---

## 5. 需求场景详细设计


- [5.1 批量创建 Worktree](./create.md)
- [5.2 批量创建 Worktree + 执行 Claude Code 任务](./run.md)
- [5.3 任务完成通知机制](./notification.md)
- [5.4 在主 Worktree 验证其他分支](./validate.md)
- [5.5 移除 Worktree](./remove.md)
- [5.6 合并验证过的分支](./merge.md)
- [5.7 默认配置文件](./config-file.md)
- [5.8 获取当前项目所有 Worktree](./list.md)
- [5.9 日志系统](./log.md)
- [5.10 交互式查看和修改全局配置](./config.md)
- [5.11 在已有 Worktree 中恢复会话](./resume.md)
- [5.12 将主分支代码同步到目标 Worktree](./sync.md)
- [5.13 重置主 Worktree 工作区和暂存区](./reset.md)
- [5.14 项目全局状态总览](./status.md)
- [5.15 命令别名管理](./alias.md)
- [5.16 Shell 自动补全](./completion.md)
- [5.17 自动更新检查](./update-check.md)
- [5.18 跨项目 Worktree 概览](./projects.md)
- [5.19 初始化项目级配置](./init.md)
- [5.20 切换回主工作分支](./home.md)
- [5.21 将验证分支修改覆盖回目标 Worktree](./cover-validate.md)

---

## 6. 验证架构规则

以下规则适用于验证分支架构的所有实现工作：

1. **不兼容旧版本**：本次重构不考虑旧版本数据、旧版本创建的 worktree 或旧版本配置的兼容性。所有命令均假定验证分支和项目级配置已按新架构存在。用户需删除旧 worktree 后重新创建。
2. **项目级配置前置校验**：仅对 create、run、validate、cover、sync、remove、merge、reset、home 这 9 个核心命令添加检测，执行时必须先检查项目级配置（`~/.clawt/projects/<projectName>/config.json`）是否存在且包含 `clawtMainWorkBranch`。如果不存在，直接报错退出并提示用户先执行 `clawt init`：
   ```
   ✗ 该项目尚未初始化，请先执行 clawt init -b<branchName>设置主工作分支
   ```
   其他命令（list、resume、config、status、alias、projects、completion）不受影响，无需添加该校验。
   > **实现细节**：`ensureOnMainWorkBranch()` 内部已通过 `getMainWorkBranch()` → `requireProjectConfig()` 完成了项目配置校验，因此调用了 `ensureOnMainWorkBranch` 的命令（create、run、validate、merge）**无需再显式调用 `requireProjectConfig()`**，避免重复校验。sync、remove 和 cover 命令因不依赖主 worktree 的分支状态而不调用 `ensureOnMainWorkBranch`，需自行显式调用 `requireProjectConfig()`。reset 和 home 命令同理，也需自行调用 `requireProjectConfig()`。
3. **主分支名统一从项目级配置获取**：所有需要获取主分支名的场景（sync 中合并主分支、merge 中计算 merge-base、切回主分支等），统一使用项目级配置中的 `clawtMainWorkBranch`，不再通过 `getCurrentBranch(mainWorktreePath)` 动态获取。因为在新架构下，主 worktree 可能处于验证分支上，`getCurrentBranch` 会返回验证分支名而非真正的主工作分支名。
4. **测试文件全量更新**：本次重构涉及的所有命令（init、create、run、validate、sync、remove、merge、reset），其对应的测试文件必须同步更新，确保覆盖新增的验证分支逻辑、项目级配置逻辑和变更后的流程。

---

## 7. 错误处理规范

### 7.1 通用错误处理

| 错误场景                          | 处理方式                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| 不在主 worktree 根目录执行         | 输出错误提示，退出 (exit code 1)                            |
| Git 未安装                        | 输出错误提示，退出 (exit code 1)                            |
| Claude Code CLI 未安装            | 输出错误提示，退出 (exit code 1)（`clawt run` 和 `clawt resume` 时检测）    |
| 分支已存在                        | 输出错误提示，退出 (exit code 1)                            |
| Worktree 路径已存在               | 输出错误提示，退出 (exit code 1)                            |
| Git 命令执行失败                  | 捕获 stderr，记录日志，输出错误提示，退出 (exit code 1)      |
| 目标 worktree 不存在              | 输出错误提示（列出可用 worktree），退出 (exit code 1)        |

### 7.2 退出码

| 退出码 | 说明           |
| ------ | -------------- |
| `0`    | 成功           |
| `1`    | 一般错误       |
| `2`    | 参数错误       |

---

## 8. 非功能性需求

### 8.1 性能

- Worktree 创建为串行执行（Git worktree 不支持并行写入）
- Claude Code 任务为并行执行（各自独立进程）
- 任务完成检测：监听子进程 `close` 事件，事件驱动

### 8.2 兼容性

- 支持 macOS 和 Linux
- Node.js >= 18
- Git >= 2.15（worktree 功能稳定版本）

### 8.3 测试

- 测试框架：Vitest，配置文件为 `vitest.config.ts`
- 覆盖率工具：@vitest/coverage-v8，覆盖率报告格式为 text、lcov、html
- 测试目录结构：`tests/unit/` 下按模块分组（`constants/`、`errors/`、`utils/`）
- 测试辅助文件：
  - `tests/helpers/setup.ts`：全局 setup，禁用 chalk 颜色输出避免 ANSI 转义码干扰断言
  - `tests/helpers/fixtures.ts`：测试数据工厂，提供 `createWorktreeInfo()`、`createWorktreeStatus()`、`createWorktreeList()` 等工厂函数
- 覆盖范围：`src/` 下的 `commands/`、`utils/`、`errors/`、`constants/` 全部关键模块
- 覆盖率统计排除项：`src/index.ts`（入口文件）、`src/types/**`（类型定义）、`src/logger/**`（日志模块）
- npm 脚本：
  - `npm test`：执行全部测试（`vitest run`）
  - `npm run test:watch`：监听模式（`vitest`）
  - `npm run test:coverage`：执行测试并生成覆盖率报告（`vitest run --coverage`）
- 测试配置特性：
  - `restoreMocks: true`：每个测试后自动恢复 mock
  - `clearMocks: true`：每个测试后自动清除 mock 调用记录
  - `testTimeout: 10000`：单个测试超时 10 秒
  - `environment: 'node'`：使用 Node.js 测试环境

### 8.4 安全性

- 不在日志中记录 Claude Code API 密钥等敏感信息
- `--permission-mode bypassPermissions` 仅在 worktree 隔离环境中使用
- 所有用户输入（分支名等）都需要校验和转义
