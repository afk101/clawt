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
  - [5.10 查看全局配置](#510-查看全局配置)
  - [5.11 在已有 Worktree 中恢复会话](#511-在已有-worktree-中恢复会话)
  - [5.12 将主分支代码同步到目标 Worktree](#512-将主分支代码同步到目标-worktree)
  - [5.13 重置主 Worktree 工作区和暂存区](#513-重置主-worktree-工作区和暂存区)
- [6. 错误处理规范](#6-错误处理规范)
- [7. 非功能性需求](#7-非功能性需求)

---

## 1. 技术栈

| 类别     | 选型                          |
| -------- | ----------------------------- |
| 运行时   | Node.js >= 18                 |
| 语言     | TypeScript                    |
| 包管理   | npm                           |
| CLI 框架 | Commander.js                  |
| 日志库   | winston (按日期滚动文件)       |
| 交互式   | enquirer (选项选择/确认对话)   |
| 构建     | tsup / tsc                    |
| 分发     | npm 全局安装 (`npm i -g clawt`) |

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
| `clawt run`           | 批量创建 worktree + 启动 Claude Code 执行任务    | 5.2      |
| `clawt validate`      | 在主 worktree 验证某个 worktree 分支的变更        | 5.4      |
| `clawt merge`         | 合并某个已验证的 worktree 分支到主 worktree       | 5.6      |
| `clawt remove`        | 移除 worktree（支持单个/批量/全部）               | 5.5      |
| `clawt list`          | 列出当前项目所有 worktree                        | 5.8      |
| `clawt config`        | 查看全局配置                                     | 5.10     |
| `clawt resume`        | 在已有 worktree 中恢复 Claude Code 交互式会话      | 5.11     |
| `clawt sync`          | 将主分支最新代码同步到目标 worktree                  | 5.12     |
| `clawt reset`         | 重置主 worktree 工作区和暂存区                       | 5.13     |

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

# 方式二：不传 --tasks，在 worktree 中打开 Claude Code 交互式界面
clawt run -b <branchName>
```

**参数：**

| 参数      | 必填 | 说明                                                        |
| --------- | ---- | ----------------------------------------------------------- |
| `-b`      | 是   | 分支名                                                      |
| `--tasks` | 否   | 任务描述（可多次指定，每个 --tasks 对应一个任务，任务数量即 worktree 数量）。不传则在 worktree 中打开 Claude Code 交互式界面 |

**交互式 Claude Code 界面模式：**

当不传 `--tasks` 时，会创建单个 worktree，然后通过 `spawnSync` + `inherit stdio` 在该 worktree 中直接启动 Claude Code CLI 交互式界面，让用户与 Claude Code 直接交互。

启动命令通过配置项 `claudeCodeCommand`（默认值 `claude`）指定，支持自定义命令及参数。

**运行流程：**

1. 若传了 `--tasks`，解析得到任务数组 `tasks[]`；若未传，先检测分支是否已存在（已存在则提示使用 `clawt resume -b <branchName>` 恢复会话），然后创建单个 worktree 并启动 Claude Code 交互式界面（流程结束，不进入后续并行执行阶段）
2. `n = tasks.length`
3. 按照 **5.1** 的流程创建 `n` 个 worktree
4. 对每个 worktree 并行启动 Claude Code CLI：
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
4. 在主 worktree 的 clawt 终端实时输出通知：

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
clawt validate -b <branchName> [--clean]
```

**参数：**

| 参数      | 必填 | 说明                                                                     |
| --------- | ---- | ------------------------------------------------------------------------ |
| `-b`      | 是   | 要验证的 worktree 分支名（例如 `feature-scheme-1`）                        |
| `--clean` | 否   | 清理 validate 状态（重置主 worktree 并删除快照）                            |

> **限制：** 单次只能验证一个分支，不支持批量验证。

**背景说明：**

Git worktree 不会包含 `node_modules`、`.venv` 等依赖文件，每次安装依赖耗时较长。利用 `git diff HEAD...branch --binary`（三点 diff）可以获取目标分支自分叉点以来的全量变更（包含已提交和未提交的修改），将其作为 patch 应用到主 worktree 中进行测试，无需重新安装依赖。

**快照机制：**

validate 命令引入了**快照（snapshot）机制**来支持增量对比。每次 validate 执行成功后，会将当前全量变更通过 `git write-tree` 保存为 git tree 对象，并将 tree hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`）。当再次执行 validate 时，通过 `git read-tree` 将上次快照的 tree 对象载入暂存区、最新变更保留在工作目录，用户可通过 `git diff` 直接查看两次 validate 之间的增量差异。由于 tree 对象存储在 git 对象库中，不依赖主分支 HEAD，无需一致性校验。

**运行流程：**

#### `--clean` 模式

当指定 `--clean` 选项时，执行清理逻辑后直接返回，不进入常规 validate 流程：

1. **主 worktree 校验** (2.1)
2. 如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的危险指令和操作后果），用户取消则退出
3. 如果主 worktree 有未提交更改，执行 `git reset --hard` + `git clean -fd` 清空
4. 删除对应分支的快照文件
5. 输出清理成功提示

#### 首次 validate（无历史快照）

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

将主 worktree 工作目录的全量变更保存为 git tree 对象：

```bash
git add .
git write-tree  # → 返回 tree hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.tree
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

##### 步骤 1：读取旧 tree hash

在清空主 worktree 之前，读取上次保存的快照 tree hash。

##### 步骤 2：确保主 worktree 干净

如果主 worktree 有残留状态，让用户选择处理方式（同首次 validate 步骤 1 的交互），做兜底清理。

##### 步骤 3：从目标分支获取最新全量变更

通过 patch 方式从目标分支获取最新全量变更（流程同首次 validate 的步骤 3）。

##### 步骤 4：保存最新快照为 git tree 对象

将最新全量变更保存为新的 tree 对象（覆盖旧快照，流程同首次 validate 的步骤 4）。

##### 步骤 5：将旧 tree 对象载入暂存区

```bash
git read-tree <旧 tree hash>
```

- **读取成功** → 结果：暂存区=上次快照，工作目录=最新全量变更（用户可通过 `git diff` 查看增量差异）
- **读取失败**（tree 对象可能被 git gc 回收）→ 降级为全量模式，暂存区保持为空，等同于首次 validate 的结果

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
clawt remove [options]
```

**参数：**

| 参数      | 说明                                                       |
| --------- | ---------------------------------------------------------- |
| `--all`   | 移除当前项目 (`~/.clawt/worktrees/<project>/`) 下所有 worktree |
| `-b <branchName>` | 移除匹配 branchName 或 branchName-* 的 worktree      |

**三种移除粒度：**

| 粒度 | 命令示例                                 | 移除范围                                                      |
| ---- | ---------------------------------------- | ------------------------------------------------------------- |
| 全部 | `clawt remove --all`                     | `~/.clawt/worktrees/<project>/` 下所有 worktree                |
| 分支 | `clawt remove -b feature-scheme`         | `~/.clawt/worktrees/<project>/feature-scheme-*` 的所有 worktree |
| 单个 | `clawt remove -b feature-scheme-2`       | 仅移除 `feature-scheme-2` 对应的 worktree（完整分支名精确匹配）    |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. 根据参数确定要移除的 worktree 列表
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
clawt merge -b <branchName> [-m <commitMessage>]
```

**参数：**

| 参数 | 必填 | 说明                                     |
| ---- | ---- | ---------------------------------------- |
| `-b` | 是   | 要合并的分支名                           |
| `-m` | 否   | 提交信息（目标 worktree 工作区有修改时必填） |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **主 worktree 状态检测**
   - 执行 `git status --porcelain`
   - 如果有更改：
     - 如果存在该分支的 validate 快照（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），额外输出警告提示用户可先执行 `clawt validate -b <branchName> --clean` 清理
     - 提示 `主 worktree 有未提交的更改，请先处理`，退出
   - 无更改 → 继续
3. **Squash 检测与执行（auto-save 临时提交压缩）**
   - 通过 `git log HEAD..<branchName> --format=%s` 检查目标分支是否存在以 `AUTO_SAVE_COMMIT_MESSAGE`（`chore: auto-save before sync`）为前缀的 commit
   - **不存在** → 跳过，进入步骤 4
   - **存在** → 提示用户是否将所有提交压缩为一个：
     ```
     检测到 sync 产生的临时提交，是否将所有提交压缩为一个？
       压缩后变更将保留在目标worktree的暂存区，需要重新提交
     ```
   - **用户选择不压缩** → 跳过，进入步骤 4
   - **用户选择压缩** →
     1. 获取主分支名（`git rev-parse --abbrev-ref HEAD`）
     2. 计算分叉点：`git merge-base <mainBranch> <branchName>`
     3. 在目标 worktree 中执行 `git reset --soft <merge-base>`，将所有 commit 撤销到暂存区
     4. 如果用户提供了 `-m` → 直接在目标 worktree 执行 `git commit -m '<commitMessage>'`，输出成功提示，继续步骤 4
     5. 如果用户未提供 `-m` → 提示用户前往目标 worktree 自行提交后重新执行 `clawt merge`，**退出流程**
4. **根据目标 worktree 状态决定是否需要提交**
   - 检测目标 worktree 工作区是否干净（`git status --porcelain`）
   - **工作区有未提交修改**：
     - 如果用户未提供 `-m`，提示 `目标 worktree 有未提交的修改，请通过 -m 参数提供提交信息`，退出
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
5. **回到主 worktree 进行合并**
   ```bash
   cd <主 worktree 路径>
   git merge <branchName>
   ```
6. **冲突检测**
   - 检查 merge 退出码及 `git status` 是否存在冲突
   - **有冲突** → 提示 `合并存在冲突，请手动处理`，退出
   - **无冲突** → 继续
7. **推送（受 `autoPullPush` 配置控制）**
   ```bash
   # 仅当 autoPullPush 为 true 时执行
   git pull
   git push
   ```
8. **输出成功提示**

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

9. **merge 成功后清理 worktree 和分支（可选）**
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

10. **清理 validate 快照**
    - merge 成功后，如果存在该分支的 validate 快照（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），自动删除该快照文件（merge 成功后快照已无意义）

> **注意：** 清理确认在 merge 操作之前询问（避免 merge 成功后因交互中断而遗留未清理的 worktree），但清理操作在 merge 成功后才执行。

---

### 5.7 默认配置文件

**路径：** `~/.clawt/config.json`

**生成时机：** npm 全局安装后自动生成（通过 npm 的 `postinstall` 脚本）。

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
  "confirmDestructiveOps": true
}
```

**配置项说明：**

| 配置项             | 类型      | 默认值    | 说明                                               |
| ------------------ | --------- | --------- | -------------------------------------------------- |
| `autoDeleteBranch` | `boolean` | `false`   | 移除 worktree 时是否自动删除对应本地分支（无需每次确认）；merge 成功后是否自动清理 worktree 和分支；run 任务被中断（Ctrl+C）后是否自动清理本次创建的 worktree 和分支 |
| `claudeCodeCommand` | `string` | `"claude"` | Claude Code CLI 启动指令，用于 `clawt run` 不传 `--tasks` 时和 `clawt resume` 在 worktree 中打开交互式界面 |
| `autoPullPush` | `boolean` | `false` | merge 成功后是否自动执行 git pull 和 git push |
| `confirmDestructiveOps` | `boolean` | `true` | 执行破坏性操作（reset、validate --clean）前是否提示确认 |

---

### 5.8 获取当前项目所有 Worktree

**命令：**

```bash
clawt list
```

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. 扫描 `~/.clawt/worktrees/<project>/` 目录
4. 对每个子目录，验证是否为有效的 git worktree（`git worktree list` 交叉验证）
5. 输出列表

**输出格式：**

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

---

### 5.10 查看全局配置

**命令：**

```bash
clawt config
```

**运行流程：**

1. 读取全局配置文件 `~/.clawt/config.json`
2. 遍历所有配置项（以 `CONFIG_DEFINITIONS` 为单一数据源），逐项展示：
   - 配置项名称（粗体）
   - 当前值（布尔值绿色/黄色，字符串青色）
   - 配置项描述（灰色）
3. 输出配置文件路径，提示用户可直接编辑

**输出格式：**

```
配置文件路径: ~/.clawt/config.json
────────────────────────────────────────
  autoDeleteBranch: false
  移除 worktree 时是否自动删除对应本地分支

  claudeCodeCommand: claude
  Claude Code CLI 启动指令

  autoPullPush: false
  merge 成功后是否自动执行 git pull 和 git push

  confirmDestructiveOps: true
  执行破坏性操作（reset、validate --clean）前是否提示确认

────────────────────────────────────────

```

---

### 5.11 在已有 Worktree 中恢复会话

**命令：**

```bash
clawt resume -b <branchName>
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b` | 是   | 要恢复的分支名（对应已有 worktree 的分支）               |

**使用场景：**

当用户之前通过 `clawt run` 或 `clawt create` 创建了 worktree 但会话已结束，希望在该 worktree 中重新打开 Claude Code 交互式界面继续工作。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **Claude Code CLI 校验**：确认 `claude` CLI 可用
3. **查找目标 worktree**：在当前项目的 worktree 列表中按分支名查找匹配的 worktree
   - 未找到 → 报错退出
   - 找到 → 继续
4. **启动 Claude Code 交互式界面**：通过 `launchInteractiveClaude()` 在目标 worktree 中启动 Claude Code CLI 交互式界面（使用 `spawnSync` + `inherit stdio`）

启动命令通过配置项 `claudeCodeCommand`（默认值 `claude`）指定，与 `clawt run` 不传 `--tasks` 时的交互式界面行为一致。

---

### 5.12 将主分支代码同步到目标 Worktree

**命令：**

```bash
clawt sync -b <branchName>
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b` | 是   | 要同步的分支名（对应已有 worktree 的分支）               |

**使用场景：**

当目标 worktree 的分支与主分支差异过大（例如主分支有了新的提交），导致 `clawt validate` 的 patch apply 失败时，可以通过 `clawt sync` 将主分支最新代码合并到目标 worktree，使其保持与主分支同步。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **检查目标 worktree 是否存在**：确认 `~/.clawt/worktrees/<project>/<branchName>` 目录存在
   - 不存在 → 报错退出
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
7. **清除 validate 快照**：合并成功后，如果该分支存在 validate 快照（`.tree` 文件），自动删除（代码基础已变化，旧快照无效）
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

### 7.3 安全性

- 不在日志中记录 Claude Code API 密钥等敏感信息
- `--permission-mode bypassPermissions` 仅在 worktree 隔离环境中使用
- 所有用户输入（分支名等）都需要校验和转义
