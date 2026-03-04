# Clawt

基于 Git Worktree 并行执行多个 Claude Code Agent 任务，所有 Agent 的代码修改互不干扰。

## 安装

```bash
# 推荐
pnpm add -g clawt

# 或使用 npm
npm i -g clawt
```

**环境要求：** Node.js >= 18 · Git >= 2.15 · Claude Code CLI

## 快速开始

```bash
# 1. 在项目根目录（包含 .git 的目录）下执行
# 2. 并行执行 3 个任务，每个任务在独立的 worktree 中运行
clawt run -b <branch-1>
clawt run -b <branch-2>
clawt run -b <branch-3>

# 3. 查看所有 worktree 状态
clawt status

# 4. 验证某个分支的变更（在主 worktree 中测试）
clawt validate -b branch-1

# 5. 确认无误后合并到主分支
clawt merge -b branch-1 -m "feat: 实现xxx功能"

```

## 命令一览

> 所有命令必须在**主 worktree 的仓库根目录**下执行。`-b` 参数支持模糊匹配。

### `clawt init` — 初始化项目级配置

```bash
clawt init                # 以当前分支作为主工作分支进行初始化
clawt init -b <branch>    # 指定主工作分支名
clawt init show           # 交互式查看和修改项目配置
```

设置项目的主工作分支。重复执行会更新主工作分支配置。`init show` 提供交互式面板，可查看和修改项目配置项（如 validate 成功后自动执行的命令）。

### `clawt run` — 创建 worktree 并执行任务

```bash
# 单 worktree，打开 Claude Code 交互式界面（最常用）
clawt run -b <branch>

# 多任务并行（每个 --tasks 对应一个独立 worktree）
clawt run -b <branch> --tasks "任务1" --tasks "任务2"

# 从任务文件读取任务列表（使用文件中定义的分支名）
clawt run -f tasks.md

# 从任务文件读取任务，但用 -b 自动编号分支（文件中分支名可省略）
clawt run -f tasks.md -b feat

# 试运行：仅预览将要创建的 worktree 和任务，不实际执行
clawt run -b <branch> --tasks "任务1" --tasks "任务2" --dry-run
```

**`--dry-run` 预览示例：**

```
════════════════════════════════════════
  Dry Run 预览
════════════════════════════════════════
任务数: 2 │ 并发数: 不限制 │ Worktree: ~/.clawt/worktrees/project
────────────────────────────────────────
✓ [1/2] feat-1
  路径: ~/.clawt/worktrees/project/feat-1
  任务: 任务1

✓ [2/2] feat-2
  路径: ~/.clawt/worktrees/project/feat-2
  任务: 任务2

════════════════════════════════════════
✓ 预览完成，无冲突。移除 --dry-run 即可正式执行。
```

**任务文件格式：**

```markdown
<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现用户登录功能
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch: fix-bug
修复内存泄漏问题
支持多行任务描述
<!-- CLAWT-TASKS:END -->
```

> 使用 `-b` 时，文件中的 `# branch: ...` 行可省略，分支名由 `-b` 值自动编号（如 `feat-1`、`feat-2`）。

按 `Ctrl+C` 可中断所有任务。

### `clawt resume` — 恢复之前的 Claude Code 会话

```bash
clawt resume -b <branch>   # 指定分支
clawt resume                # 交互式多选（按创建日期分组）
```

不传 `-b` 时，分支列表按创建日期分组显示，支持全局全选和按组全选。选 1 个默认在新终端 Tab 中恢复（设置 `resumeInPlace: true` 可改为在当前终端就地恢复），选多个自动在独立终端 Tab 中批量恢复（仅 macOS）。

如果目标 worktree 存在历史会话，会自动继续上次对话（`--continue`）。

> **注意：** 使用 Terminal.app 批量恢复时，需要在「系统设置 → 隐私与安全性 → 辅助功能」中授权终端应用。iTerm2 无需额外授权。终端类型可通过配置项 `terminalApp` 指定。

### `clawt create` — 仅创建 worktree（不执行任务）

```bash
clawt create -b <branch>           # 创建 1 个
clawt create -b <branch> -n 3      # 批量创建 3 个
```

### `clawt validate` — 在主 worktree 中验证分支变更

```bash
clawt validate -b <branch>                    # 将变更迁移到主 worktree 测试
clawt validate -b <branch> --clean             # 清理 validate 状态
clawt validate -b <branch> -r "npm test"       # validate 成功后自动运行测试
clawt validate -b <branch> -r "npm run build"  # validate 成功后自动构建
clawt validate -b <branch> -r "pnpm test & pnpm build"  # 并行执行多个命令
```

支持增量模式：再次 validate 同一分支时，可通过 `git diff` 查看两次之间的增量差异。

当 patch apply 失败（目标分支与主分支差异过大）时，会自动询问是否执行 `sync` 同步主分支到目标 worktree，无需手动操作。

`-r, --run` 选项可在 validate 成功后自动在主 worktree 中执行指定命令（如测试、构建等），命令执行失败不影响 validate 结果。不传 `-r` 时会自动从项目配置的 `validateRunCommand` 读取（可通过 `clawt init show` 设置）。支持用 `&` 分隔多个命令并行执行：

| 用法 | 行为 |
| ---- | ---- |
| `-r "npm test"` | 单命令，同步执行 |
| `-r "npm lint && npm test"` | `&&` 不拆分，同步执行 |
| `-r "pnpm test & pnpm build"` | 并行执行，等全部完成后汇总结果 |

