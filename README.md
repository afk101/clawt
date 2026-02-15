# Clawt

基于本地 Git 项目创建多个隔离的 worktree 环境，并行执行多个 Claude Code Agent 任务，所有 Agent 的代码修改互不干扰。

## 安装

```bash
npm i -g clawt
```

**环境要求：**

- Node.js >= 18
- Git >= 2.15
- Claude Code CLI（`clawt run` 和 `clawt resume` 需要）

## 使用前提

所有命令**必须在主 worktree 的仓库根目录**下执行（即包含 `.git` 目录的原始仓库）。在子 worktree 或子目录中执行会被拒绝。

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

不传 `--tasks` 时会创建单个 worktree，并在其中直接启动 Claude Code 交互式界面（通过 `spawnSync` + `inherit stdio`），让用户与 Claude Code 直接交互。启动命令由配置项 `claudeCodeCommand` 指定（默认 `claude`）。

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
clawt resume -b <branchName>
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 是 | 要恢复的分支名 |

在之前通过 `clawt run` 或 `clawt create` 创建的 worktree 中重新打开 Claude Code 交互式界面，继续之前的工作。启动命令由配置项 `claudeCodeCommand` 指定（默认 `claude`）。

```bash
# 在已有 worktree 中恢复会话
clawt resume -b feature-login
```

### `clawt validate` — 在主 worktree 验证分支变更

```bash
clawt validate -b <branchName> [--clean]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 是 | 要验证的分支名 |
| `--clean` | 否 | 清理 validate 状态（重置主 worktree 并删除快照） |

将目标 worktree 的变更通过 `git stash` 迁移到主 worktree，方便在主 worktree 中直接测试，无需重新安装依赖。

支持增量模式：首次 validate 后会自动保存快照，再次 validate 同一分支时会将上次快照应用到暂存区、最新变更保留在工作目录，用户可通过 `git diff` 查看两次 validate 之间的增量差异。使用 `--clean` 可清理 validate 状态（重置主 worktree 并删除快照文件）。

```bash
# 首次验证
clawt validate -b feature-scheme-1

# 再次验证（增量模式，可通过 git diff 查看增量差异）
clawt validate -b feature-scheme-1

# 清理 validate 状态
clawt validate -b feature-scheme-1 --clean
```

### `clawt merge` — 合并分支到主 worktree

```bash
clawt merge -b <branchName> [-m <commitMessage>]
```

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `-b` | 是 | 要合并的分支名 |
| `-m` | 否 | 提交信息（目标 worktree 工作区有修改时必填） |

将目标 worktree 的变更合并到主 worktree 的当前分支，并推送到远程仓库。如果目标 worktree 工作区有未提交的修改，需要通过 `-m` 提供提交信息；如果目标 worktree 已经提交过（工作区干净但有本地提交），可以省略 `-m` 直接合并。merge 成功后会询问是否清理对应的 worktree 和分支（如果配置了 `autoDeleteBranch: true` 则自动清理）。

```bash
# 目标 worktree 有未提交修改，需提供 -m
clawt merge -b feature-scheme-1 -m "feat: 实现用户登录功能"

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

# 移除指定分支名下的所有 worktree
clawt remove -b feature-scheme

# 移除指定分支名的某一个 worktree
clawt remove -b feature-scheme -i 2
```

移除时会询问是否同时删除对应的本地分支。

### `clawt list` — 列出当前项目所有 worktree

```bash
clawt list
```

列出当前项目在 `~/.clawt/worktrees/` 下的所有 worktree 及对应分支。

### `clawt config` — 查看全局配置

```bash
clawt config
```

读取并展示全局配置文件 `~/.clawt/config.json` 中的所有配置项，包括每项的当前值和描述说明。编辑配置需直接修改配置文件。

## 配置文件

安装后会自动在 `~/.clawt/config.json` 生成全局配置文件：

```json
{
  "autoDeleteBranch": false,
  "claudeCodeCommand": "claude",
  "autoPullPush": false
}
```

| 配置项 | 类型 | 默认值 | 说明 |
| ------ | ---- | ------ | ---- |
| `autoDeleteBranch` | `boolean` | `false` | 移除 worktree 时自动删除对应本地分支；merge 成功后自动清理 worktree 和分支；run 中断后自动清理本次创建的 worktree 和分支 |
| `claudeCodeCommand` | `string` | `"claude"` | Claude Code CLI 启动指令，用于 `clawt run` 不传 `--tasks` 时和 `clawt resume` 在 worktree 中打开交互式界面 |
| `autoPullPush` | `boolean` | `false` | merge 成功后是否自动执行 git pull 和 git push |

## 分支名规则

分支名中的特殊字符（`/`、`.`、空格、`~` 等）会被自动替换为 `-`，连续的 `-` 会被压缩，首尾 `-` 会被去除。发生转换时会在终端提示。

```
feature/a.b  →  feature-a-b
```

## 日志

日志保存在 `~/.clawt/logs/` 目录，按日期滚动，保留 30 天。
