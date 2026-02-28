# Clawt - Software Specification


> 一个深度融合 Git Worktree 与 Claude Code CLI 的命令行工具，基于本地 Git 项目创建多个隔离的 worktree 环境，并行执行多个 Claude Code Agent 任务，所有 Agent 的代码修改互不干扰。

---

## 目录

- [1. 技术栈](#1-技术栈)
- [2. 核心概念](#2-核心概念)
  - [2.5 验证分支](#25-验证分支)
  - [2.6 项目级配置](#26-项目级配置)
- [3. 全局目录结构](#3-全局目录结构)
- [4. 命令总览](#4-命令总览)
- [5. 需求场景详细设计](#5-需求场景详细设计)
  - [5.1 批量创建 Worktree](#51-批量创建-worktreeworktree-对应分支)
  - [5.2 批量创建 Worktree + 执行 Claude Code 任务](#52-批量创建-worktree--执行-claude-code-任务)
  - [5.3 任务完成通知机制](#53-任务完成通知机制)
  - [5.4 在主 Worktree 验证其他分支](#54-在主-worktree-验证其他分支)
  - [5.5 移除 Worktree](#55-移除-worktree)
  - [5.6 合并验证过的分支](#56-合并验证过的分支)
  - [5.7 默认配置文件](#57-默认配置文件)
  - [5.8 获取当前项目所有 Worktree](#58-获取当前项目所有-worktree)
  - [5.9 日志系统](#59-日志系统)
  - [5.10 交互式查看和修改全局配置](#510-交互式查看和修改全局配置)
  - [5.11 在已有 Worktree 中恢复会话](#511-在已有-worktree-中恢复会话)
  - [5.12 将主分支代码同步到目标 Worktree](#512-将主分支代码同步到目标-worktree)
  - [5.13 重置主 Worktree 工作区和暂存区](#513-重置主-worktree-工作区和暂存区)
  - [5.14 项目全局状态总览](#514-项目全局状态总览)
  - [5.15 命令别名管理](#515-命令别名管理)
  - [5.16 Shell 自动补全](#516-clawt-completion-命令)
  - [5.17 自动更新检查](#517-自动更新检查)
  - [5.18 跨项目 Worktree 概览](#518-跨项目-worktree-概览)
  - [5.19 初始化项目级配置](#519-初始化项目级配置)
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

#### 存放位置

```
~/.clawt/projects/<projectName>/config.json
```

#### 配置内容

```json
{
  "clawtMainWorkBranch": "main"
}
```

| 配置项 | 类型 | 说明 |
| --- | --- | --- |
| `clawtMainWorkBranch` | `string` | 项目的主工作分支名，用于 create 时检测当前分支是否为主分支 |

#### 设置方式

通过 `clawt init` 命令设置（见 [5.19 初始化项目级配置](#519-初始化项目级配置)）。

除 `clawt init` 以外的所有核心命令（create、run、validate、sync、remove、merge、reset），执行时都会校验项目级配置是否存在。如果未执行过 `clawt init`，命令会直接报错并提示用户先初始化。

#### 路径常量

在 `src/constants/paths.ts` 中新增：

```typescript
/** 项目级配置目录 ~/.clawt/projects/ */
export const PROJECTS_CONFIG_DIR = join(CLAWT_HOME, 'projects');
```

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
| `clawt status`        | 显示项目全局状态总览（支持 `--json` 格式输出）          | 5.14     |
| `clawt alias`         | 管理命令别名（列出 / 设置 / 移除）                       | 5.15     |
| `clawt completion`    | 为终端提供 shell 自动补全功能（bash/zsh）              | 5.16     |
| `clawt projects`      | 展示所有项目的 worktree 概览，或查看指定项目的 worktree 详情 | 5.17     |

**全局选项：**

| 选项      | 说明                                     |
| --------- | ---------------------------------------- |
| `--debug` | 输出详细调试信息到终端（启用 Console transport） |

所有命令执行前，都必须先执行**主 worktree 校验**（见 [2.1](#21-主-worktree-的定义与定位规则)）。

---

## 5. 需求场景详细设计

### 5.1 批量创建 Worktree（Worktree 对应分支）

**命令：**

```bash
clawt create -b <branchName> [-n <count>]
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b` | 是   | 分支名                                                |
| `-n` | 否   | 需要创建的 worktree 数量，默认 `1`                      |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. **主工作分支检测**：在创建 worktree 之前，检测当前 HEAD 所在分支是否为配置的主工作分支（`clawtMainWorkBranch`）。
   - 读取项目级配置（如果配置不存在，由前置校验拦截，见 [第 6 章规则 2](#6-验证架构规则)）
   - 如果当前分支**是** `clawtMainWorkBranch`，正常继续
   - 如果当前在**验证分支**（`clawt-validate-` 前缀）上：
     - 验证分支上的修改视为可丢弃的临时状态
     - 如果工作区有未提交更改，自动执行 `git reset --hard HEAD && git clean -fd` 清理
     - 然后自动切换到主工作分支，继续创建流程
   - 如果当前在**其他普通分支**上：
     - 如果全局配置 `warnBranchOnCreate` 为 `false`，跳过分支切换提醒
     - 否则，黄色提醒并交互确认：
       ```
       ⚠ 当前不在主工作分支上，即将切换到主工作分支 main 来创建新的 worktree

       ❯ yes (确认切换并创建)
         no  (取消)
       ```
     - 用户选择 no → 退出
     - 用户选择 yes 或 `warnBranchOnCreate` 为 `false` → 继续下一步
   - 切换前**检测工作区脏状态**：如果当前分支有未提交的更改，提供交互式选择（避免将修改意外带到主工作分支上）：
     ```
     ⚠ 当前分支有未提交的更改，请选择处理方式：

     ❯ reset (推荐) - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)
       stash        - 暂存更改 (git add . && git stash push -m "clawt:auto-stash")
       exit         - 退出，手动处理
     ```
     - 选择 reset → 执行 `git reset --hard HEAD && git clean -fd`
     - 选择 stash → 执行 `git add . && git stash push -m "clawt:auto-stash"`
     - 选择 exit → 抛出错误退出
     - 处理完成后再次校验工作区是否干净，不干净则报错退出
   - 执行 `git checkout <clawtMainWorkBranch>`，然后继续创建流程
4. **分支名合法性校验与转换** (2.3)
5. **分支名存在性校验** (2.4)
   - 若 `n = 1`：校验 `branchName`
   - 若 `n > 1`：校验 `branchName-1` 到 `branchName-n`
   - 所有分支名在创建任何 worktree **之前**完成全部校验
6. **批量创建 worktree + 验证分支**
   - 若 `n = 1`：
     ```bash
     git worktree add -b <branchName> ~/.clawt/worktrees/<project>/<branchName>
     git branch clawt-validate-<branchName>
     ```
   - 若 `n > 1`：
     ```bash
     git worktree add -b <branchName>-1 ~/.clawt/worktrees/<project>/<branchName>-1
     git branch clawt-validate-<branchName>-1
     git worktree add -b <branchName>-2 ~/.clawt/worktrees/<project>/<branchName>-2
     git branch clawt-validate-<branchName>-2
     ...
     git worktree add -b <branchName>-n ~/.clawt/worktrees/<project>/<branchName>-n
     git branch clawt-validate-<branchName>-n
     ```
7. **输出创建日志**

**输出格式：**

```
✓ 已创建 3 个 worktree

目录路径1：
  ~/.clawt/worktrees/main-project/feature-scheme-1
  分支名: feature-scheme-1
  验证分支: clawt-validate-feature-scheme-1
────────────────────────────────────────
目录路径2：
  ~/.clawt/worktrees/main-project/feature-scheme-2
  分支名: feature-scheme-2
  验证分支: clawt-validate-feature-scheme-2
────────────────────────────────────────
目录路径3：
  ~/.clawt/worktrees/main-project/feature-scheme-3
  分支名: feature-scheme-3
  验证分支: clawt-validate-feature-scheme-3
────────────────────────────────────────
```

---

### 5.2 批量创建 Worktree + 执行 Claude Code 任务

> **注意：** run 命令内部调用 `createWorktrees` 或 `createWorktreesByBranches`，因此验证分支的创建和主工作分支检测逻辑（包括工作区脏状态处理）**自动继承** create 命令的变更，无需额外修改 run 命令本身。

**命令：**

```bash
# 方式一：通过 --tasks 参数直接指定任务（多任务并行）
clawt run -b <branchName> --tasks <task1> --tasks <task2> --tasks <task3>

# 方式二：通过 -f 从任务文件读取任务列表
clawt run -f <path>

# 方式三：不传 --tasks 也不传 -f，在 worktree 中打开 Claude Code 交互式界面
clawt run -b <branchName>
```

**参数：**

| 参数      | 必填 | 说明                                                        |
| --------- | ---- | ----------------------------------------------------------- |
| `-b`      | 否   | 分支名（使用 `-f` 时可选，否则必填）                          |
| `--tasks` | 否   | 任务描述（可多次指定，每个 --tasks 对应一个任务，任务数量即 worktree 数量）。不传则在 worktree 中打开 Claude Code 交互式界面 |
| `-f`      | 否   | 从任务文件读取任务列表（与 `--tasks` 互斥）                    |
| `-c`      | 否   | 最大并发数，`0` 表示不限制                                    |
| `--dry-run` | 否 | 试运行模式，仅输出预览信息不实际执行                            |

**互斥约束：**

- `--file` 和 `--tasks` **不能同时使用**
- 非 `-f` 模式必须指定 `-b`

**交互式 Claude Code 界面模式：**

当不传 `--tasks` 也不传 `-f` 时，会创建单个 worktree，然后通过 `spawnSync` + `inherit stdio` 在该 worktree 中直接启动 Claude Code CLI 交互式界面，让用户与 Claude Code 直接交互。

启动命令通过配置项 `claudeCodeCommand`（默认值 `claude`）指定，支持自定义命令及参数。

#### 任务文件格式

任务文件使用嵌入 HTML 注释标签的自定义格式，不限制文件类型，标签外的任何文本都不会被解析。

```markdown
这里可以写任何说明文字，会被忽略

<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现用户登录功能
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch: fix-bug
修复内存泄漏问题
这是多行任务描述
可以写很多行
<!-- CLAWT-TASKS:END -->
```

**格式规则：**

1. **任务块界定**：每个任务用 `<!-- CLAWT-TASKS:START -->` 和 `<!-- CLAWT-TASKS:END -->` 包裹
2. **分支名声明**：块内必须有一行 `# branch: <分支名>`（冒号前后的空格可灵活）
3. **任务描述**：块内除分支名行以外的所有行，合并为任务描述（支持多行）
4. **块外内容忽略**：标签外的任何文本都不会被解析
5. **必填校验**：每个块必须包含任务描述；分支名默认必填，但使用 `-b` 参数时分支名为可选（会被忽略，用 `-b` 值自动编号）

**解析实现：** `src/utils/task-file.ts` 中的 `parseTaskFile()` 和 `loadTaskFile()` 函数，类型定义为 `TaskFileEntry`（`src/types/taskFile.ts`）。

#### 任务文件模式运行流程

使用 `-f` 时的执行路径（`handleRun` → `handleRunFromFile`）：

1. 调用 `loadTaskFile(options.file)` 读取解析文件
2. **有 `-b` 参数**：忽略文件中的分支名，用 `-b` 值自动编号创建 worktree（`createWorktrees(branch, count)`）
3. **无 `-b` 参数**：使用文件中每个任务的独立分支名，先 `sanitizeBranchName` 清理后调用 `createWorktreesByBranches(branches)`
4. 调用 `executeBatchTasks(worktrees, tasks, concurrency)` 执行

#### --tasks 模式运行流程

1. 若传了 `--tasks`，解析得到任务数组 `tasks[]`；若未传，先检测分支是否已存在（已存在则提示使用 `clawt resume -b <branchName>` 恢复会话），然后创建单个 worktree 并启动 Claude Code 交互式界面（流程结束，不进入后续并行执行阶段）
2. `n = tasks.length`
3. 按照 **5.1** 的流程创建 `n` 个 worktree
4. 通过公共函数 `executeBatchTasks`（`src/utils/task-executor.ts`）启动批量任务执行，该函数负责进度面板渲染、SIGINT 中断处理、并发控制和汇总输出。对每个 worktree 并行启动 Claude Code CLI：
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>-<i>
   claude -p "<tasks[i]>" --output-format stream-json --verbose --permission-mode bypassPermissions
   ```
   使用 `stream-json` 格式可实时获取 Claude Code 的流式事件（工具调用、文本输出、最终结果），用于在进度面板中显示每个任务的实时活动描述和结果预览。流式事件解析由 `src/utils/stream-parser.ts` 负责。
5. 进入**事件监听通知**阶段（见 [5.3](#53-任务完成通知机制)）
6. **中断处理（Ctrl+C / SIGINT）**
   - 监听 `SIGINT` 信号，用户按下 Ctrl+C 时触发
   - 向所有正在运行的 Claude Code 子进程发送 `SIGTERM` 终止信号
   - 等待所有子进程退出后，进入清理流程：
     - 如果 `autoDeleteBranch` 为 `true`：自动清理本次创建的所有 worktree 和对应分支
     - 否则：交互式询问用户是否移除刚刚创建的 worktree 和对应分支
       - 用户选择保留时，提示可使用 `clawt remove` 手动清理
   - 清理完成后以退出码 `1` 退出

**注意：** 当 `n = 1` 时（只有一个任务），worktree 目录命名规则同 **5.1**（不加 `-1` 后缀）。

#### `--dry-run` 预览模式

传入 `--dry-run` 时不实际创建 worktree 和执行任务，仅输出预览信息供用户确认。预览由 `printDryRunPreview()`（`src/utils/dry-run.ts`）负责渲染。

**输出格式：**

```
════════════════════════════════════════
  Dry Run 预览
════════════════════════════════════════
任务数: 3 │ 并发数: 不限制 │ Worktree: ~/.clawt/worktrees/project
────────────────────────────────────────
✓ [1/3] feat-login
  路径: ~/.clawt/worktrees/project/feat-login
  任务: 实现登录功能

⚠ [2/3] feat-signup — 分支 feat-signup 已存在
  路径: ~/.clawt/worktrees/project/feat-signup
  任务: 实现注册功能

✓ [3/3] fix-bug
  路径: ~/.clawt/worktrees/project/fix-bug
  任务: 修复内存泄漏

════════════════════════════════════════
✓ 预览完成，无冲突。移除 --dry-run 即可正式执行。
```

**格式规则：**

1. **标题区**：双线分隔符包裹标题 `Dry Run 预览`
2. **摘要行**：任务数、并发数、Worktree 目录路径合并为一行，用灰色 `│` 分隔；交互式模式（无 `--tasks`）会额外追加模式信息
3. **分支列表**：
   - 正常分支：行首绿色 `✓` + 序号 + 青色分支名
   - 冲突分支：行首黄色 `⚠` + 序号 + 黄色分支名 + 灰色 `—` + 黄色警告文本（如 `分支 xxx 已存在`），警告合并在序号行
4. **路径/任务行**：2 空格缩进，灰色标签前缀（`路径:` / `任务:`）
5. **任务描述截断**：超过 70 字符时末尾加 `...`，多行合并为单行
6. **结尾**：双线分隔符后根据冲突情况输出结论——无冲突时绿色 `✓` 提示，有冲突时黄色 `⚠` 警告

**实现要点：**

- 常量定义在 `src/constants/messages/run.ts`（`DRY_RUN_*` 系列）
- `DRY_RUN_WORKTREE_DIR` 前缀为 `Worktree:`（简短形式）
- `truncateTaskDesc()` 负责截断任务描述（最大长度 70 字符）

---

### 5.3 任务完成通知机制

**触发条件：** 通过 `clawt run` 启动了多个 Claude Code 任务后自动进入通知模式。

**机制说明：**

Claude Code CLI 以 `--output-format stream-json --verbose` 运行时，stdout 会持续输出 JSON 行（每行一个事件），包括 `system`、`assistant`（含 `tool_use` 和 `text`）、`user`（含 `tool_result`）等类型。任务结束时输出 `type: "result"` 事件：

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 182809,
  "duration_api_ms": 0,
  "num_turns": 1,
  "result": "xxx",
  "stop_reason": "stop_sequence",
  "session_id": "e771e449-b695-48e7-8006-bbf3f0dd3e98",
  "total_cost_usd": 0,
  "usage": { ... }
}
```

**流式事件解析（`src/utils/stream-parser.ts`）：**

由于 stdout 的 `data` 事件可能在行中间切割，使用 `createLineBuffer()` 行缓冲器拼接完整行后，通过 `parseStreamLine()` 解析为 `StreamEvent` 对象，再由 `parseStreamEvent()` 提取活动信息（`ParsedActivity`）：

- **`tool_use` 类型**：提取工具名和文件路径/命令参数，格式如 `Read index.ts`、`Bash ls -la`
- **`text` 类型**：提取文本片段，格式如 `思考中: 让我分析一下`
- **`result` 类型**：构造 `ClaudeCodeResult` 对象，提取耗时、费用、结果文本等

活动描述文本最大长度为 `ACTIVITY_TEXT_MAX_LENGTH`（30 字符），超出后截断并追加省略号。结果预览文本最大长度为 `RESULT_PREVIEW_MAX_LENGTH`（40 字符）。

**事件监听与通知流程：**

1. 为每个 Claude Code 子进程维护状态（运行中 / 已完成 / 已失败）
2. 监听每个子进程的 `close` 事件（基于 Node.js `ChildProcess` 的事件驱动机制）
3. 当某个子进程触发 `close` 事件时，解析流式输出中最后的 `result` 事件
4. 在主 worktree 的 clawt 终端实时输出通知。TTY 环境下使用进度面板，进度面板每个任务行第二列显示 worktree 路径（终端可点击跳转），运行中显示实时活动描述，完成/失败后显示结果预览：

```
✓ [完成] worktree: ~/.clawt/worktrees/main-project/feature-scheme-1
  分支: feature-scheme-1
  耗时: 182.8s
  花费: $0.05
  结果: success
────────────────────────────────────────
```

5. 先完成的先通知，**不需要**失败重试机制
6. 当所有任务完成后，输出汇总信息：

```
════════════════════════════════════════
全部任务已完成 (3/3)
  成功: 2
  失败: 1
  总耗时: 245.3s
  总花费: $0.15
════════════════════════════════════════
```

#### 进度面板渲染机制

进度面板由 `ProgressRenderer`（`src/utils/progress.ts`）负责渲染，渲染函数拆分到 `src/utils/progress-render.ts`。

**TTY 模式渲染策略（备选屏幕缓冲区）：**

- **进入备选屏幕**：`start()` 时通过 `ALT_SCREEN_ENTER`（`\x1B[?1049h`）进入终端备选屏幕缓冲区，隔离进度面板与主屏幕内容
- **禁用行换行**：通过 `LINE_WRAP_DISABLE`（`\x1B[?7l`）防止超长行自动折行，配合按终端宽度截断保证每行只占一行
- **每帧渲染**：使用 `CLEAR_SCREEN` + `CURSOR_HOME` 清屏后完全重绘，无需计算 `CURSOR_UP` 回退量，不受终端 reflow 影响
- **防闪烁**：每帧渲染使用 Synchronized Output（`SYNC_OUTPUT_START` / `SYNC_OUTPUT_END`），终端缓冲全部输出后一次性刷新
- **行宽截断**：通过 `truncateToTerminalWidth()`（`src/utils/progress-render.ts`）将含 ANSI 转义码的字符串截断到终端可见列数，使用 `string-width` 库正确计算中文/emoji 宽度
- **终端 resize 响应**：监听 `process.stdout` 的 `resize` 事件，窗口宽度变化时立即触发重绘
- **退出时恢复**：`stop()` 时恢复行换行、显示光标、退出备选屏幕，然后在主屏幕上重新输出最终面板状态（备选屏幕内容不保留）
- **异常退出兜底**：注册 `process.on('exit')` 处理器，确保即使异常退出也能恢复终端状态

**任务行格式：**

```
[1/3] /path/to/worktree  ⠹ 运行中 1m23s  Read index.ts
[2/3] /path/to/worktree  ✓ 完成   2m05s  $0.08  任务已成功完成
[3/3] /path/to/worktree  ● 排队中
```

- 第二列为 worktree 路径（`path.padEnd(maxPathWidth)` 对齐）
- 运行中状态：末尾显示实时活动描述文本（如工具名+文件名、思考中+文本片段）
- 完成/失败状态：末尾显示结果预览文本（从 `ClaudeCodeResult.result` 提取，最大 40 字符）

**非 TTY 降级模式：**

- 启动时输出 `[1/3] branch 启动 path`
- 完成时输出 `[1/3] branch ✓ 完成 duration cost detail`（`detail` 优先使用结果预览，无则回退到路径）
- 失败时输出 `[1/3] branch ✗ 失败 duration detail`

---

### 5.4 在主 Worktree 验证其他分支

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt validate -b <branchName> [--clean] [-r <command>]

# 不指定分支名（列出所有分支供选择）
clawt validate [--clean] [-r <command>]
```

**参数：**

| 参数          | 必填 | 说明                                                                     |
| ------------- | ---- | ------------------------------------------------------------------------ |
| `-b`          | 否   | 要验证的 worktree 分支名（支持模糊匹配，不传则列出所有分支供选择）           |
| `--clean`     | 否   | 清理 validate 状态（重置主 worktree 并删除快照）                            |
| `-r, --run`   | 否   | validate 成功后在主 worktree 中执行的命令（如测试、构建等）                  |

> **限制：** 单次只能验证一个分支，不支持批量验证。

**背景说明：**

Git worktree 不会包含 `node_modules`、`.venv` 等依赖文件，每次安装依赖耗时较长。利用 `git diff HEAD...branch --binary`（三点 diff）可以获取目标分支自分叉点以来的全量变更（包含已提交和未提交的修改），将其作为 patch 应用到主 worktree 中进行测试，无需重新安装依赖。

**验证分支机制：**

validate 不再在主工作分支上直接 apply patch，而是先切换到目标分支对应的**验证分支**（`clawt-validate-<branchName>`），再 apply patch。验证分支的 HEAD 不会随主工作分支推进，因此 patch apply 永远不会冲突。详见 [2.5 验证分支](#25-验证分支)。

**快照机制：**

validate 命令引入了**快照（snapshot）机制**来支持增量对比。每次 validate 执行成功后，会将当前全量变更通过 `git write-tree` 保存为 git tree 对象，并将 tree hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），同时将验证分支的 HEAD commit hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.head`），用于增量 validate 时对齐基准。当再次执行 validate 时，如果验证分支 HEAD 未变化（正常情况），通过 `git read-tree` 将上次快照的 tree 对象载入暂存区；如果验证分支 HEAD 已变化（sync 后重建了验证分支），则将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上，避免新旧 tree 基准不同导致 diff 混入 HEAD 变化的内容。最终用户可通过 `git diff` 查看两次 validate 之间的增量差异。

**运行流程：**

#### `--clean` 模式

当指定 `--clean` 选项时，执行清理逻辑后直接返回，不进入常规 validate 流程：

1. **主 worktree 校验** (2.1)
2. **解析目标 worktree**：通过模糊匹配解析目标分支（匹配策略同下文常规 validate 流程中的描述）
3. 如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的危险指令和操作后果），用户取消则退出
4. 如果主 worktree 有未提交更改，执行 `git reset --hard` + `git clean -fd` 清空
5. 删除对应分支的快照文件
6. **（新增）** 如果当前分支是验证分支（以 `clawt-validate-` 开头），切回主工作分支：
   ```bash
   git checkout <clawtMainWorkBranch>
   ```
7. 输出清理成功提示

#### 首次 validate（无历史快照）

##### 步骤 0：解析目标 worktree

根据 `-b` 参数解析目标 worktree，匹配策略如下：

- **未传 `-b` 参数**：
  - 获取当前项目所有 worktree
  - 无可用 worktree → 报错退出
  - 仅 1 个 worktree → 直接使用，无需选择
  - 多个 worktree → 通过交互式列表（Enquirer.Select）让用户选择
- **传了 `-b` 参数**：
  1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
  2. **模糊匹配**（子串匹配，大小写不敏感）：
     - 唯一匹配 → 直接使用
     - 多个匹配 → 通过交互式列表让用户从匹配结果中选择
  3. **无匹配** → 报错退出，并列出所有可用分支名

##### 步骤 1：检测主 worktree 工作区状态

执行 `git status --porcelain`，判断主 worktree 是否有未提交的更改。

- **无更改** → 进入步骤 2
- **有更改** → 提示用户选择处理方式，使用交互式选择（方向键切换，回车确认）：

```
⚠ 主 worktree 当前分支有未提交的更改，请选择处理方式：

❯ reset (推荐) - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)
  stash        - 暂存更改 (git add . && git stash)
  exit         - 退出，手动处理
```

| 选项    | 执行命令                                  | 默认 |
| ------- | ----------------------------------------- | ---- |
| `reset` | `git reset --hard HEAD && git clean -fd`  | 是   |
| `stash` | `git add . && git stash`                  | 否   |
| `exit`  | 退出程序                                  | 否   |

执行完毕后，通过 `git status --porcelain` 再次检测状态，确保工作区干净。如果仍然不干净，报错退出。

##### 步骤 2：检测目标分支变更

统一检测目标 worktree 的未提交修改和已提交 commit：

```bash
# 检测未提交修改
cd ~/.clawt/worktrees/<project>/<branchName>
git status --porcelain

# 检测已提交 commit（在主 worktree 中执行）
cd <主 worktree 路径>
git log HEAD..<branchName> --oneline
```

- **两者均无** → 输出提示 `该 worktree 的分支上没有任何更改，无需验证`，退出
- **至少有一项** → 继续

##### 步骤 3：切换到验证分支

```bash
cd <主 worktree 路径>
git checkout clawt-validate-<branchName>
```

如果验证分支不存在，直接报错退出：

```
✗ 未找到验证分支 clawt-validate-<branchName>，请重新创建 worktree
```

##### 步骤 4：通过 patch 迁移目标分支全量变更

使用三点 diff（`git diff HEAD...branchName --binary`）获取目标分支自分叉点以来的全量变更。如果目标 worktree 有未提交修改，先做临时 commit 以便 diff 能捕获全部变更，diff 完成后撤销临时 commit 恢复原状。

```bash
# 如果有未提交修改，先临时提交
cd ~/.clawt/worktrees/<project>/<branchName>
git add .
git commit -m "clawt:temp-commit-for-validate"

# 在主 worktree（已切换到验证分支）中执行三点 diff
cd <主 worktree 路径>
git diff HEAD...<branchName> --binary | git apply

# 撤销临时 commit，恢复目标 worktree 原状
cd ~/.clawt/worktrees/<project>/<branchName>
git reset --soft HEAD~1
git restore --staged .
```

> 由于验证分支的 HEAD 与目标分支的创建基点一致，patch apply **永远不会冲突**。
> 此步骤结束后，目标 worktree 的代码保持原样，主 worktree 工作目录包含目标分支的全量变更。
> 如果 patch apply 失败（兜底场景），`migrateChangesViaPatch` 返回 `{ success: false }`，进入自动 sync 交互流程（见下文 [patch apply 失败后的自动 sync 流程](#patch-apply-失败后的自动-sync-流程)）。

##### patch apply 失败后的自动 sync 流程

当 patch apply 失败时，validate 不再直接退出，而是通过 `handlePatchApplyFailure()` 函数进入交互流程：

1. **询问用户**：提示 `是否立即执行 sync 同步主分支到 <branchName>？`
2. **用户拒绝** → 输出提示 `请手动执行 clawt sync -b <branchName> 同步主分支后重试`，退出
3. **用户确认** → 调用 `executeSyncForBranch(targetWorktreePath, branchName)` 自动执行 sync
   - **sync 成功** → validate 流程结束（用户需重新执行 validate）
   - **sync 存在冲突** → 输出提示 `同步存在冲突，请进入目标 worktree 手动解决冲突后重试`，退出

> `executeSyncForBranch` 为 sync 命令抽取的核心操作函数（见 [5.12](#512-将主分支代码同步到目标-worktree)），供 validate 等命令复用。

**实现要点：**

- `migrateChangesViaPatch()` 返回类型从 `void` 改为 `{ success: boolean }`，patch apply 失败时返回 `{ success: false }` 而非抛出异常
- `handleFirstValidate()` 和 `handleIncrementalValidate()` 从同步函数改为 `async` 函数，以支持交互式确认
- `handlePatchApplyFailure()` 为新增的异步函数（`src/commands/validate.ts`），负责 patch 失败后的交互逻辑
- 消息常量：`MESSAGES.VALIDATE_CONFIRM_AUTO_SYNC`、`MESSAGES.VALIDATE_AUTO_SYNC_START`、`MESSAGES.VALIDATE_AUTO_SYNC_CONFLICT`、`MESSAGES.VALIDATE_AUTO_SYNC_DECLINED`（`src/constants/messages/validate.ts`）

##### 步骤 5：保存快照为 git tree 对象

将主 worktree 工作目录的全量变更保存为 git tree 对象，同时记录验证分支的 HEAD commit hash：

```bash
git add .
git write-tree  # → 返回 tree hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.tree
git rev-parse HEAD  # → 返回验证分支的 HEAD commit hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.head
git restore --staged .
```

> 此处保存的 HEAD commit hash 是验证分支的 HEAD（即创建时的基点），而非主工作分支的 HEAD。
> 结果：暂存区=空，工作目录=全量变更。

##### 步骤 6：输出成功提示

```
✓ 已将分支 feature-scheme-1 的变更应用到主 worktree（验证分支: clawt-validate-feature-scheme-1）
  可以开始验证了
```

##### 步骤 7：执行 `--run` 命令（可选）

如果用户传入了 `-r, --run` 选项，在 validate 成功后自动在主 worktree 中执行指定命令：

```bash
# 示例：单命令
clawt validate -b feature-scheme-1 -r "npm test"

# 示例：并行执行多个命令（& 为并行分隔符）
clawt validate -b feature-scheme-1 -r "pnpm test & pnpm build"
```

**执行说明：**

- 命令执行失败（退出码非 0 或进程启动失败）**不影响** validate 本身的结果，仅输出提示信息
- `--clean` 模式下传入 `--run` 会被忽略（只执行 clean 逻辑）

**命令解析规则：**

`-r` 选项支持通过 `&` 将多个命令并行执行。解析由 `parseParallelCommands()`（`src/utils/shell.ts`）负责：

1. 先将命令字符串中的 `&&` 临时替换为占位符，避免被误拆
2. 按单个 `&` 分割为多个独立命令
3. 还原占位符为 `&&`，去除首尾空白，过滤空串

| 输入示例 | 解析结果 | 执行方式 |
| -------- | -------- | -------- |
| `"npm test"` | `["npm test"]` | 单命令，同步执行（`spawnSync` + `inherit`） |
| `"npm lint && npm test"` | `["npm lint && npm test"]` | 单命令（`&&` 不拆分），同步执行 |
| `"npm test & npm build"` | `["npm test", "npm build"]` | 并行执行（`spawn` + `Promise.all`） |
| `"npm lint && npm test & npm build"` | `["npm lint && npm test", "npm build"]` | 并行执行 2 个命令 |

**单命令执行：**

当解析后只有 1 个命令时，通过 `spawnSync` + `inherit` stdio 模式同步执行，输出实时显示在终端。

**并行命令执行：**

当解析后有多个命令时，通过 `runParallelCommands()`（`src/utils/shell.ts`）执行：

- 每个命令通过 Node.js `spawn` 以 shell 模式启动，`stdio: 'inherit'`
- 使用 `Promise.all` 等待全部命令完成
- 完成后汇总输出各命令的执行结果

**向后兼容性：**

- `-r "npm test"` — 单命令，走原有同步路径，行为无变化
- `-r "npm lint && npm test"` — `&&` 不拆分，走原有同步路径，行为无变化
- `-r "npm test & npm build"` — **新行为**：并行执行，等全部完成后汇总

**输出格式：**

```
# 单命令执行成功
正在主 worktree 中执行命令: npm test
────────────────────────────────────────
... 命令的实时输出 ...
────────────────────────────────────────
✓ 命令执行完成: npm test，退出码: 0

# 单命令执行失败（退出码非 0）
正在主 worktree 中执行命令: npm test
────────────────────────────────────────
... 命令的实时输出 ...
────────────────────────────────────────
✗ 命令执行完成: npm test，退出码: 1

# 单命令执行出错（进程启动失败）
正在主 worktree 中执行命令: nonexistent
────────────────────────────────────────
────────────────────────────────────────
✗ 命令执行出错: spawn ENOENT

# 并行命令执行（全部成功）
正在并行执行 2 个命令...
[1/2] pnpm test
[2/2] pnpm build
────────────────────────────────────────
... 各命令的实时输出（交错显示） ...
────────────────────────────────────────
  ✓ pnpm test
  ✓ pnpm build
✓ 全部 2 个命令执行成功

# 并行命令执行（部分失败）
正在并行执行 2 个命令...
[1/2] pnpm test
[2/2] pnpm build
────────────────────────────────────────
... 各命令的实时输出（交错显示） ...
────────────────────────────────────────
  ✗ pnpm test（退出码: 1）
  ✓ pnpm build
共 2 个命令，1 个成功，1 个失败
```

**实现要点：**

- 命令解析：`parseParallelCommands()`（`src/utils/shell.ts`）
- 并行执行：`runParallelCommands()`（`src/utils/shell.ts`），返回 `ParallelCommandResult[]`
- 结果汇总：`reportParallelResults()`（`src/commands/validate.ts`）
- 消息常量：`MESSAGES.VALIDATE_PARALLEL_*` 系列（`src/constants/messages/validate.ts`）

#### 增量 validate（存在历史快照）

当 `~/.clawt/validate-snapshots/<project>/<branchName>.tree` 存在时，自动进入增量模式：

##### 步骤 1：读取旧快照

在清空主 worktree 之前，读取上次保存的快照 tree hash 及当时的 HEAD commit hash。

##### 步骤 2：确保主 worktree 干净

如果主 worktree 有残留状态，让用户选择处理方式（同首次 validate 步骤 1 的交互），做兜底清理。

##### 步骤 3：切换到验证分支

如果当前已在该验证分支上（上次 validate 后未切回），跳过。如果当前在另一个验证分支上（验证了分支 A，现在要验证分支 B），直接切换：

```bash
git checkout clawt-validate-<branchName>
```

##### 步骤 4：从目标分支获取最新全量变更

通过 patch 方式从目标分支获取最新全量变更（流程同首次 validate 的步骤 4）。如果 patch apply 失败，同样进入自动 sync 交互流程（见首次 validate 的 [patch apply 失败后的自动 sync 流程](#patch-apply-失败后的自动-sync-流程)），validate 流程提前结束。

##### 步骤 5：保存最新快照为 git tree 对象

将最新全量变更保存为新的 tree 对象（覆盖旧快照），同时记录验证分支的 HEAD commit hash（流程同首次 validate 的步骤 5）。

##### 步骤 6：将旧变更状态载入暂存区

由于验证分支的 HEAD 不会变化，`oldHeadCommitHash` 与 `currentHeadCommitHash` 始终一致（除非执行了 sync 重建验证分支），因此：

**正常情况（HEAD 未变化）：**

直接通过 `git read-tree` 将旧 tree 对象载入暂存区：

```bash
git read-tree <旧 tree hash>
```

- **读取成功** → 结果：暂存区=上次快照，工作目录=最新全量变更（用户可通过 `git diff` 查看增量差异）
- **读取失败**（tree 对象可能被 git gc 回收）→ 降级为全量模式，暂存区保持为空，等同于首次 validate 的结果

> 这是最常见的路径。相比重构前，正常情况不再需要处理 HEAD 变化的复杂逻辑，代码路径更简单、更可靠。

**sync 后（HEAD 变化，验证分支已重建）：**

此时旧 tree 对象基于旧 HEAD，直接 read-tree 会导致 diff 混入 HEAD 变化的内容。需要将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上：

```bash
# 获取旧 HEAD 对应的 tree hash
git rev-parse <旧 HEAD commit hash>^{tree}  # → 旧 HEAD tree hash

# 提取旧变更 patch（旧 HEAD tree → 旧快照 tree 的差异）
git diff-tree -p --binary <旧 HEAD tree hash> <旧快照 tree hash>

# 检测 patch 能否无冲突地应用到暂存区
git apply --cached --check < patch

# 无冲突：apply --cached 到当前 HEAD 暂存区
git apply --cached < patch
```

- **patch 为空**（旧变更为空）→ 暂存区保持干净
- **无冲突** → apply --cached 到当前 HEAD 暂存区，结果与正常情况一致
- **有冲突** → 降级为全量模式（暂存区保持为空），等同于首次 validate 的结果

##### 步骤 7：输出成功提示

```
# 增量模式成功
✓ 已将分支 feature-scheme-1 的最新变更应用到主 worktree（增量模式）
  暂存区 = 上次快照，工作目录 = 最新变更

# 增量降级为全量
✓ 已将分支 feature-scheme-1 的变更应用到主 worktree
  可以开始验证了
```

##### 步骤 8：执行 `--run` 命令（可选）

与首次 validate 的步骤 7 相同，增量 validate 成功后也会执行 `-r, --run` 指定的命令。

---

### 5.5 移除 Worktree

**命令：**

```bash
# 移除当前项目所有 worktree
clawt remove --all

# 指定分支名（支持模糊匹配）
clawt remove -b <branchName>

# 不指定参数（列出所有分支供多选）
clawt remove
```

**参数：**

| 参数      | 必填 | 说明                                                                   |
| --------- | ---- | ---------------------------------------------------------------------- |
| `--all`   | 否   | 移除当前项目 (`~/.clawt/worktrees/<project>/`) 下所有 worktree           |
| `-b`      | 否   | 指定分支名（支持模糊匹配，不传则列出所有分支供多选）                       |

> **提示：** 不传 `--all` 也不传 `-b` 时，会列出当前项目所有 worktree 供交互式多选。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. **确定待移除的 worktree 列表**：
   - **指定 `--all`** → 选中当前项目所有 worktree
   - **未指定 `--all`** → 通过 `resolveTargetWorktrees` 解析目标 worktree（多选版本），匹配策略如下：
     - **未传 `-b` 参数**：
       - 无可用 worktree → 报错退出
       - 仅 1 个 worktree → 直接使用，无需选择
       - 多个 worktree → 通过交互式多选列表（Enquirer.MultiSelect）让用户选择（空格选择，回车确认）
     - **传了 `-b` 参数**：
       1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
       2. **模糊匹配**（子串匹配，大小写不敏感）：
          - 唯一匹配 → 直接使用
          - 多个匹配 → 通过交互式多选列表让用户从匹配结果中选择
       3. **无匹配** → 报错退出，并列出所有可用分支名
4. 列出即将移除的 worktree 及对应分支：

```
即将移除以下 worktree 及本地分支：

  1. ~/.clawt/worktrees/main-project/feature-scheme-1  →  分支: feature-scheme-1, 验证分支: clawt-validate-feature-scheme-1
  2. ~/.clawt/worktrees/main-project/feature-scheme-2  →  分支: feature-scheme-2, 验证分支: clawt-validate-feature-scheme-2
  3. ~/.clawt/worktrees/main-project/feature-scheme-3  →  分支: feature-scheme-3, 验证分支: clawt-validate-feature-scheme-3

是否同时删除对应的本地分支和验证分支？(y/N)
```

5. 用户确认后（只需确认一次），依次执行：

```bash
# 如果当前在即将删除的验证分支上，先切回主工作分支
git checkout <clawtMainWorkBranch>

# 移除 worktree
git worktree remove -f <worktree路径>

# 如果用户选择了删除分支
git branch -D <branchName>
git branch -D clawt-validate-<branchName>  # 同步删除验证分支

# 清理该分支对应的 validate 快照
```

6. 如果配置文件 `~/.clawt/config.json` 中 `autoDeleteBranch` 为 `true`，则跳过询问，直接删除分支。

7. 如果使用 `--all` 模式，额外清理整个项目的 validate 快照目录。

8. 移除完成后，清理空目录（如果 `~/.clawt/worktrees/<project>/` 下已无 worktree，则删除该项目目录）。

9. 批量移除时，单个 worktree 移除失败不会中断整个流程，而是收集所有失败项，最后汇总报告。

---

### 5.6 合并验证过的分支

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt merge -b <branchName> [-m <commitMessage>]

# 不指定分支名（列出所有分支供选择）
clawt merge [-m <commitMessage>]
```

**参数：**

| 参数 | 必填 | 说明                                                                     |
| ---- | ---- | ------------------------------------------------------------------------ |
| `-b` | 否   | 要合并的分支名（支持模糊匹配，不传则列出所有分支供选择）                   |
| `-m` | 否   | 提交信息（目标 worktree 工作区有修改时必填）                               |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **解析目标 worktree**：根据 `-b` 参数解析目标 worktree，匹配策略如下：
   - **未传 `-b` 参数**：
     - 获取当前项目所有 worktree
     - 无可用 worktree → 报错退出
     - 仅 1 个 worktree → 直接使用，无需选择
     - 多个 worktree → 通过交互式列表（Enquirer.Select）让用户选择
   - **传了 `-b` 参数**：
     1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
     2. **模糊匹配**（子串匹配，大小写不敏感）：
        - 唯一匹配 → 直接使用
        - 多个匹配 → 通过交互式列表让用户从匹配结果中选择
     3. **无匹配** → 报错退出，并列出所有可用分支名
3. **主 worktree 状态检测**
   - 执行 `git status --porcelain`
   - 如果有更改：
     - 如果存在该分支的 validate 快照（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），额外输出警告提示用户可先执行 `clawt validate -b <branchName> --clean` 清理
     - 提示 `主 worktree 有未提交的更改，请先处理`，退出
   - 无更改 → 继续
   - **如果当前在验证分支上**（`clawt-validate-` 前缀），先清理并切回主工作分支：
     ```bash
     git reset --hard
     git clean -fd
     git checkout <clawtMainWorkBranch>
     ```
4. **Squash 检测与执行（auto-save 临时提交压缩）**
   - 通过 `git log HEAD..<branchName> --format=%s` 检查目标分支是否存在以 `AUTO_SAVE_COMMIT_MESSAGE`（`chore: auto-save before sync`）为前缀的 commit
   - **不存在** → 跳过，进入步骤 5
   - **存在** → 提示用户是否将所有提交压缩为一个：
     ```
     检测到 sync 产生的临时提交，是否将所有提交压缩为一个？
       压缩后变更将保留在目标worktree的暂存区，需要重新提交
     ```
   - **用户选择不压缩** → 跳过，进入步骤 5
   - **用户选择压缩** →
     1. 获取主分支名（从项目级配置 `clawtMainWorkBranch` 获取）
     2. 计算分叉点：`git merge-base <mainBranch> <branchName>`
     3. 在目标 worktree 中执行 `git reset --soft <merge-base>`，将所有 commit 撤销到暂存区
     4. 如果用户提供了 `-m` → 直接在目标 worktree 执行 `git commit -m '<commitMessage>'`，输出成功提示，继续步骤 5
     5. 如果用户未提供 `-m` → 提示用户前往目标 worktree 自行提交后重新执行 `clawt merge`，**退出流程**
5. **根据目标 worktree 状态决定是否需要提交**
   - 检测目标 worktree 工作区是否干净（`git status --porcelain`）
   - **工作区有未提交修改**：
     - 如果用户未提供 `-m`，提示 `<worktreePath> 有未提交的修改，请通过 -m 参数提供提交信息`（其中 `<worktreePath>` 为目标 worktree 的完整路径），退出
     - 提供了 `-m` → 执行提交：
       ```bash
       cd ~/.clawt/worktrees/<project>/<branchName>
       git add .
       git commit -m '<commitMessage>'
       ```
   - **工作区干净**：
     - 检查目标分支相对于主分支是否有本地提交（`git log HEAD..<branchName> --oneline`）
     - 有本地提交 → 跳过提交步骤，直接进入合并
     - 无本地提交 → 提示 `目标 worktree 没有任何可合并的变更（工作区干净且无本地提交）`，退出
6. **回到主 worktree 进行合并**
   ```bash
   cd <主 worktree 路径>
   git merge <branchName>
   ```
7. **冲突检测**
   - 检查 merge 退出码及 `git status` 是否存在冲突
   - **有冲突** → 提示 `合并存在冲突，请手动处理`，退出
   - **无冲突** → 继续
8. **推送（受 `autoPullPush` 配置控制）**
   ```bash
   # 仅当 autoPullPush 为 true 时执行
   git pull
   git push
   ```
9. **输出成功提示**

```
# 提供了 -m 且已推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
  提交信息: <commitMessage>
  已推送到远程仓库

# 提供了 -m 但未推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
  提交信息: <commitMessage>

# 未提供 -m 且已推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
  已推送到远程仓库

# 未提供 -m 且未推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
```

10. **merge 成功后确认并清理 worktree 和分支（可选）**
   - 如果配置文件中 `autoDeleteBranch` 为 `true`，自动执行清理
   - 否则交互式询问用户是否清理
   - 用户确认后，依次执行：
     ```bash
     # 移除 worktree
     git worktree remove -f <worktree路径>
     # 删除本地分支
     git branch -D <branchName>
     # 同步删除验证分支
     git branch -D clawt-validate-<branchName>
     # 修剪 worktree 引用
     git worktree prune
     # 如果项目 worktree 目录为空，则清理空目录
     ```
   - 输出清理成功提示：`✓ 已清理 worktree 和分支: <branchName>`
   - 验证分支的删除时机与目标分支保持一致（见 [2.5 验证分支生命周期](#25-验证分支)）：用户确认清理 → 同步删除验证分支；用户拒绝清理 → 验证分支也保留

11. **清理 validate 快照**
    - merge 成功后，如果存在该分支的 validate 快照（`~/.clawt/validate-snapshots/<project>/<branchName>.tree` 和 `<branchName>.head`），自动删除这些快照文件（merge 成功后快照已无意义）

> **注意：** 清理确认和清理操作均在 merge 成功后执行。只有 merge 成功才会询问用户是否清理 worktree 和分支，避免 merge 冲突时用户被提前询问造成困惑。

---

### 5.7 默认配置文件

**路径：** `~/.clawt/config.json`

**生成时机：** 全局安装后自动生成（通过 `postinstall` 脚本）。

**升级策略：** 配置文件已存在时，执行增量合并而非简单跳过：

- **新版本新增的配置项** → 使用默认值补充到用户配置中
- **用户已有的配置项** → 保留用户的值，不覆盖
- **新版本已移除的配置项** → 从用户配置中删除

仅在合并后配置发生变化时才写入文件。配置文件损坏或无法解析时，视为不存在，重新生成默认配置。

**默认内容：**

```json
{
  "autoDeleteBranch": false,
  "claudeCodeCommand": "claude",
  "autoPullPush": false,
  "confirmDestructiveOps": true,
  "maxConcurrency": 0,
  "terminalApp": "auto",
  "aliases": {},
  "autoUpdate": true,
  "warnBranchOnCreate": true
}
```

**配置项说明：**

| 配置项             | 类型      | 默认值    | 说明                                               |
| ------------------ | --------- | --------- | -------------------------------------------------- |
| `autoDeleteBranch` | `boolean` | `false`   | 移除 worktree 时是否自动删除对应本地分支（无需每次确认）；merge 成功后是否自动清理 worktree 和分支；run 任务被中断（Ctrl+C）后是否自动清理本次创建的 worktree 和分支 |
| `claudeCodeCommand` | `string` | `"claude"` | Claude Code CLI 启动指令，用于 `clawt run` 不传 `--tasks` 时和 `clawt resume` 在 worktree 中打开交互式界面 |
| `autoPullPush` | `boolean` | `false` | merge 成功后是否自动执行 git pull 和 git push |
| `confirmDestructiveOps` | `boolean` | `true` | 执行破坏性操作（reset、validate --clean、config reset）前是否提示确认 |
| `maxConcurrency` | `number` | `0` | run 命令默认最大并发数，`0` 表示不限制 |
| `terminalApp` | `string` | `"auto"` | 批量 resume 使用的终端应用：`auto`（自动检测）、`iterm2`、`terminal`（macOS） |
| `aliases` | `Record<string, string>` | `{}` | 命令别名映射，键为别名，值为目标内置命令名 |
| `autoUpdate` | `boolean` | `true` | 是否启用自动更新检查（每 24 小时通过 npm registry 检查一次新版本） |
| `warnBranchOnCreate` | `boolean` | `true` | create/run 时如果当前不在主工作分支上，是否提醒并确认切换。设为 `false` 则跳过提醒直接切换 |

---

### 5.8 获取当前项目所有 Worktree

**命令：**

```bash
clawt list [--json]
```

**参数：**

| 参数     | 必填 | 说明                                     |
| -------- | ---- | ---------------------------------------- |
| `--json` | 否   | 以 JSON 格式输出（仅包含 path 和 branch） |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. 扫描 `~/.clawt/worktrees/<project>/` 目录
4. 对每个子目录，验证是否为有效的 git worktree（`git worktree list` 交叉验证）
5. 根据 `--json` 选项决定输出格式：
   - 指定 `--json` → 以 JSON 格式输出
   - 未指定 → 以文本格式输出

**文本输出格式（默认）：**

每个 worktree 会显示路径、分支名和变更状态。如果某个 worktree 处于空闲状态（0 个提交、无变更、无未提交修改），其路径会以橙色高亮显示，方便用户快速识别可能需要清理或还未开始工作的 worktree。

```
当前项目: main-project

  ~/.clawt/worktrees/main-project/feature-scheme-1   [feature-scheme-1]
  ~/.clawt/worktrees/main-project/feature-scheme-2   [feature-scheme-2]
  ~/.clawt/worktrees/main-project/feature-scheme-3   [feature-scheme-3]
  ~/.clawt/worktrees/main-project/bugfix-login        [bugfix-login]

共 4 个 worktree
```

如果没有 worktree：

```
当前项目: main-project

  (无 worktree)
```

**JSON 输出格式（`--json`）：**

```json
{
  "project": "main-project",
  "total": 4,
  "worktrees": [
    {
      "path": "~/.clawt/worktrees/main-project/feature-scheme-1",
      "branch": "feature-scheme-1"
    },
    {
      "path": "~/.clawt/worktrees/main-project/feature-scheme-2",
      "branch": "feature-scheme-2"
    }
  ]
}
```

---

### 5.9 日志系统

**日志目录：** `~/.clawt/logs/`

**日志文件命名：** `clawt-YYYY-MM-DD.log`（按日期滚动）

**日志级别：**

| 级别    | 说明               | 使用场景                               |
| ------- | ------------------ | -------------------------------------- |
| `debug` | 调试信息           | Git 命令执行详情、变量值等               |
| `info`  | 一般信息           | 操作开始/完成、创建/移除 worktree 等     |
| `warn`  | 警告信息           | 分支名被转换、非致命异常等              |
| `error` | 错误信息           | 命令执行失败、校验不通过等               |

**实现方案：** 使用 `winston` + `winston-daily-rotate-file` 库。

**日志格式：**

```
[2025-02-06 14:30:22] [INFO]  创建 worktree: ~/.clawt/worktrees/main-project/feature-scheme-1
[2025-02-06 14:30:22] [DEBUG] 执行命令: git worktree add -b feature-scheme-1 ~/.clawt/worktrees/main-project/feature-scheme-1
[2025-02-06 14:30:23] [WARN]  分支名已转换: feature/a.b → feature-a-b
[2025-02-06 14:30:25] [ERROR] 分支 feature-scheme-1 已存在，无法创建
```

**保留策略：**

- 日志文件保留 30 天
- 单个日志文件最大 10MB

#### `--debug` 控制台调试输出

通过全局选项 `--debug` 可将调试日志实时输出到终端，方便排查问题。

**实现机制：**

- 在 Commander.js 的 `preAction` 钩子中检测 `--debug` 选项，按需调用 `enableConsoleTransport()` 函数
- `enableConsoleTransport()` 动态向 winston 实例添加 `Console` transport（level 为 `debug`），该函数幂等，多次调用不会重复添加 transport
- 相关常量定义在 `src/constants/logger.ts`：
  - `DEBUG_LOG_PREFIX`：控制台调试输出的日志前缀标识
  - `DEBUG_TIMESTAMP_FORMAT`：时间戳格式（`HH:mm:ss.SSS`，精简，不含日期）

**控制台日志格式：**

```
HH:mm:ss.SSS LEVEL 消息内容
```

**日志级别颜色映射：**

| 级别    | 颜色   |
| ------- | ------ |
| `error` | 红色   |
| `warn`  | 黄色   |
| `info`  | 青色   |
| `debug` | 灰色   |

**使用示例：**

```bash
clawt run -b feature-login --debug
clawt validate -b feature-scheme --debug
```

> **注意：** `--debug` 选项不影响文件日志（file transport），文件日志始终按原有策略写入。控制台输出仅在传入 `--debug` 时启用。

---

### 5.10 交互式查看和修改全局配置

**命令：**

```bash
# 交互式修改配置（等同于 config set 无参数）
clawt config

# 修改配置项（无参数进入交互式，有参数直接设置）
clawt config set [key] [value]

# 获取单个配置项的值
clawt config get <key>

# 将配置恢复为默认值
clawt config reset
```

#### 交互式修改配置（`config` / `config set`）

直接执行 `clawt config` 或 `clawt config set`（不带参数）进入交互式配置修改模式。

**运行流程：**

1. 读取全局配置文件 `~/.clawt/config.json`
2. 列出所有配置项供用户选择（`Enquirer.Select`），每项显示：
   - 配置项名称
   - 当前值（布尔值绿色/黄色，字符串青色）
   - 配置项描述（灰色）
   - 对象类型配置项（如 `aliases`）标灰不可选，提示用户通过专用命令管理
3. 用户选择某个配置项后，根据值类型自动选择提示策略：
   - **boolean 类型** → `Select`（true / false）
   - **number 类型** → `Input`（带数字校验）
   - **string 类型 + 有 `allowedValues`** → `Select`（枚举列表）
   - **string 类型 + 无 `allowedValues`** → `Input`（自由输入）
4. 将修改后的配置持久化到配置文件
5. 输出成功提示：`✓ <key> 已设置为 <value>`

#### 直接设置配置项（`config set <key> <value>`）

当带参数执行 `clawt config set <key> <value>` 时，直接修改指定配置项。

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `key` | 否 | 配置项名称（不传则进入交互式模式） |
| `value` | 否 | 配置值（传了 `key` 时必填） |

**运行流程：**

1. 校验 `key` 是否为有效的配置项名称（基于 `DEFAULT_CONFIG` 的键列表），无效则输出错误及可用配置项列表
2. 校验 `value` 是否缺失，缺失则提示用法：`clawt config set <key> <value>`
3. 根据目标配置项的类型解析并校验值：
   - **boolean** → 仅接受 `true` 或 `false`
   - **number** → `Number()` 解析，`NaN` 报错
   - **string + 有 `allowedValues`** → 校验值是否在枚举列表中
   - **string + 无 `allowedValues`** → 无额外校验
4. 加载配置、修改目标项、持久化
5. 输出成功提示：`✓ <key> 已设置为 <value>`

#### 获取单个配置项（`config get <key>`）

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `key` | 是 | 配置项名称 |

**运行流程：**

1. 校验 `key` 是否为有效的配置项名称，无效则输出错误及可用配置项列表
2. 读取配置文件，获取目标配置项的值
3. 输出：`<key> = <value>`

#### 恢复默认配置（`config reset`）

**运行流程：**

1. 如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的操作和后果：当前配置将被覆盖为默认值），用户取消则退出
2. 将默认配置写入 `~/.clawt/config.json`（覆盖现有配置文件）
3. 输出成功提示：`✓ 配置已恢复为默认值`

**实现要点：**

- 配置项类型定义：`ConfigItemDefinition` 新增可选字段 `allowedValues`（`readonly string[]`），仅对 string 类型有效，用于枚举值校验和交互式 Select 提示
- 值解析与提示策略：`src/utils/config-strategy.ts` 中的 `parseConfigValue()`（CLI 字符串解析）和 `promptConfigValue()`（交互式提示），基于类型和 `allowedValues` 自动分发
- `saveConfig(config)`：`src/utils/config.ts` 中新增的通用配置写入函数，将完整配置对象持久化到文件
- `formatConfigValue(value)`：支持 boolean、string、number、对象类型（如 `aliases`，按键值对逐行展示）的格式化显示

---

### 5.11 在已有 Worktree 中恢复会话

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt resume -b <branchName>

# 不指定分支名（列出所有分支供多选）
clawt resume
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b` | 否   | 要恢复的分支名（支持模糊匹配，不传则列出所有分支供多选） |

**使用场景：**

当用户之前通过 `clawt run` 或 `clawt create` 创建了 worktree 但会话已结束，希望在该 worktree 中重新打开 Claude Code 交互式界面继续工作。支持一次选中多个分支，自动在独立终端 Tab 中批量恢复。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **Claude Code CLI 校验**：确认 `claude` CLI 可用
3. **解析目标 worktree**：根据是否传入 `-b` 参数以及 worktree 数量，采用不同的解析策略：
   - **未传 `-b` 参数**：
     - 获取当前项目所有 worktree
     - 无可用 worktree → 报错退出
     - 仅 1 个 worktree → 通过 `resolveTargetWorktrees` 直接使用，无需选择
     - 多个 worktree → 通过 `promptGroupedMultiSelectBranches` 展示**按日期分组的交互式多选列表**（详见下文「按日期分组多选」）
   - **传了 `-b` 参数**：通过 `resolveTargetWorktrees` 解析，匹配策略如下：
     1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
     2. **模糊匹配**（子串匹配，大小写不敏感）：
        - 唯一匹配 → 直接使用
        - 多个匹配 → 通过交互式多选列表让用户从匹配结果中选择
     3. **无匹配** → 报错退出，并列出所有可用分支名
4. **根据选中数量自动分发**：
   - **用户未选择任何分支** → 直接退出
   - **选中 1 个** → 在当前终端恢复（同原有行为），通过 `launchInteractiveClaude()` 启动（使用 `spawnSync` + `inherit stdio`）
   - **选中多个** → 进入批量恢复流程（见下文）

**批量恢复流程：**

1. **计算会话状态**：一次性遍历所有选中的 worktree，通过 `hasClaudeSessionHistory()` 检测是否存在历史会话，构建 sessionMap 避免重复 I/O
2. **输出预览**：列出即将恢复的分支及其会话状态（"继续上次对话"或"新对话"）
3. **用户确认**：提示即将在 N 个独立终端 Tab 中恢复会话，等待用户确认
4. **逐个在新终端 Tab 中启动**：通过 `launchInteractiveClaudeInNewTerminal()` 构建 shell 命令并通过 AppleScript 在新终端 Tab 中执行
5. **输出完成提示**

**终端 Tab 管理：**

批量恢复通过 `openCommandInNewTerminalTab()`（`src/utils/terminal.ts`）在新终端 Tab 中启动 Claude Code。终端类型由配置项 `terminalApp` 控制：

| 配置值     | 行为                                                         |
| ---------- | ------------------------------------------------------------ |
| `auto`     | 自动检测：优先检测 iTerm2 是否已安装（`/Applications/iTerm.app`），已安装则使用 iTerm2，否则降级到 Terminal.app |
| `iterm2`   | 强制使用 iTerm2                                               |
| `terminal` | 强制使用 Terminal.app                                         |

**平台限制：** 批量恢复目前仅支持 macOS 平台（通过 AppleScript 打开终端 Tab）。非 macOS 平台会抛出错误。

**权限要求：** Terminal.app 通过 System Events 模拟键盘操作（`Cmd+T`）新建 Tab，需要在「系统设置 → 隐私与安全性 → 辅助功能」中授权终端应用。iTerm2 使用原生 AppleScript 接口，无需辅助功能权限。

启动命令通过配置项 `claudeCodeCommand`（默认值 `claude`）指定，与 `clawt run` 不传 `--tasks` 时的交互式界面行为一致。

**按日期分组多选：**

当未传 `-b` 且有多个 worktree 时，使用 `promptGroupedMultiSelectBranches` 展示按创建日期分组的交互式多选列表，实现流程如下：

1. **日期分组**（`groupWorktreesByDate`）：通过 `statSync` 获取各 worktree 目录的文件系统创建时间（`birthtime`），按本地时区格式化为 `YYYY-MM-DD` 作为分组键。无法获取创建时间的分支归入「未知日期」组。分组按日期降序排列，未知日期组在最后。
2. **构建选项列表**（`buildGroupedChoices`）：生成包含以下元素的 Enquirer MultiSelect choices 数组：
   - 顶部：全局全选选项 `[select-all]`
   - 每组：日期分隔线（显示日期和相对时间，如「2026-02-26（昨天）」）→ 组级全选选项 `[select-all: YYYY-MM-DD]` → 该组内各分支
3. **三级联动选择**：通过继承 Enquirer MultiSelect 并覆写 `space()` 方法实现：
   - **全局全选**：toggle 所有 choices（含组全选）
   - **组级全选**：toggle 该组内所有分支，并同步全局全选状态
   - **普通分支**：toggle 该分支，同步所属组全选和全局全选状态
4. **过滤结果**：返回时过滤掉全选项和组全选项，只返回实际选中的 worktree

相对日期显示规则：`formatRelativeDate` 基于自然日差值计算——今天 / 昨天 / N 天前 / N 个月前 / N 年前。

相关常量定义在 `src/constants/prompt.ts`：

| 常量 | 说明 |
| ---- | ---- |
| `GROUP_SELECT_ALL_PREFIX` | 组级全选选项的 name 前缀（`__group_select_all_`） |
| `GROUP_SELECT_ALL_LABEL(dateLabel)` | 生成组级全选选项的显示文本 |
| `GROUP_SEPARATOR_LABEL(dateLabel, relativeTime)` | 生成日期分隔线的显示文本（含 chalk 高亮） |
| `UNKNOWN_DATE_GROUP` | 无法获取创建日期时的默认分组名称（`未知日期`） |
| `UNKNOWN_DATE_SEPARATOR_LABEL` | 未知日期分组的分隔线显示文本 |

**会话自动续接：** 启动前会自动检测该 worktree 是否存在 Claude Code 历史会话（通过检查 `~/.claude/projects/<encoded-path>/` 下是否有 `.jsonl` 文件判断），如果存在则自动追加 `--continue` 参数继续上次对话，否则打开新对话。启动信息中会显示当前模式（"继续上次对话"或"新对话"）。路径编码规则：将绝对路径中所有非字母数字字符替换为 `-`（与 Claude Code 源码的编码逻辑一致）。

---

### 5.12 将主分支代码同步到目标 Worktree

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt sync -b <branchName>

# 不指定分支名（列出所有分支供选择）
clawt sync
```

**参数：**

| 参数 | 必填 | 说明                                                                     |
| ---- | ---- | ------------------------------------------------------------------------ |
| `-b` | 否   | 要同步的分支名（支持模糊匹配，不传则列出所有分支供选择）                   |

**使用场景：**

当目标 worktree 的分支需要使用主分支的最新代码继续工作时，通过 `clawt sync` 将主分支最新代码合并到目标 worktree。在新架构下，sync 不再是为了解决 validate 冲突（因为不会冲突了），而是纯粹的「将主分支最新代码同步到目标 worktree」的操作。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **确保在主工作分支上**：`handleSync` 在执行核心逻辑前，调用 `ensureOnMainWorkBranch()` 确保当前处于主工作分支上。sync 命令需要从主分支发起合并操作，因此必须保证当前分支状态正确。
3. **解析目标 worktree**：根据 `-b` 参数解析目标 worktree，匹配策略如下：
   - **未传 `-b` 参数**：
     - 获取当前项目所有 worktree
     - 无可用 worktree → 报错退出
     - 仅 1 个 worktree → 直接使用，无需选择
     - 多个 worktree → 通过交互式列表（Enquirer.Select）让用户选择
   - **传了 `-b` 参数**：
     1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
     2. **模糊匹配**（子串匹配，大小写不敏感）：
        - 唯一匹配 → 直接使用
        - 多个匹配 → 通过交互式列表让用户从匹配结果中选择
     3. **无匹配** → 报错退出，并列出所有可用分支名
3. 调用 `executeSyncForBranch(targetWorktreePath, branch)` 执行核心同步逻辑

#### `executeSyncForBranch` — sync 核心操作函数

`executeSyncForBranch(targetWorktreePath: string, branch: string): SyncResult` 是从 `handleSync` 中抽取的核心同步逻辑，不包含 worktree 解析交互，供 validate 等命令复用。

**接口定义：**

```typescript
/** sync 核心操作的执行结果 */
export interface SyncResult {
  /** 是否同步成功 */
  success: boolean;
  /** 是否存在合并冲突 */
  hasConflict: boolean;
}
```

**执行流程：**

1. **获取主分支名**：通过项目级配置 `clawtMainWorkBranch` 获取主工作分支名（不再通过 `getCurrentBranch` 动态获取，因为在新架构下主 worktree 可能处于验证分支上）
2. **自动保存未提交变更**：检查目标 worktree 是否有未提交修改
   - 有修改 → 自动执行 `git add . && git commit -m "<AUTO_SAVE_COMMIT_MESSAGE>"` 保存变更（commit message 由常量 `AUTO_SAVE_COMMIT_MESSAGE` 定义，值为 `chore: auto-save before sync`，同时用于 merge 命令的 squash 检测）
   - 无修改 → 跳过
3. **在目标 worktree 中合并主分支**：
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>
   git merge <mainBranch>
   ```
4. **冲突处理**：
   - **有冲突** → 输出警告，提示用户进入目标 worktree 手动解决：
     ```
     合并存在冲突，请进入目标 worktree 手动解决：
       cd ~/.clawt/worktrees/<project>/<branchName>
       解决冲突后执行 git add . && git merge --continue
       clawt validate -b <branch> 验证变更
     ```
   - 返回 `{ success: false, hasConflict: true }`
   - **无冲突** → 继续
5. **清除 validate 快照**：合并成功后，如果该分支存在 validate 快照（`.tree` 和 `.head` 文件），自动删除（代码基础已变化，旧快照无效）
6. **重建验证分支**（`rebuildValidateBranch`，async 函数）：sync 将主分支合并到目标 worktree 后，目标分支的代码基点发生变化。为保持验证分支与目标分支基点一致，需要重建验证分支。
   - 确保在主工作分支上创建验证分支，处理三种情况：
     - **已在主工作分支上** → 直接重建
     - **在验证分支上** → 验证分支修改可丢弃，清理工作区后自动切回主工作分支
     - **在其他普通分支上** → 检查工作区是否干净，干净则直接切回主工作分支；不干净则交互处理（`handleDirtyWorkingDir`：reset / stash / exit）后切回
   ```bash
   # 情况 1：已在主工作分支上，无需切换

   # 情况 2：在验证分支上，先清理工作区再切回主分支
   git reset --hard
   git clean -fd
   git checkout <clawtMainWorkBranch>

   # 情况 3：在其他分支上
   # 如果工作区不干净，交互式处理（reset/stash/exit）
   # 然后切回主工作分支
   git checkout <clawtMainWorkBranch>

   # 删除旧验证分支
   git branch -D clawt-validate-<branchName>

   # 基于当前主分支 HEAD 重新创建验证分支
   git branch clawt-validate-<branchName>
   ```
7. **输出成功提示**并返回 `{ success: true, hasConflict: false }`：
   ```
   ✓ 已将 <mainBranch> 的最新代码同步到 <branchName>
     验证分支 clawt-validate-<branchName> 已重建
   ```

#### validate 中自动 sync 的联动

当 validate 的 patch apply 失败（兜底场景）并触发自动 sync 时，sync 内部会自动重建验证分支，validate 流程结束后用户重新执行 validate 即可。

---

### 5.13 重置主 Worktree 工作区和暂存区

**命令：**

```bash
clawt reset
```

**无参数。**

**使用场景：**

当用户通过 `clawt validate` 将分支变更迁移到主 worktree 后，希望快速清除工作区和暂存区的所有修改，恢复到干净状态。与 `clawt validate --clean` 的区别在于：`reset` 仅重置工作区和暂存区，**不删除** validate 快照文件，也**不切换分支**，适用于只想清空变更而保留快照以便后续增量 validate 的场景。

> **设计原因**：reset 的职责是「重置工作区状态」，分支切换属于 validate --clean 和 remove 等命令的职责。将分支切换耦合到 reset 会违反单一职责原则。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **项目级配置校验**（`requireProjectConfig()`，因 reset 不调用 `ensureOnMainWorkBranch`，需自行校验）
3. **检测工作区状态**：通过 `git status --porcelain` 检测主 worktree 是否有未提交的更改
   - **工作区干净** → 输出提示 `主 worktree 工作区和暂存区已是干净状态，无需重置`，退出
   - **工作区不干净** → 继续
3. **确认破坏性操作**：如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的危险指令和操作后果），用户取消则退出
4. **重置工作区和暂存区**：
   ```bash
   git reset --hard
   git clean -f
   ```
5. **输出成功提示**：
   ```
   ✓ 主 worktree 工作区和暂存区已重置
   ```

---

### 5.14 项目全局状态总览

**命令：**

```bash
clawt status [--json]
```

**参数：**

| 参数     | 必填 | 说明                                     |
| -------- | ---- | ---------------------------------------- |
| `--json` | 否   | 以 JSON 格式输出完整状态数据              |

**使用场景：**

在管理多个 worktree 时，快速了解项目全局状态：主 worktree 当前分支及干净状态、所有 worktree 的变更情况和与主分支的同步状态、validate 快照摘要。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **收集主 worktree 状态**：
   - 获取当前分支名（`getCurrentBranch()`）
   - 检测工作区是否干净（`isWorkingDirClean()`）
   - 获取项目名（`getProjectName()`）
3. **收集各 worktree 详细状态**：
   - 获取项目所有 worktree（`getProjectWorktrees()`）
   - 对每个 worktree 收集以下信息：
     - **变更状态**（优先级：合并冲突 > 未提交修改 > 已提交 > 无变更）
     - **行数差异**（新增/删除行数，通过 `getDiffStat()` 获取）
     - **提交差异**（相对于主分支的领先提交数 `getCommitCountAhead()` 和落后提交数 `getCommitCountBehind()`）
     - **快照时间**（validate 快照文件的 mtime，通过 `getSnapshotModifiedTime()` 获取，返回 ISO 8601 时间字符串或 null）
     - **分支创建时间**（通过 `getBranchCreatedAt()` 从 git reflog 获取分支创建时的时间戳）
4. **收集 validate 快照摘要**：
   - 通过 `getProjectSnapshotBranches()` 扫描快照目录下的 `.tree` 文件获取所有存在快照的分支名
   - 统计快照总数和孤立快照数（对应 worktree 已不存在的快照）
5. **输出状态信息**：
   - 指定 `--json` → 以 JSON 格式输出完整状态数据（`JSON.stringify`）
   - 未指定 → 以文本格式输出

**文本输出格式（默认）：**

输出分为三个区块：主 Worktree、Worktree 列表、Validate 快照摘要。每个 worktree 条目每行展示一种信息。

```
════════════════════════════════════════
  项目状态总览: main-project
════════════════════════════════════════

  ◆ 主 Worktree
    分支: main
    状态: ✓ 干净

────────────────────────────────────────

  ◆ Worktree 列表 (2 个)

  ● feature-login   [已提交]
    +120 -30   3 个本地提交   与主分支同步
    创建于 3 天前
    上次验证: 2 小时前

  ● feature-signup   [未提交修改]
    +45 -10   1 个本地提交   落后主分支 2 个提交
    创建于 1 天前
    ✗ 未验证

────────────────────────────────────────

  ◆ Validate 快照 (3 个)
    其中 1 个快照对应的 worktree 已不存在

════════════════════════════════════════
```

**变更状态标签：**

| 状态        | 标签           | 颜色   | 说明                          |
| ----------- | -------------- | ------ | ----------------------------- |
| `committed` | 已提交         | 绿色   | 有已提交内容，工作区干净       |
| `uncommitted` | 未提交修改   | 黄色   | 有未提交的修改                 |
| `conflict`  | 合并冲突       | 红色   | 存在合并冲突                   |
| `clean`     | 无变更         | 灰色   | 工作区干净且无本地提交          |

**差异统计行展示规则：**

- 行数变更（`+N -N`）仅在有变更时展示
- 本地提交数（`N 个本地提交`）仅在有提交时展示
- 与主分支同步状态始终展示（落后时显示黄色，同步时显示绿色）

**分支创建时间行：**

- 通过 `getBranchCreatedAt()` 从 git reflog 获取分支创建时间，以 `formatRelativeTime()` 格式化为中文相对时间（如"3 天前"、"2 小时前"、"刚刚"）
- 展示为灰色文本 `创建于 X前`，无法获取时不展示

**验证状态行：**

- 有快照时：显示绿色 `上次验证: X前`（通过 `getSnapshotModifiedTime()` 获取快照文件 mtime，再用 `formatRelativeTime()` 格式化）
- 无快照时：显示红色 `✗ 未验证` 警示

**快照区块：**

- 标题显示快照总数
- 如果存在孤立快照（对应 worktree 已不存在），显示黄色警告 `其中 N 个快照对应的 worktree 已不存在`
- 无孤立快照时不显示额外信息

**JSON 输出格式（`--json`）：**

```json
{
  "main": {
    "branch": "main",
    "isClean": true,
    "projectName": "main-project"
  },
  "worktrees": [
    {
      "path": "~/.clawt/worktrees/main-project/feature-login",
      "branch": "feature-login",
      "changeStatus": "committed",
      "commitsAhead": 3,
      "commitsBehind": 0,
      "snapshotTime": "2025-02-06T12:30:00.000Z",
      "insertions": 120,
      "deletions": 30,
      "createdAt": "2025-02-03T10:00:00.000Z"
    }
  ],
  "snapshots": {
    "total": 3,
    "orphaned": 1
  },
  "totalWorktrees": 1
}
```

**实现要点：**

- 类型定义在 `src/types/status.ts`：`WorktreeDetailedStatus`（`hasSnapshot` 已改为 `snapshotTime: string | null`，新增 `createdAt: string | null`）、`MainWorktreeStatus`、`SnapshotInfo`、`SnapshotSummary`（新增，包含 `total` 和 `orphaned`）、`StatusResult`（`snapshots` 已从 `SnapshotInfo[]` 改为 `SnapshotSummary`）
- 消息常量在 `MESSAGES.STATUS_*` 系列，新增：
  - `STATUS_LAST_VALIDATED`：上次验证时间标签（如 `上次验证: 2 小时前`）
  - `STATUS_NOT_VALIDATED`：未验证红色警示文本（`✗ 未验证`）
  - `STATUS_CREATED_AT`：分支创建时间标签（如 `创建于 3 天前`）
  - `STATUS_SNAPSHOT_ORPHANED`：改为接受数量参数的函数（如 `其中 1 个快照对应的 worktree 已不存在`）
- `getBranchCreatedAt()` 是新增的工具函数（在 `src/utils/git.ts`），通过 `git reflog show <branch> --format=%cI` 获取 reflog 最后一条记录的时间戳（即分支创建时间），返回 ISO 8601 格式字符串或 null
- `getSnapshotModifiedTime()` 是新增的工具函数（在 `src/utils/validate-snapshot.ts`），通过 `fs.statSync` 获取快照文件的修改时间（mtime），返回 ISO 8601 格式字符串或 null
- `formatRelativeTime()` 是新增的格式化函数（在 `src/utils/formatter.ts`），将 ISO 8601 日期字符串转换为中文相对时间描述（如"3 天前"、"2 小时前"、"刚刚"），无效日期时返回 null
- `getCommitCountBehind()` 是新增的工具函数（在 `src/utils/git.ts`），通过 `git rev-list --count <branch>..HEAD` 计算落后提交数
- `getProjectSnapshotBranches()` 是新增的工具函数（在 `src/utils/validate-snapshot.ts`），通过扫描快照目录下的 `.tree` 文件提取分支名列表
- `formatDiskSize()` 是新增的格式化函数（在 `src/utils/formatter.ts`），将字节数格式化为带单位的磁盘大小字符串（如 `"1.5 GB"`、`"256.0 MB"`、`"10.2 KB"`、`"512 B"`）
- `formatLocalISOString()` 是新增的格式化函数（在 `src/utils/formatter.ts`），将 Date 对象格式化为本机时区的 ISO 8601 字符串（输出格式: `YYYY-MM-DDTHH:mm:ss.sss+HH:MM`），替代 `Date.toISOString()` 的 UTC 时区输出
- `calculateDirSize()` 是新增的文件系统工具函数（在 `src/utils/fs.ts`），递归计算目录占用的磁盘大小（字节），遇到无法访问的文件或目录时静默跳过

---

### 5.15 命令别名管理

**命令：**

```bash
# 列出所有命令别名
clawt alias
clawt alias list

# 设置命令别名
clawt alias set <alias> <command>

# 移除命令别名
clawt alias remove <alias>
```

**子命令：**

| 子命令 | 说明 |
| ------ | ---- |
| `clawt alias` / `clawt alias list` | 列出所有已配置的命令别名 |
| `clawt alias set <alias> <command>` | 设置命令别名，将 `<alias>` 映射到 `<command>` |
| `clawt alias remove <alias>` | 移除指定的命令别名 |

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `<alias>` | 是（set / remove） | 别名名称 |
| `<command>` | 是（set） | 目标内置命令名 |

**约束规则：**

1. **别名不能覆盖内置命令名**：别名不能与已注册的内置命令同名（`list`、`create`、`remove`、`run`、`resume`、`validate`、`merge`、`config`、`sync`、`reset`、`status`、`alias`）。如果用户尝试设置与内置命令同名的别名，报错退出
2. **目标必须是内置命令**：别名的目标（`<command>`）必须是已注册的内置命令名。如果指定了不存在的目标命令，报错退出
3. **参数透传**：通过别名调用时，所有选项和参数会完全透传给目标命令，行为与直接调用目标命令完全一致

**持久化：**

别名配置存储在 `~/.clawt/config.json` 的 `aliases` 字段中（类型 `Record<string, string>`，默认 `{}`）。

**运行流程：**

#### `alias list`（默认）

1. 读取配置文件中的 `aliases` 字段
2. 如果没有配置任何别名，输出提示 `当前没有配置任何命令别名`
3. 如果有别名，逐行输出所有别名映射

**输出格式：**

```
命令别名列表：

  l → list
  r → run
  v → validate
```

#### `alias set <alias> <command>`

1. **校验别名不与内置命令冲突**：检查 `<alias>` 是否为内置命令名，是则报错退出
2. **校验目标命令存在**：检查 `<command>` 是否为已注册的内置命令名，不是则报错退出
3. 将别名写入配置文件的 `aliases` 字段（如果别名已存在，覆盖旧值）
4. 输出成功提示

**输出格式：**

```
✓ 已设置别名: l → list
```

#### `alias remove <alias>`

1. 读取配置文件中的 `aliases` 字段
2. 检查指定的别名是否存在，不存在则报错退出
3. 从 `aliases` 中删除该别名并写入配置文件
4. 输出成功提示

**输出格式：**

```
✓ 已移除别名: l
```

**别名使用示例：**

```bash
# 设置别名
clawt alias set l list
clawt alias set r run
clawt alias set v validate

# 使用别名（等同于对应的完整命令）
clawt l          # 等同于 clawt list
clawt r task.md  # 等同于 clawt run task.md

# 查看所有别名
clawt alias list

# 移除别名
clawt alias remove l
```

---

### 5.16 `clawt completion` 命令

为终端环境（bash/zsh）生成并安装 `clawt` 的命令、选项及参数的自动补全脚本。

#### 语法
```bash
clawt completion bash
clawt completion zsh
clawt completion install
```

#### 子命令说明

| 子命令    | 说明                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `bash`    | 输出适用于 bash 的补全脚本（用户可重定向到 `~/.bashrc`）                                |
| `zsh`     | 输出适用于 zsh 的补全脚本（用户可重定向到 `~/.zshrc`）                                  |
| `install` | 自动检测当前 shell 类型，将补全脚本追加到对应的配置文件中                                  |

#### `install` 子命令流程

1. 通过 `process.env.SHELL` 检测当前 shell 类型
2. 根据 shell 类型确定目标配置文件：
   - zsh → `~/.zshrc`（追加 `source <(clawt completion zsh)`）
   - bash → `~/.bashrc`（追加 `eval "$(clawt completion bash)"`）
3. 检查目标文件中是否已包含 `clawt completion`，已存在则跳过并提示
4. 追加成功后提示用户重启终端或 source 配置文件
5. 未知 shell 类型时输出警告，提示手动配置

#### 动态补全特性

补全脚本通过内部子命令 `_complete` 实现动态补全，不对外公开。补全引擎基于 Commander.js 的命令树结构遍历，支持以下场景：

| 场景                         | 补全行为                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `-b` / `--branch` 参数之后   | 动态列出当前项目所有 worktree 分支名（通过 `getProjectWorktrees`） |
| `-f` / `--file` 参数之后     | 动态列出匹配的文件和子目录（不限制文件类型，支持子目录递归浏览）    |
| `config set` / `config get` 之后 | 动态列出所有配置项键名（从 `CONFIG_DEFINITIONS` 获取）         |
| 输入以 `-` 开头              | 列出当前命令层级的可用选项（short/long）                       |
| 其他情况                     | 列出当前命令层级的可用子命令及别名                              |

**文件路径补全细节：**
- 支持子目录递归浏览（如 `tasks/` 后继续 Tab 可深入子目录）
- 目录候选项以 `/` 结尾，补全时不自动追加空格
- 不限制文件类型，列出所有非隐藏文件
- 跳过隐藏文件和目录（以 `.` 开头）

#### 实现说明

- 补全命令注册函数：`registerCompletionCommand()`（在 `src/commands/completion.ts`）
- 消息常量：`COMPLETION_MESSAGES`（在 `src/constants/messages/completion.ts`）
- 核心函数：`generateCompletions()` 解析当前输入上下文并输出候选项，`completeFilePath()` 处理文件路径补全
- shell 脚本生成：`getBashScript()`、`getZshScript()` 分别生成对应 shell 的补全脚本

---

### 5.17 自动更新检查

CLI 在每次命令执行完毕后，根据配置项 `autoUpdate` 决定是否检查 npm registry 上的最新版本。当发现新版本时，以带边框的提示框在终端输出版本更新信息和升级命令。

#### 触发条件

- 配置项 `autoUpdate` 为 `true`（默认启用）
- 命令正常执行完毕后触发（在 `program.parseAsync()` 之后）

#### 检查流程

1. 读取缓存文件 `~/.clawt/update-check.json`
2. 判断缓存是否有效：
   - 缓存不存在或解析失败 → 视为过期
   - 缓存中的 `currentVersion` 与本地版本不一致 → 视为过期
   - 距离上次检查超过 24 小时 → 视为过期
3. **缓存有效**：直接使用缓存中的 `latestVersion` 与本地版本比较，有新版本则打印提示
4. **缓存过期**：向 npm registry 发起 HTTPS 请求获取最新版本号（5 秒超时），更新缓存文件后判断并打印提示

#### 缓存文件

**路径：** `~/.clawt/update-check.json`

**结构：**

```json
{
  "lastCheck": 1709000000000,
  "latestVersion": "2.18.0",
  "currentVersion": "2.17.1"
}
```

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `lastCheck` | `number` | 上次检查时间戳（毫秒） |
| `latestVersion` | `string` | 从 registry 获取的最新版本号 |
| `currentVersion` | `string` | 检查时的本地版本号 |

#### 版本比较

使用简易 semver 比较（不引入额外依赖），逐级比较 `major.minor.patch`：

- `latest > current` → 提示更新
- `latest <= current` → 不提示

#### 包管理器检测

更新提示中会显示与用户安装方式匹配的升级命令。检测逻辑依次尝试：

1. `pnpm list -g --depth=0 clawt` → 匹配则提示 `pnpm add -g clawt`
2. `yarn global list --depth=0` → 输出含 `clawt` 则提示 `yarn global add clawt`
3. 以上均未匹配 → 默认提示 `npm i -g clawt`

#### 提示框格式

当检测到新版本时，输出带 Unicode 圆角边框的居中提示框：

```
╭──────────────────────────────────────────────╮
│                                              │
│   clawt 有新版本可用: 2.17.1 → 2.18.0       │
│   执行 npm i -g clawt 进行更新               │
│                                              │
╰──────────────────────────────────────────────╯
```

版本号和命令使用 chalk 着色：当前版本红色、最新版本绿色、更新命令青色。

#### 容错设计

所有异常静默处理，不影响 CLI 正常功能：

- 网络请求失败或超时（5 秒） → 静默忽略
- registry 返回无效 JSON 或缺少 `version` 字段 → 静默忽略
- 缓存文件读写失败 → 静默忽略
- `checkForUpdates()` 入口函数的最外层 `try/catch` 确保任何未预期异常都不会中断 CLI

#### 常量定义

| 常量 | 值 | 位置 |
| ---- | -- | ---- |
| `UPDATE_CHECK_INTERVAL_MS` | `86400000`（24 小时） | `src/constants/update.ts` |
| `NPM_REGISTRY_URL` | `https://registry.npmjs.org/clawt/latest` | `src/constants/update.ts` |
| `NPM_REGISTRY_TIMEOUT_MS` | `5000` | `src/constants/update.ts` |
| `PACKAGE_NAME` | `clawt` | `src/constants/update.ts` |
| `UPDATE_CHECK_PATH` | `~/.clawt/update-check.json` | `src/constants/paths.ts` |

#### 实现说明

- 入口函数：`checkForUpdates()`（在 `src/utils/update-checker.ts`）
- 消息常量：`UPDATE_MESSAGES`、`UPDATE_COMMANDS`（在 `src/constants/messages/update.ts`）
- 入口调用点：`src/index.ts` 的 `main()` 异步函数中，`program.parseAsync()` 之后根据 `config.autoUpdate` 条件调用

---

### 5.18 跨项目 Worktree 概览

**命令：**

```bash
clawt projects [name] [--json]
```

**参数：**

| 参数     | 必填 | 说明                                           |
| -------- | ---- | ---------------------------------------------- |
| `[name]` | 否   | 指定项目名，查看该项目的 worktree 详情           |
| `--json` | 否   | 以 JSON 格式输出完整数据                        |

**使用场景：**

当使用 clawt 管理多个不同项目时，快速了解所有项目的 worktree 数量、磁盘占用和最近活跃时间。也可以指定项目名查看该项目下每个 worktree 的分支、路径、最后修改时间和磁盘占用。

**注意：** `projects` 命令不需要在主 worktree 中执行（与其他命令不同），它直接扫描 `~/.clawt/worktrees/` 目录。

**运行流程：**

#### 无参数模式（项目概览）

1. 扫描 `~/.clawt/worktrees/` 目录，列出所有项目子目录
2. 对每个项目收集以下信息：
   - **项目名**（目录名即项目名）
   - **worktree 数量**（项目目录下的子目录数）
   - **最近活跃时间**（取项目目录自身和所有 worktree 目录 mtime 的最大值，通过 `formatLocalISOString()` 格式化为本机时区的 ISO 8601 字符串）
   - **磁盘占用**（通过 `calculateDirSize()` 递归计算整个项目目录的总大小）
3. 按最近活跃时间降序排序
4. 输出概览信息（文本或 JSON）

#### 指定项目模式（worktree 详情）

1. 检查 `~/.clawt/worktrees/<name>/` 是否存在，不存在则报错退出
2. 扫描项目目录，对每个 worktree 子目录收集：
   - **分支名**（目录名即分支名）
   - **worktree 路径**
   - **最后修改时间**（目录 mtime，通过 `formatLocalISOString()` 格式化）
   - **磁盘占用**（通过 `calculateDirSize()` 递归计算）
3. 按最后修改时间降序排序
4. 输出详情信息（文本或 JSON）

**文本输出格式（概览模式）：**

```
════════════════════════════════════════
  项目概览
════════════════════════════════════════

  ● my-project
    3 个 worktree   最近活跃: 2 小时前   磁盘占用: 1.5 GB

  ● another-project
    1 个 worktree   最近活跃: 3 天前   磁盘占用: 256.0 MB

────────────────────────────────────────

  共 2 个项目   总占用: 1.8 GB

════════════════════════════════════════
```

**文本输出格式（详情模式）：**

```
════════════════════════════════════════
  项目详情: my-project
════════════════════════════════════════

  ◆ 路径: ~/.clawt/worktrees/my-project
    总占用: 1.5 GB

────────────────────────────────────────

  ● feature-login
    ~/.clawt/worktrees/my-project/feature-login
    最后修改: 2 小时前   磁盘占用: 800.0 MB

  ● feature-signup
    ~/.clawt/worktrees/my-project/feature-signup
    最后修改: 1 天前   磁盘占用: 700.0 MB

════════════════════════════════════════
```

**JSON 输出格式（概览模式，`--json`）：**

```json
{
  "projects": [
    {
      "name": "my-project",
      "worktreeCount": 3,
      "lastActiveTime": "2025-06-15T18:30:00.000+08:00",
      "diskUsage": 1610612736
    }
  ],
  "totalProjects": 1,
  "totalDiskUsage": 1610612736
}
```

**JSON 输出格式（详情模式，`--json`）：**

```json
{
  "name": "my-project",
  "projectDir": "~/.clawt/worktrees/my-project",
  "worktrees": [
    {
      "branch": "feature-login",
      "path": "~/.clawt/worktrees/my-project/feature-login",
      "lastModifiedTime": "2025-06-15T18:30:00.000+08:00",
      "diskUsage": 838860800
    }
  ],
  "totalDiskUsage": 838860800
}
```

**实现要点：**

- 命令注册函数：`registerProjectsCommand()`（在 `src/commands/projects.ts`）
- 类型定义在 `src/types/project.ts`：`ProjectOverview`、`ProjectWorktreeDetail`、`ProjectDetailResult`、`ProjectsOverviewResult`
- 命令选项类型：`ProjectsOptions`（在 `src/types/command.ts`）
- 消息常量在 `PROJECTS_MESSAGES`（在 `src/constants/messages/projects.ts`）
- 时间格式化使用 `formatLocalISOString()`（在 `src/utils/formatter.ts`），输出本机时区的 ISO 8601 字符串（替代 `Date.toISOString()` 的 UTC 输出）
- 磁盘大小展示使用 `formatDiskSize()`（在 `src/utils/formatter.ts`），将字节数格式化为带单位的可读字符串
- 目录大小计算使用 `calculateDirSize()`（在 `src/utils/fs.ts`），递归遍历目录计算总字节数
- 时间的相对展示使用 `formatRelativeTime()`（在 `src/utils/formatter.ts`），将 ISO 8601 日期转换为中文相对时间（如"2 小时前"）

---

### 5.19 初始化项目级配置

**命令：**

```bash
# 设置主工作分支（使用当前分支）
clawt init

# 设置主工作分支（指定分支名）
clawt init -b <branchName>

# 查看当前项目的 init 配置
clawt init show
```

**参数：**

| 参数/子命令 | 必填 | 说明 |
| --- | --- | --- |
| `-b` | 否 | 指定主工作分支名。不传则使用当前分支 |
| `show` | 否 | 查看当前项目的 init 配置 |

**功能说明：**

初始化项目级配置，将指定分支记录为该项目的主工作分支（`clawtMainWorkBranch`）。该配置用于 `create` / `run` 时检测当前分支是否为主工作分支，并在偏离时提醒用户。详见 [2.6 项目级配置](#26-项目级配置)。

**运行流程（设置模式）：**

1. **主 worktree 校验** (2.1)
2. **确定主工作分支名**：
   - 传了 `-b` → 使用指定的分支名
   - 未传 `-b` → 使用当前分支名（`git rev-parse --abbrev-ref HEAD`）
3. **写入项目级配置**：将 `clawtMainWorkBranch` 写入 `~/.clawt/projects/<projectName>/config.json`
   - 配置文件不存在 → 创建
   - 配置文件已存在 → 覆盖 `clawtMainWorkBranch` 字段
4. **输出成功提示**

**运行流程（show 模式）：**

1. **主 worktree 校验** (2.1)
2. **读取项目级配置**：读取 `~/.clawt/projects/<projectName>/config.json`
   - 配置不存在 → 输出提示 `该项目尚未初始化，请执行 clawt init 进行初始化`
   - 配置存在 → 输出配置内容

**输出格式：**

```
# 首次初始化
✓ 已将 main 设为该项目的主工作分支

# 更新已有配置
✓ 已将主工作分支从 develop 更新为 main

# show 查看配置
当前项目: my-project
  主工作分支: main

# show 未初始化
该项目尚未初始化，请执行 clawt init 进行初始化
```

**重复执行：** 支持重复执行，后一次覆盖前一次的配置。

---

## 6. 验证架构规则

以下规则适用于验证分支架构的所有实现工作：

1. **不兼容旧版本**：本次重构不考虑旧版本数据、旧版本创建的 worktree 或旧版本配置的兼容性。所有命令均假定验证分支和项目级配置已按新架构存在。用户需删除旧 worktree 后重新创建。
2. **项目级配置前置校验**：仅对 create、run、validate、sync、remove、merge、reset 这 7 个核心命令添加检测，执行时必须先检查项目级配置（`~/.clawt/projects/<projectName>/config.json`）是否存在且包含 `clawtMainWorkBranch`。如果不存在，直接报错退出并提示用户先执行 `clawt init`：
   ```
   ✗ 该项目尚未初始化，请先执行 clawt init -b<branchName>设置主工作分支
   ```
   其他命令（list、resume、config、status、alias、projects、completion）不受影响，无需添加该校验。
   > **实现细节**：`ensureOnMainWorkBranch()` 内部已通过 `getMainWorkBranch()` → `requireProjectConfig()` 完成了项目配置校验，因此调用了 `ensureOnMainWorkBranch` 的命令（create、run、validate、sync、remove、merge）**无需再显式调用 `requireProjectConfig()`**，避免重复校验。仅 reset 命令因不调用 `ensureOnMainWorkBranch`，需要自行调用 `requireProjectConfig()`。
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
