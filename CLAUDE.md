# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Clawt 是一个 CLI 工具，融合 Git Worktree 与 Claude Code CLI，支持在本地并行执行多个 Claude Code Agent 任务。核心思路：为每个任务创建独立的 git worktree，在各自隔离的环境中并行调用 `claude -p` 执行任务，互不干扰。

## 构建与开发

```bash
npm run build     # 使用 tsup 构建到 dist/
npm run dev       # tsup --watch 模式
npm i -g .        # 本地全局安装进行测试
```

构建工具为 tsup，入口 `src/index.ts`，输出 ESM 格式，target node18。构建产物在 `dist/index.js` 带有 shebang 头。另有 `scripts/postinstall.ts` 作为独立入口构建（npm 安装后初始化 `~/.clawt/` 目录）。

本项目无测试框架和 lint 工具。

## 架构

### 命令注册模式

每个命令为独立文件 `src/commands/<name>.ts`，导出 `registerXxxCommand(program)` 函数，在 `src/index.ts` 中统一注册到 Commander。命令内部逻辑封装在对应的 `handleXxx` 函数中。

八个命令：`create`、`run`、`resume`、`list`、`remove`、`validate`、`merge`、`config`。

### 核心流程（run 命令）

run 命令有两种模式：

**模式一：不传 `--tasks`（交互式界面模式）**

1. `validateMainWorktree()` 确认在主 worktree 根目录
2. `validateClaudeCodeInstalled()` 确认 claude CLI 可用
3. `createWorktrees()` 创建单个 worktree
4. `launchInteractiveClaude()` 通过 `spawnSync` + `inherit stdio` 在 worktree 中直接启动 Claude Code 交互式界面（启动命令由配置项 `claudeCodeCommand` 指定，默认 `claude`）

**模式二：传 `--tasks`（并行任务模式）**

1. `validateMainWorktree()` 确认在主 worktree 根目录
2. `validateClaudeCodeInstalled()` 确认 claude CLI 可用
3. `createWorktrees()` 批量创建 git worktree（串行）
4. `executeClaudeTask()` 通过 `spawnProcess` 并行调用 `claude -p <task> --output-format json --permission-mode bypassPermissions`
5. 每个任务完成时实时输出通知，全部完成后输出汇总
6. SIGINT（Ctrl+C）中断处理：`killAllChildProcesses()` 终止所有子进程 → 等待退出 → `handleInterruptCleanup()` 根据 `autoDeleteBranch` 配置自动或交互式清理 worktree 和分支

### resume 命令流程

1. `validateMainWorktree()` 确认在主 worktree 根目录
2. `validateClaudeCodeInstalled()` 确认 claude CLI 可用
3. `findWorktreeByBranch()` 在当前项目的 worktree 列表中按分支名查找已有 worktree
4. `launchInteractiveClaude()` 在目标 worktree 中启动 Claude Code 交互式界面

### validate + merge 工作流

- `validate`：将目标 worktree 的变更通过 git stash 迁移到主 worktree，便于在主 worktree 中测试
- `merge`：检测目标 worktree 状态（有修改则需 `-m` 提交，已提交则跳过，无变更则报错）→ 合并到主 worktree → pull → push → 可选清理 worktree 和分支（受 `autoDeleteBranch` 配置或交互式确认控制）
- `run` 中断清理：Ctrl+C 终止所有子进程后，根据 `autoDeleteBranch` 配置自动清理或交互式确认清理本次创建的 worktree 和分支

### 目录层级

- `src/commands/` — 各命令的注册与处理逻辑
- `src/utils/` — 工具函数（git 操作、shell 执行与子进程管理、分支名处理、worktree 管理与批量清理、配置、格式化输出、交互式输入、Claude Code 交互式启动）
- `src/constants/` — 常量定义（路径、退出码、消息模板、分支规则、配置默认值、终端控制序列）
- `src/types/` — TypeScript 类型定义
- `src/errors/` — 自定义 `ClawtError` 错误类（携带退出码）
- `src/logger/` — winston 日志（按日期滚动，写入 `~/.clawt/logs/`）

### 关键约定

- 所有命令执行前都会调用 `validateMainWorktree()` 确保在主 worktree 根目录（`git rev-parse --git-common-dir === ".git"`）
- Worktree 统一存放在 `~/.clawt/worktrees/<projectName>/` 下
- 全局配置文件 `~/.clawt/config.json`，postinstall 时自动创建/合并，包含 `autoDeleteBranch`（是否自动删除分支）、`claudeCodeCommand`（Claude Code CLI 启动指令，用于 `run` 和 `resume` 的交互式界面）、`autoPullPush`（merge 后是否自动 pull/push）三个配置项。配置项以 `CONFIG_DEFINITIONS` 为单一数据源，`DEFAULT_CONFIG` 和 `CONFIG_DESCRIPTIONS` 均从中派生
- shell 命令执行有同步（`execCommand` → `execSync`）和异步（`spawnProcess` → `spawn`）两种方式
- 项目为纯 ESM（`"type": "module"`），模块导入需带 `.js` 后缀
- 分支名特殊字符会被 `sanitizeBranchName()` 自动清理
