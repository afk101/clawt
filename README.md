# Clawt

基于本地 Git 项目创建多个隔离的 worktree 环境，并行执行多个 Claude Code Agent 任务，所有 Agent 的代码修改互不干扰。

## 安装

```bash
# 推荐
pnpm add -g clawt

# 或使用 npm
npm i -g clawt
```

**环境要求：**

- Node.js >= 18
- Git >= 2.15
- Claude Code CLI（`clawt run` 和 `clawt resume` 需要）

## 使用前提

所有命令**必须在主 worktree 的仓库根目录**下执行（即包含 `.git` 目录的原始仓库）。在子 worktree 或子目录中执行会被拒绝。

## 全局选项

| 选项 | 说明 |
| ---- | ---- |
| `--debug` | 输出详细调试信息到终端，实时显示带颜色和时间戳的日志 |

`--debug` 可与任意子命令组合使用：

```bash
clawt run -b feature-login --debug
clawt validate -b scheme --debug
```

## 命令

### `clawt create` — 批量创建 worktree

```bash
clawt create -b <branchName> [-n <count>]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 是 | 分支名 |
| `-n` | 否 | 创建数量，默认 `1` |

创建 1 个时，分支名即为 `<branchName>`；创建多个时，分支名会自动加后缀编号：`<branchName>-1`、`<branchName>-2`……

```bash
# 创建 1 个 worktree
clawt create -b feature-login

# 创建 3 个 worktree
clawt create -b feature-scheme -n 3
```

### `clawt run` — 批量创建 worktree + 并行执行 Claude Code 任务

```bash
# 多任务并行
clawt run -b <branchName> --tasks <task1> --tasks <task2> --tasks <task3>

# 单 worktree + Claude Code 交互式界面
clawt run -b <branchName>
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 是 | 分支名 |
| `--tasks` | 否 | 任务描述，可多次指定，任务数量即 worktree 数量。不传则在 worktree 中打开 Claude Code 交互式界面 |

每个 `--tasks` 对应一个独立的 worktree，Claude Code 会在各自隔离的环境中并行执行任务。任务完成后会实时通知结果，全部完成后输出汇总信息。

不传 `--tasks` 时会创建单个 worktree，并在其中直接启动 Claude Code 交互式界面（通过 `spawnSync` + `inherit stdio`），让用户与 Claude Code 直接交互。启动命令由配置项 `claudeCodeCommand` 指定（默认 `claude`）。如果指定的分支已存在，会提示使用 `clawt resume -b <branchName>` 恢复会话。

任务执行过程中按 Ctrl+C 可中断所有任务。中断后会根据配置自动清理或询问是否清理本次创建的 worktree 和分支（`autoDeleteBranch: true` 时自动清理）。

```bash
# 多任务并行
clawt run -b feature-scheme \
  --tasks "实现用户登录功能" \
  --tasks "实现用户注册功能" \
  --tasks "实现密码重置功能"

# 单 worktree，打开 Claude Code 交互式界面
clawt run -b feature-login
```

### `clawt resume` — 在已有 worktree 中恢复 Claude Code 会话

```bash
# 指定分支名（支持模糊匹配）
clawt resume -b <branchName>

# 不指定分支名（列出所有分支供选择）
clawt resume
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 否 | 要恢复的分支名（支持模糊匹配，不传则列出所有分支供选择） |

在之前通过 `clawt run` 或 `clawt create` 创建的 worktree 中重新打开 Claude Code 交互式界面，继续之前的工作。启动命令由配置项 `claudeCodeCommand` 指定（默认 `claude`）。

**分支匹配策略：**
- 传 `-b` 时，优先精确匹配分支名；未精确匹配则进行模糊匹配（子串匹配，大小写不敏感）；模糊匹配到多个时通过交互列表选择；无匹配时报错并列出所有可用分支
- 不传 `-b` 时，列出当前项目所有可用分支供交互式选择（仅 1 个时自动使用）

```bash
# 精确匹配
clawt resume -b feature-login

# 模糊匹配（匹配包含 "login" 的分支）
clawt resume -b login

# 交互式选择所有分支
clawt resume
```

### `clawt validate` — 在主 worktree 验证分支变更

```bash
# 指定分支名（支持模糊匹配）
clawt validate -b <branchName> [--clean]

# 不指定分支名（列出所有分支供选择）
clawt validate [--clean]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 否 | 要验证的分支名（支持模糊匹配，不传则列出所有分支供选择） |
| `--clean` | 否 | 清理 validate 状态（重置主 worktree 并删除快照） |

将目标 worktree 的变更通过 `git diff`（三点 diff）迁移到主 worktree，方便在主 worktree 中直接测试，无需重新安装依赖。同时检测未提交修改和已提交 commit，确保所有变更都能被捕获。

