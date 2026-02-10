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
| 交互式   | inquirer (选项选择/确认对话)   |
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

# 方式二：不传 --tasks，进入交互式输入模式（单任务）
clawt run -b <branchName>
```

**参数：**

| 参数      | 必填 | 说明                                                        |
| --------- | ---- | ----------------------------------------------------------- |
| `-b`      | 是   | 分支名                                                      |
| `--tasks` | 否   | 任务描述（可多次指定，每个 --tasks 对应一个任务，任务数量即 worktree 数量）。不传则进入交互式输入模式 |

**交互式输入模式：**

当不传 `--tasks` 时，会启动一个多行文本输入框，支持：

- **Enter**：确认提交任务
- **Shift+Enter / Alt+Enter**：手动换行
- **粘贴多行文本**：自动识别粘贴操作（通过 Bracketed Paste Mode 检测），粘贴内容中的换行会被保留

交互式输入模式仅支持输入单个任务（创建 1 个 worktree）。

**运行流程：**

1. 若传了 `--tasks`，解析得到任务数组 `tasks[]`；若未传，进入交互式输入获取单个任务
2. `n = tasks.length`
3. 按照 **5.1** 的流程创建 `n` 个 worktree
4. 对每个 worktree 并行启动 Claude Code CLI：
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>-<i>
   claude -p "<tasks[i]>" --output-format json --permission-mode bypassPermissions
   ```
5. 进入**事件监听通知**阶段（见 [5.3](#53-任务完成通知机制)）

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
clawt validate -b <branchName>
```

**参数：**

| 参数 | 必填 | 说明                                                                     |
| ---- | ---- | ------------------------------------------------------------------------ |
| `-b` | 是   | 要验证的 worktree 分支名（例如 `feature-scheme-1`）                        |

> **限制：** 单次只能验证一个分支，不支持批量验证。

**背景说明：**

Git worktree 不会包含 `node_modules`、`.venv` 等依赖文件，每次安装依赖耗时较长。利用 `git stash` 可以在所有 worktree 间共享的特性，将目标 worktree 的变更迁移到主 worktree 进行测试，无需重新安装依赖。

**运行流程：**

#### 步骤 1：检测主 worktree 工作区状态

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

#### 步骤 2：在目标 worktree 中创建 stash

```bash
# 定位目标 worktree
cd ~/.clawt/worktrees/<project>/<branchName>

# 校验目标 worktree 是否有更改
git status --porcelain
```

- **无更改** → 输出提示 `该 worktree 的分支上没有任何更改，无需验证`，退出
- **有更改** → 继续

```bash
git add .
git stash push -m "clawt:validate:<branchName>"
git stash apply
git restore --staged .
```

> 此步骤结束后，目标 worktree 的代码保持原样（变更仍然存在于工作区），同时变更已被记录到共享的 stash 中。

#### 步骤 3：在主 worktree 应用 stash

```bash
# 回到主 worktree
cd <主 worktree 路径>

# 校验 stash@{0} 是否为我们创建的
git stash list
```

检查 `stash@{0}` 的消息是否包含 `clawt:validate:<branchName>`：

- **不包含** → 报错：`git stash list 已变更，请重新执行`，退出
- **包含** → 继续

```bash
git stash pop stash@{0}
```

#### 步骤 4：输出成功提示

```
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
| `-b <branchName>` | 移除指定 branchName 下的所有 worktree               |
| `-b <branchName> -i <index>` | 移除指定 branchName 的某一个 worktree (如 `branchName-2`) |

**三种移除粒度：**

| 粒度 | 命令示例                                 | 移除范围                                                      |
| ---- | ---------------------------------------- | ------------------------------------------------------------- |
| 全部 | `clawt remove --all`                     | `~/.clawt/worktrees/<project>/` 下所有 worktree                |
| 分支 | `clawt remove -b feature-scheme`         | `~/.clawt/worktrees/<project>/feature-scheme-*` 的所有 worktree |
| 单个 | `clawt remove -b feature-scheme -i 2`    | 仅移除 `~/.clawt/worktrees/<project>/feature-scheme-2`          |

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
```

6. 如果配置文件 `~/.clawt/config.json` 中 `autoDeleteBranch` 为 `true`，则跳过询问，直接删除分支。

7. 移除完成后，清理空目录（如果 `~/.clawt/worktrees/<project>/` 下已无 worktree，则删除该项目目录）。

---

### 5.6 合并验证过的分支

**命令：**

```bash
clawt merge -b <branchName> -m <commitMessage>
```

**参数：**

| 参数 | 必填 | 说明               |
| ---- | ---- | ------------------ |
| `-b` | 是   | 要合并的分支名     |
| `-m` | 是   | 提交信息           |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **参数校验**
   - 如果用户未提供 `-m`，提示 `请提供提交信息（-m 参数）`，退出
3. **主 worktree 状态检测**
   - 执行 `git status --porcelain`
   - 如果有更改 → 提示 `主 worktree 有未提交的更改，请先处理`，退出
   - 无更改 → 继续
4. **在目标 worktree 中提交**
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>
   git add .
   git commit -m '<commitMessage>'
   ```
5. **回到主 worktree 进行合并**
   ```bash
   cd <主 worktree 路径>
   git merge <branchName>
   ```
6. **冲突检测**
   - 检查 merge 退出码及 `git status` 是否存在冲突
   - **有冲突** → 提示 `合并存在冲突，请手动处理`，退出
   - **无冲突** → 继续
7. **推送**
   ```bash
   git pull
   git push
   ```
8. **输出成功提示**

```
✓ 分支 feature-scheme-1 已成功合并到当前分支
  提交信息: <commitMessage>
  已推送到远程仓库
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
  "autoDeleteBranch": false
}
```

**配置项说明：**

| 配置项             | 类型      | 默认值  | 说明                                               |
| ------------------ | --------- | ------- | -------------------------------------------------- |
| `autoDeleteBranch` | `boolean` | `false` | 移除 worktree 时是否自动删除对应本地分支（无需每次确认）；merge 成功后是否自动清理 worktree 和分支 |

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

## 6. 错误处理规范

### 6.1 通用错误处理

| 错误场景                          | 处理方式                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| 不在主 worktree 根目录执行         | 输出错误提示，退出 (exit code 1)                            |
| Git 未安装                        | 输出错误提示，退出 (exit code 1)                            |
| Claude Code CLI 未安装            | 输出错误提示，退出 (exit code 1)（仅 `clawt run` 时检测）    |
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