### `clawt sync` — 同步主分支代码到目标 worktree

```bash
clawt sync -b <branch>
```

当 `validate` 的 patch apply 失败时也会自动提示执行 sync，通常无需手动调用。

### `clawt merge` — 合并分支到主 worktree

```bash
clawt merge -b <branch> -m "feat: 提交信息"   # 有未提交修改时需要 -m
clawt merge -b <branch>                        # 已提交过可省略 -m
```

### `clawt remove` — 移除 worktree

```bash
clawt remove -b <branch>    # 移除指定分支的 worktree（支持模糊匹配）
clawt remove                 # 交互式多选要移除的 worktree
clawt remove --all           # 移除当前项目下所有 worktree
```

### `clawt list` — 列出所有 worktree

```bash
clawt list            # 文本格式
clawt list --json     # JSON 格式
```

### `clawt status` — 项目状态总览

```bash
clawt status          # 文本格式
clawt status --json   # JSON 格式
clawt status -i       # 交互式面板模式（实时刷新，支持键盘导航和快捷操作）
```

展示主 worktree 状态、各 worktree 的变更详情（含分支创建时间和验证状态）以及 validate 快照摘要。

交互式面板模式（`-i`）提供实时刷新的 TUI 界面，支持方向键导航选中 worktree，并通过快捷键直接执行 validate / merge / remove / resume / sync 等操作：

| 快捷键 | 操作 |
| ------ | ---- |
| `↑` `↓` | 导航选中 worktree |
| `v` `m` `d` `r` `s` | 验证 / 合并 / 删除 / 恢复 / 同步 |
| `f` | 手动刷新 |
| `q` / `Ctrl+C` | 退出 |

### `clawt reset` — 重置主 worktree 到干净状态

```bash
clawt reset
```

### `clawt home` — 切换回主工作分支

```bash
clawt home
```

如果当前已在主工作分支上，会提示无需切换。

### `clawt projects` — 跨项目 worktree 概览

```bash
clawt projects             # 查看所有项目概览
clawt projects my-project  # 查看指定项目的 worktree 详情
clawt projects --json      # JSON 格式输出
```

展示所有项目的 worktree 数量、磁盘占用和最近活跃时间，或查看指定项目下每个 worktree 的详细信息。

### `clawt config` — 交互式查看和修改配置

```bash
clawt config                          # 交互式修改配置（选择配置项并修改值）
clawt config set <key> <value>        # 直接设置某个配置项
clawt config get <key>                # 获取某个配置项的值
clawt config reset                    # 恢复默认配置
```

**使用示例：**

```bash
# 交互式修改（列出所有配置项，方向键选择，根据类型自动提示）
clawt config

# 直接设置
clawt config set autoDeleteBranch true
clawt config set maxConcurrency 4
clawt config set terminalApp iterm2

# 查看某项配置
clawt config get maxConcurrency
```

### `clawt completion` — Shell 自动补全

为终端提供命令、子命令、选项，甚至分支名和配置项的自动补全功能。

```bash
# 自动安装补全脚本（推荐）
clawt completion install

# 或手动将脚本添加到你的 shell 配置文件
clawt completion bash >> ~/.bashrc
clawt completion zsh >> ~/.zshrc
```
> **支持特性：** 所有子命令、选项、`-b` 参数自动补全本地 `worktree` 分支名、`-f` 参数自动补全文件路径，以及 `config set/get` 键名自动补全。

### `clawt alias` — 管理命令别名

```bash
clawt alias                          # 列出所有命令别名
clawt alias list                     # 列出所有命令别名
clawt alias set <alias> <command>    # 设置命令别名
clawt alias remove <alias>           # 移除命令别名
```

**使用示例：**

```bash
# 设置别名
clawt alias set l list
clawt alias set r run
clawt alias set v validate

# 使用别名（等同于对应的完整命令）
clawt l          # 等同于 clawt list
clawt r task.md  # 等同于 clawt run task.md

# 移除别名
clawt alias remove l
```

> **约束：** 别名不能覆盖内置命令名，目标必须是已注册的内置命令。别名的选项和参数会完全透传给目标命令。

## 配置

配置文件位于 `~/.clawt/config.json`，安装后自动生成：

| 配置项 | 默认值 | 说明 |
| ------ | ------ | ---- |
| `autoDeleteBranch` | `false` | 自动删除已合并/已移除的分支 |
| `claudeCodeCommand` | `"claude"` | Claude Code CLI 启动命令 |
| `autoPullPush` | `false` | merge 后自动 pull/push |
| `confirmDestructiveOps` | `true` | 破坏性操作前确认 |
| `maxConcurrency` | `0` | run 命令最大并发数，`0` 为不限制 |
| `terminalApp` | `"auto"` | 批量 resume 使用的终端：`auto` / `iterm2` / `terminal` |
| `resumeInPlace` | `false` | resume 单选时在当前终端就地恢复，`false` 则在新 Tab 中打开 |
| `aliases` | `{}` | 命令别名映射（如 `{"l": "list", "r": "run"}`） |
| `autoUpdate` | `true` | 自动检查新版本（每 24 小时检查一次 npm registry） |

## 全局选项

| 选项 | 说明 |
| ---- | ---- |
| `--debug` | 输出调试信息 |

## 日志

日志保存在 `~/.clawt/logs/`，按日期滚动，保留 30 天。