**分支匹配策略：**
- 传 `-b` 时，优先精确匹配分支名；未精确匹配则进行模糊匹配（子串匹配，大小写不敏感）；模糊匹配到多个时通过交互列表选择；无匹配时报错并列出所有可用分支
- 不传 `-b` 时，列出当前项目所有可用分支供交互式选择（仅 1 个时自动使用）

支持增量模式：首次 validate 后会自动保存快照（通过 `git write-tree` 将变更存储为 git tree 对象，并记录当前 HEAD commit hash），再次 validate 同一分支时会将上次快照载入暂存区、最新变更保留在工作目录，用户可通过 `git diff` 查看两次 validate 之间的增量差异。当主分支 HEAD 发生变化（如合并了其他分支）时，会自动将旧变更 patch 重放到当前 HEAD 暂存区上，避免 diff 混入 HEAD 变化的内容；若 patch 存在冲突则自动降级为全量模式。使用 `--clean` 可清理 validate 状态（重置主 worktree 并删除快照文件）。

> **提示：** 如果 validate 时 patch apply 失败（目标分支与主分支差异过大），可先执行 `clawt sync -b <branchName>` 同步主分支后重试。

```bash
# 精确匹配分支名
clawt validate -b feature-scheme-1

# 模糊匹配（匹配包含 "scheme" 的分支）
clawt validate -b scheme

# 交互式选择所有分支
clawt validate

# 再次验证（增量模式，可通过 git diff 查看增量差异）
clawt validate -b feature-scheme-1

# 清理 validate 状态（同样支持模糊匹配）
clawt validate -b feature-scheme-1 --clean
clawt validate --clean
```

### `clawt sync` — 将主分支代码同步到目标 worktree

```bash
# 指定分支名（支持模糊匹配）
clawt sync -b <branchName>

# 不指定分支名（列出所有分支供选择）
clawt sync
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 否 | 要同步的分支名（支持模糊匹配，不传则列出所有分支供选择） |

将主分支最新代码合并到目标 worktree 的分支中。如果目标 worktree 有未提交的修改，会自动保存后再合并。存在冲突时会提示用户手动解决。合并成功后会自动清除该分支的 validate 快照（代码基础已变化，旧快照无效）。

**分支匹配策略：**
- 传 `-b` 时，优先精确匹配分支名；未精确匹配则进行模糊匹配（子串匹配，大小写不敏感）；模糊匹配到多个时通过交互列表选择；无匹配时报错并列出所有可用分支
- 不传 `-b` 时，列出当前项目所有可用分支供交互式选择（仅 1 个时自动使用）

```bash
# 精确匹配分支名
clawt sync -b feature-scheme-1

# 模糊匹配（匹配包含 "scheme" 的分支）
clawt sync -b scheme

# 交互式选择所有分支
clawt sync
```

### `clawt merge` — 合并分支到主 worktree

```bash
# 指定分支名（支持模糊匹配）
clawt merge -b <branchName> [-m <commitMessage>]

# 不指定分支名（列出所有分支供选择）
clawt merge [-m <commitMessage>]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 否 | 要合并的分支名（支持模糊匹配，不传则列出所有分支供选择） |
| `-m` | 否 | 提交信息（目标 worktree 工作区有修改时必填） |

将目标 worktree 的变更合并到主 worktree 的当前分支。如果配置了 `autoPullPush: true`，合并后会自动推送到远程仓库。如果目标 worktree 工作区有未提交的修改，需要通过 `-m` 提供提交信息；如果目标 worktree 已经提交过（工作区干净但有本地提交），可以省略 `-m` 直接合并。merge 成功后会询问是否清理对应的 worktree 和分支（如果配置了 `autoDeleteBranch: true` 则自动清理）。

**分支匹配策略：**
- 传 `-b` 时，优先精确匹配分支名；未精确匹配则进行模糊匹配（子串匹配，大小写不敏感）；模糊匹配到多个时通过交互列表选择；无匹配时报错并列出所有可用分支
- 不传 `-b` 时，列出当前项目所有可用分支供交互式选择（仅 1 个时自动使用）

如果检测到目标分支存在 `clawt sync` 产生的临时提交（auto-save commit），会自动提示是否将所有提交压缩（squash）为一个。用户选择压缩后，所有 commit 会被 reset 到暂存区：如果提供了 `-m` 则直接提交并继续合并流程；如果未提供 `-m` 则提示用户前往目标 worktree 自行提交后重新执行 merge。

```bash
# 精确匹配，目标 worktree 有未提交修改，需提供 -m
clawt merge -b feature-scheme-1 -m "feat: 实现用户登录功能"

# 模糊匹配（匹配包含 "scheme" 的分支）
clawt merge -b scheme

# 交互式选择所有分支
clawt merge

# 目标 worktree 已提交过，可省略 -m
clawt merge -b feature-scheme-1
```

### `clawt remove` — 移除 worktree

```bash
clawt remove [options]
```

支持三种移除粒度：

