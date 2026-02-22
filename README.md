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
clawt run -b feature-auth \
  --tasks "实现用户登录功能" \
  --tasks "实现用户注册功能" \
  --tasks "实现密码重置功能"

# 3. 查看所有 worktree 状态
clawt status

# 4. 验证某个分支的变更（在主 worktree 中测试）
clawt validate -b feature-auth-1

# 5. 确认无误后合并到主分支
clawt merge -b feature-auth-1 -m "feat: 实现用户登录功能"

# 6. 清理不需要的 worktree
clawt remove -b feature-auth
```

## 命令一览

> 所有命令必须在**主 worktree 的仓库根目录**下执行。`-b` 参数支持模糊匹配。

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
clawt resume                # 交互式选择
```

如果目标 worktree 存在历史会话，会自动继续上次对话（`--continue`）。

### `clawt create` — 仅创建 worktree（不执行任务）

```bash
clawt create -b <branch>           # 创建 1 个
clawt create -b <branch> -n 3      # 批量创建 3 个
```

### `clawt validate` — 在主 worktree 中验证分支变更

```bash
clawt validate -b <branch>         # 将变更迁移到主 worktree 测试
clawt validate -b <branch> --clean  # 清理 validate 状态
```

支持增量模式：再次 validate 同一分支时，可通过 `git diff` 查看两次之间的增量差异。

### `clawt sync` — 同步主分支代码到目标 worktree

```bash
clawt sync -b <branch>
```

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
```

### `clawt reset` — 重置主 worktree 到干净状态

```bash
clawt reset
```

### `clawt config` — 查看配置

```bash
clawt config          # 查看当前配置
clawt config reset    # 恢复默认配置
```

## 配置

配置文件位于 `~/.clawt/config.json`，安装后自动生成：

| 配置项 | 默认值 | 说明 |
| ------ | ------ | ---- |
| `autoDeleteBranch` | `false` | 自动删除已合并/已移除的分支 |
| `claudeCodeCommand` | `"claude"` | Claude Code CLI 启动命令 |
| `autoPullPush` | `false` | merge 后自动 pull/push |
| `confirmDestructiveOps` | `true` | 破坏性操作前确认 |

## 全局选项

| 选项 | 说明 |
| ---- | ---- |
| `--debug` | 输出调试信息 |

## 日志

日志保存在 `~/.clawt/logs/`，按日期滚动，保留 30 天。
