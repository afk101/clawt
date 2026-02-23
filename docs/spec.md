# Clawt - Software Specification


> 一个深度融合 Git Worktree 与 Claude Code CLI 的命令行工具，基于本地 Git 项目创建多个隔离的 worktree 环境，并行执行多个 Claude Code Agent 任务，所有 Agent 的代码修改互不干扰。

---

## 目录

- [1. 技术栈](#1-技术栈)
- [2. 核心概念](#2-核心概念)
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
- [6. 错误处理规范](#6-错误处理规范)
- [7. 非功能性需求](#7-非功能性需求)
  - [7.1 性能](#71-性能)
  - [7.2 兼容性](#72-兼容性)
  - [7.3 测试](#73-测试)
  - [7.4 安全性](#74-安全性)

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

---

## 3. 全局目录结构

```
~/.clawt/
├── config.json                          # 全局配置文件
├── logs/                                # 日志目录
│   ├── clawt-2025-02-06.log
│   └── ...
├── validate-snapshots/                  # validate 快照目录
│   └── <project-name>/                  # 以项目名分组
│       ├── <branchName>.tree            # 每个分支一个 tree hash 快照文件（存储 git tree 对象的 hash）
│       ├── <branchName>.head            # 每个分支一个 HEAD commit hash 快照文件（存储快照时主 worktree 的 HEAD commit hash）
│       └── ...
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
| `clawt create`        | 批量创建 worktree 及对应分支                     | 5.1      |
| `clawt run`           | 批量创建 worktree + 启动 Claude Code 执行任务（支持任务文件）    | 5.2      |
| `clawt validate`      | 在主 worktree 验证某个 worktree 分支的变更        | 5.4      |
| `clawt merge`         | 合并某个已验证的 worktree 分支到主 worktree       | 5.6      |
| `clawt remove`        | 移除 worktree（支持模糊匹配/多选/全部）             | 5.5      |
| `clawt list`          | 列出当前项目所有 worktree（支持 `--json` 格式输出） | 5.8      |
| `clawt config`        | 交互式查看和修改全局配置（等同于 `config set`）      | 5.10     |
| `clawt config set`    | 修改配置项（无参数进入交互式，有参数直接设置）          | 5.10     |
| `clawt config get`    | 获取单个配置项的值                                 | 5.10     |
| `clawt config reset`  | 将配置恢复为默认值                                | 5.10     |
| `clawt resume`        | 在已有 worktree 中恢复 Claude Code 会话（支持多选批量恢复） | 5.11     |
| `clawt sync`          | 将主分支最新代码同步到目标 worktree                  | 5.12     |
| `clawt reset`         | 重置主 worktree 工作区和暂存区                       | 5.13     |
| `clawt status`        | 显示项目全局状态总览（支持 `--json` 格式输出）          | 5.14     |
| `clawt alias`         | 管理命令别名（列出 / 设置 / 移除）                       | 5.15     |

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
3. **分支名合法性校验与转换** (2.3)
4. **分支名存在性校验** (2.4)
   - 若 `n = 1`：校验 `branchName`
   - 若 `n > 1`：校验 `branchName-1` 到 `branchName-n`
   - 所有分支名在创建任何 worktree **之前**完成全部校验
5. **批量创建 worktree**
   - 若 `n = 1`：
     ```bash
     git worktree add -b <branchName> ~/.clawt/worktrees/<project>/<branchName>
     ```
   - 若 `n > 1`：
     ```bash
     git worktree add -b <branchName>-1 ~/.clawt/worktrees/<project>/<branchName>-1
     git worktree add -b <branchName>-2 ~/.clawt/worktrees/<project>/<branchName>-2
     ...
     git worktree add -b <branchName>-n ~/.clawt/worktrees/<project>/<branchName>-n
     ```
6. **输出创建日志**

**输出格式：**

```
✓ 已创建 3 个 worktree

目录路径1：
  ~/.clawt/worktrees/main-project/feature-scheme-1
  分支名: feature-scheme-1
────────────────────────────────────────
目录路径2：
  ~/.clawt/worktrees/main-project/feature-scheme-2
  分支名: feature-scheme-2
────────────────────────────────────────
目录路径3：
  ~/.clawt/worktrees/main-project/feature-scheme-3
  分支名: feature-scheme-3
────────────────────────────────────────
```

---

### 5.2 批量创建 Worktree + 执行 Claude Code 任务

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

任务文件使用 Markdown 文件中嵌入 HTML 注释标签的自定义格式，标签外的任何文本都不会被解析。

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
   claude -p "<tasks[i]>" --output-format json --permission-mode bypassPermissions
   ```
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

Claude Code CLI 以 `--output-format json` 运行时，退出后会在 stdout 输出如下 JSON：

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

**事件监听与通知流程：**

1. 为每个 Claude Code 子进程维护状态（运行中 / 已完成 / 已失败）
2. 监听每个子进程的 `close` 事件（基于 Node.js `ChildProcess` 的事件驱动机制）
3. 当某个子进程触发 `close` 事件时，解析其 stdout 输出的 JSON
4. 在主 worktree 的 clawt 终端实时输出通知（进度面板每个任务行末尾显示 worktree 路径，终端可点击跳转）：

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

---

### 5.4 在主 Worktree 验证其他分支

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt validate -b <branchName> [--clean]

# 不指定分支名（列出所有分支供选择）
clawt validate [--clean]
```

**参数：**

| 参数      | 必填 | 说明                                                                     |
| --------- | ---- | ------------------------------------------------------------------------ |
| `-b`      | 否   | 要验证的 worktree 分支名（支持模糊匹配，不传则列出所有分支供选择）           |
| `--clean` | 否   | 清理 validate 状态（重置主 worktree 并删除快照）                            |

> **限制：** 单次只能验证一个分支，不支持批量验证。

**背景说明：**

Git worktree 不会包含 `node_modules`、`.venv` 等依赖文件，每次安装依赖耗时较长。利用 `git diff HEAD...branch --binary`（三点 diff）可以获取目标分支自分叉点以来的全量变更（包含已提交和未提交的修改），将其作为 patch 应用到主 worktree 中进行测试，无需重新安装依赖。

**快照机制：**

validate 命令引入了**快照（snapshot）机制**来支持增量对比。每次 validate 执行成功后，会将当前全量变更通过 `git write-tree` 保存为 git tree 对象，并将 tree hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），同时将主 worktree 的 HEAD commit hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.head`），用于增量 validate 时对齐基准。当再次执行 validate 时，如果主分支 HEAD 未变化，通过 `git read-tree` 将上次快照的 tree 对象载入暂存区；如果主分支 HEAD 已变化（如合并了其他分支），则将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上，避免新旧 tree 基准不同导致 diff 混入 HEAD 变化的内容。最终用户可通过 `git diff` 查看两次 validate 之间的增量差异。

**运行流程：**

#### `--clean` 模式

当指定 `--clean` 选项时，执行清理逻辑后直接返回，不进入常规 validate 流程：

1. **主 worktree 校验** (2.1)
2. **解析目标 worktree**：通过模糊匹配解析目标分支（匹配策略同下文常规 validate 流程中的描述）
3. 如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的危险指令和操作后果），用户取消则退出
4. 如果主 worktree 有未提交更改，执行 `git reset --hard` + `git clean -fd` 清空
5. 删除对应分支的快照文件
6. 输出清理成功提示

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

##### 步骤 3：通过 patch 迁移目标分支全量变更

使用三点 diff（`git diff HEAD...branchName --binary`）获取目标分支自分叉点以来的全量变更。如果目标 worktree 有未提交修改，先做临时 commit 以便 diff 能捕获全部变更，diff 完成后撤销临时 commit 恢复原状。

```bash
# 如果有未提交修改，先临时提交
cd ~/.clawt/worktrees/<project>/<branchName>
git add .
git commit -m "clawt:temp-commit-for-validate"

# 在主 worktree 中执行三点 diff
cd <主 worktree 路径>
git diff HEAD...<branchName> --binary | git apply

# 撤销临时 commit，恢复目标 worktree 原状
cd ~/.clawt/worktrees/<project>/<branchName>
git reset --soft HEAD~1
git restore --staged .
```

> 此步骤结束后，目标 worktree 的代码保持原样，主 worktree 工作目录包含目标分支的全量变更。
> 如果 patch apply 失败（目标分支与主分支差异过大），会提示用户先执行 `clawt sync -b <branchName>` 同步主分支后重试。

##### 步骤 4：保存快照为 git tree 对象

将主 worktree 工作目录的全量变更保存为 git tree 对象，同时记录当前 HEAD commit hash：

```bash
git add .
git write-tree  # → 返回 tree hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.tree
git rev-parse HEAD  # → 返回 HEAD commit hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.head
git restore --staged .
```

> 结果：暂存区=空，工作目录=全量变更。

##### 步骤 5：输出成功提示

```
✓ 已将分支 feature-scheme-1 的变更应用到主 worktree
  可以开始验证了
```

#### 增量 validate（存在历史快照）

当 `~/.clawt/validate-snapshots/<project>/<branchName>.tree` 存在时，自动进入增量模式：

##### 步骤 1：读取旧快照

在清空主 worktree 之前，读取上次保存的快照 tree hash 及当时的 HEAD commit hash。

##### 步骤 2：确保主 worktree 干净

如果主 worktree 有残留状态，让用户选择处理方式（同首次 validate 步骤 1 的交互），做兜底清理。

##### 步骤 3：从目标分支获取最新全量变更

通过 patch 方式从目标分支获取最新全量变更（流程同首次 validate 的步骤 3）。

##### 步骤 4：保存最新快照为 git tree 对象

将最新全量变更保存为新的 tree 对象（覆盖旧快照），同时记录当前 HEAD commit hash（流程同首次 validate 的步骤 4）。

##### 步骤 5：将旧变更状态载入暂存区

根据主分支 HEAD 是否发生变化，选择不同的策略将旧变更载入暂存区：

**情况 A：HEAD 未变化（或旧版快照无 HEAD 信息）**

直接通过 `git read-tree` 将旧 tree 对象载入暂存区：

```bash
git read-tree <旧 tree hash>
```

- **读取成功** → 结果：暂存区=上次快照，工作目录=最新全量变更（用户可通过 `git diff` 查看增量差异）
- **读取失败**（tree 对象可能被 git gc 回收）→ 降级为全量模式，暂存区保持为空，等同于首次 validate 的结果

**情况 B：HEAD 发生了变化（如主分支合并了其他分支）**

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
- **无冲突** → apply --cached 到当前 HEAD 暂存区，结果与情况 A 一致
- **有冲突** → 降级为全量模式（暂存区保持为空），等同于首次 validate 的结果

##### 步骤 6：输出成功提示

```
# 增量模式成功
✓ 已将分支 feature-scheme-1 的最新变更应用到主 worktree（增量模式）
  暂存区 = 上次快照，工作目录 = 最新变更

# 增量降级为全量
✓ 已将分支 feature-scheme-1 的变更应用到主 worktree
  可以开始验证了
```

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

  1. ~/.clawt/worktrees/main-project/feature-scheme-1  →  分支: feature-scheme-1
  2. ~/.clawt/worktrees/main-project/feature-scheme-2  →  分支: feature-scheme-2
  3. ~/.clawt/worktrees/main-project/feature-scheme-3  →  分支: feature-scheme-3

是否同时删除对应的本地分支？(y/N)
```

5. 用户确认后（只需确认一次），依次执行：

```bash
# 移除 worktree
git worktree remove -f <worktree路径>

# 如果用户选择了删除分支
git branch -D <branchName>

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
     1. 获取主分支名（`git rev-parse --abbrev-ref HEAD`）
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
     # 修剪 worktree 引用
     git worktree prune
     # 如果项目 worktree 目录为空，则清理空目录
     ```
   - 输出清理成功提示：`✓ 已清理 worktree 和分支: <branchName>`

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
  "aliases": {}
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
3. **解析目标 worktree（多选模式）**：统一使用 `resolveTargetWorktrees`（多选版本）解析目标 worktree，匹配策略如下：
   - **未传 `-b` 参数**：
     - 获取当前项目所有 worktree
     - 无可用 worktree → 报错退出
     - 仅 1 个 worktree → 直接使用，无需选择
     - 多个 worktree → 通过交互式多选列表（Enquirer.MultiSelect）让用户选择（空格选择，回车确认），顶部提供「全选」选项
   - **传了 `-b` 参数**：
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

当目标 worktree 的分支与主分支差异过大（例如主分支有了新的提交），导致 `clawt validate` 的 patch apply 失败时，可以通过 `clawt sync` 将主分支最新代码合并到目标 worktree，使其保持与主分支同步。

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
3. **获取主分支名**：通过 `git rev-parse --abbrev-ref HEAD` 获取主 worktree 当前分支名（不硬编码 main/master）
4. **自动保存未提交变更**：检查目标 worktree 是否有未提交修改
   - 有修改 → 自动执行 `git add . && git commit -m "<AUTO_SAVE_COMMIT_MESSAGE>"` 保存变更（commit message 由常量 `AUTO_SAVE_COMMIT_MESSAGE` 定义，值为 `chore: auto-save before sync`，同时用于 merge 命令的 squash 检测）
   - 无修改 → 跳过
5. **在目标 worktree 中合并主分支**：
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>
   git merge <mainBranch>
   ```
6. **冲突处理**：
   - **有冲突** → 输出警告，提示用户进入目标 worktree 手动解决：
     ```
     合并存在冲突，请进入目标 worktree 手动解决：
       cd ~/.clawt/worktrees/<project>/<branchName>
       解决冲突后执行 git add . && git merge --continue
       clawt validate -b <branch> 验证变更
     ```
   - **无冲突** → 继续
7. **清除 validate 快照**：合并成功后，如果该分支存在 validate 快照（`.tree` 和 `.head` 文件），自动删除（代码基础已变化，旧快照无效）
8. **输出成功提示**：
   ```
   ✓ 已将 <mainBranch> 的最新代码同步到 <branchName>
   ```

---

### 5.13 重置主 Worktree 工作区和暂存区

**命令：**

```bash
clawt reset
```

**无参数。**

**使用场景：**

当用户通过 `clawt validate` 将分支变更迁移到主 worktree 后，希望快速清除工作区和暂存区的所有修改，恢复到干净状态。与 `clawt validate --clean` 的区别在于：`reset` 仅重置工作区和暂存区，**不删除** validate 快照文件，适用于只想清空变更而保留快照以便后续增量 validate 的场景。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **检测工作区状态**：通过 `git status --porcelain` 检测主 worktree 是否有未提交的更改
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

在管理多个 worktree 时，快速了解项目全局状态：主 worktree 当前分支及干净状态、所有 worktree 的变更情况和与主分支的同步状态、未清理的 validate 快照。

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
     - **快照状态**（是否存在 validate 快照）
4. **收集未清理的 validate 快照**：
   - 通过 `getProjectSnapshotBranches()` 扫描快照目录下的 `.tree` 文件获取所有存在快照的分支名
   - 对比现有 worktree 分支列表，标识孤立快照（对应 worktree 已不存在的快照）
5. **输出状态信息**：
   - 指定 `--json` → 以 JSON 格式输出完整状态数据（`JSON.stringify`）
   - 未指定 → 以文本格式输出

**文本输出格式（默认）：**

输出分为三个区块：主 Worktree、Worktree 列表、未清理的 Validate 快照。

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
    有 validate 快照

  ● feature-signup   [未提交修改]
    +45 -10   1 个本地提交   落后主分支 2 个提交

────────────────────────────────────────

  ◆ 未清理的 Validate 快照 (1 个)

  ⚠ old-feature   (对应 worktree 已不存在)

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

**快照区块：**

- 每个快照显示对应的分支名
- 如果对应的 worktree 仍存在，显示蓝色圆点图标
- 如果对应的 worktree 已不存在（孤立快照），显示黄色警告图标并标注 `(对应 worktree 已不存在)`

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
      "hasSnapshot": true,
      "insertions": 120,
      "deletions": 30
    }
  ],
  "snapshots": [
    {
      "branch": "old-feature",
      "worktreeExists": false
    }
  ],
  "totalWorktrees": 1
}
```

**实现要点：**

- 类型定义在 `src/types/status.ts`：`WorktreeDetailedStatus`、`MainWorktreeStatus`、`SnapshotInfo`、`StatusResult`
- 消息常量在 `MESSAGES.STATUS_*` 系列
- `getCommitCountBehind()` 是新增的工具函数（在 `src/utils/git.ts`），通过 `git rev-list --count <branch>..HEAD` 计算落后提交数
- `getProjectSnapshotBranches()` 是新增的工具函数（在 `src/utils/validate-snapshot.ts`），通过扫描快照目录下的 `.tree` 文件提取分支名列表

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

## 6. 错误处理规范

### 6.1 通用错误处理

| 错误场景                          | 处理方式                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| 不在主 worktree 根目录执行         | 输出错误提示，退出 (exit code 1)                            |
| Git 未安装                        | 输出错误提示，退出 (exit code 1)                            |
| Claude Code CLI 未安装            | 输出错误提示，退出 (exit code 1)（`clawt run` 和 `clawt resume` 时检测）    |
| 分支已存在                        | 输出错误提示，退出 (exit code 1)                            |
| Worktree 路径已存在               | 输出错误提示，退出 (exit code 1)                            |
| Git 命令执行失败                  | 捕获 stderr，记录日志，输出错误提示，退出 (exit code 1)      |
| 目标 worktree 不存在              | 输出错误提示（列出可用 worktree），退出 (exit code 1)        |

### 6.2 退出码

| 退出码 | 说明           |
| ------ | -------------- |
| `0`    | 成功           |
| `1`    | 一般错误       |
| `2`    | 参数错误       |

---

## 7. 非功能性需求

### 7.1 性能

- Worktree 创建为串行执行（Git worktree 不支持并行写入）
- Claude Code 任务为并行执行（各自独立进程）
- 任务完成检测：监听子进程 `close` 事件，事件驱动

### 7.2 兼容性

- 支持 macOS 和 Linux
- Node.js >= 18
- Git >= 2.15（worktree 功能稳定版本）

### 7.3 测试

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

### 7.4 安全性

- 不在日志中记录 Claude Code API 密钥等敏感信息
- `--permission-mode bypassPermissions` 仅在 worktree 隔离环境中使用
- 所有用户输入（分支名等）都需要校验和转义