```bash
# 移除当前项目下所有 worktree
clawt remove --all

# 移除指定分支名下的所有 worktree（匹配 feature-scheme 和 feature-scheme-*）
clawt remove -b feature-scheme

# 移除单个 worktree（直接写完整分支名）
clawt remove -b feature-scheme-2
```

移除时会询问是否同时删除对应的本地分支。移除 worktree 时会自动清理对应的 validate 快照；`--all` 模式还会清理整个项目的快照目录。批量移除时单个失败不会中断整个流程，最后汇总报告失败项。

### `clawt list` — 列出当前项目所有 worktree

```bash
clawt list [--json]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `--json` | 否 | 以 JSON 格式输出（仅包含 path 和 branch） |

列出当前项目在 `~/.clawt/worktrees/` 下的所有 worktree 及对应分支。文本模式下，如果某个 worktree 处于空闲状态（0 个提交、无变更、无未提交修改），其路径会以橙色高亮显示，方便快速识别可能需要清理或还未开始工作的 worktree。指定 `--json` 时以 JSON 格式输出，便于脚本解析。

```bash
# 文本格式输出（默认）
clawt list

# JSON 格式输出
clawt list --json
```

### `clawt status` — 显示项目全局状态总览

```bash
clawt status [--json]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `--json` | 否 | 以 JSON 格式输出完整状态数据 |

显示项目全局状态总览，包括：主 worktree 当前分支及干净状态、所有 worktree 的变更状态（已提交/未提交/合并冲突/无变更）、与主分支的差异（领先/落后提交数、行数变更）、未清理的 validate 快照检测（标识孤立快照）。

文本模式下输出分为三个区块：主 Worktree 状态、Worktree 列表（含变更状态标签和差异统计）、未清理的 Validate 快照。指定 `--json` 时以 JSON 格式输出完整状态数据，便于脚本解析。

```bash
# 文本格式输出（默认）
clawt status

# JSON 格式输出
clawt status --json
```

### `clawt reset` — 重置主 worktree 工作区和暂存区

```bash
clawt reset
```

重置主 worktree 的工作区和暂存区（`git reset --hard` + `git clean -f`），恢复到干净状态。如果配置了 `confirmDestructiveOps: true`（默认），执行前会提示确认。与 `clawt validate --clean` 不同，`reset` 不会删除 validate 快照文件，适用于只想清空变更而保留快照以便后续增量 validate 的场景。如果工作区和暂存区已是干净状态，会提示无需重置。

```bash
# 重置主 worktree 工作区和暂存区
clawt reset
```

### `clawt config` — 查看和管理全局配置

```bash
# 查看全局配置
clawt config

# 将配置恢复为默认值
clawt config reset
```

读取并展示全局配置文件 `~/.clawt/config.json` 中的所有配置项，包括每项的当前值和描述说明。编辑配置需直接修改配置文件。

`config reset` 子命令可将配置文件恢复为默认值，执行前会弹出确认提示（受 `confirmDestructiveOps` 配置项控制）。

## 配置文件

安装后会自动在 `~/.clawt/config.json` 生成全局配置文件：

```json
{
  "autoDeleteBranch": false,
  "claudeCodeCommand": "claude",
  "autoPullPush": false,
  "confirmDestructiveOps": true
}
```

| 配置项 | 类型 | 默认值 | 说明 |
| ------ | ---- | ------ | ---- |
| `autoDeleteBranch` | `boolean` | `false` | 移除 worktree 时自动删除对应本地分支；merge 成功后自动清理 worktree 和分支；run 中断后自动清理本次创建的 worktree 和分支 |
| `claudeCodeCommand` | `string` | `"claude"` | Claude Code CLI 启动指令，用于 `clawt run` 不传 `--tasks` 时和 `clawt resume` 在 worktree 中打开交互式界面 |
| `autoPullPush` | `boolean` | `false` | merge 成功后是否自动执行 git pull 和 git push |
| `confirmDestructiveOps` | `boolean` | `true` | 执行破坏性操作（reset、validate --clean、config reset）前是否提示确认 |

## 分支名规则

分支名中的特殊字符（`/`、`.`、空格、`~` 等）会被自动替换为 `-`，连续的 `-` 会被压缩，首尾 `-` 会被去除。发生转换时会在终端提示。

```
feature/a.b  →  feature-a-b
```

## 日志

日志保存在 `~/.clawt/logs/` 目录，按日期滚动，保留 30 天。使用 `--debug` 全局选项可在终端实时查看调试日志。

## 开发

### 测试

项目使用 [Vitest](https://vitest.dev/) 作为测试框架，搭配 `@vitest/coverage-v8` 生成覆盖率报告。

```bash
# 执行全部测试
npm test

# 监听模式（文件变更后自动重新运行）
npm run test:watch

# 执行测试并生成覆盖率报告
npm run test:coverage
```

