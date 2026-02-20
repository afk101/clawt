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

十个命令：`create`、`run`、`resume`、`list`、`remove`、`validate`、`merge`、`config`、`sync`、`reset`。

### 核心流程（run 命令）

run 命令有两种模式：

**模式一：不传 `--tasks`（交互式界面模式）**

1. `validateMainWorktree()` 确认在主 worktree 根目录
2. `validateClaudeCodeInstalled()` 确认 claude CLI 可用
3. 检测分支是否已存在（`checkBranchExists()`），已存在则提示使用 `clawt resume -b <branch>` 恢复会话
4. `createWorktrees()` 创建单个 worktree
5. `launchInteractiveClaude()` 通过 `spawnSync` + `inherit stdio` 在 worktree 中直接启动 Claude Code 交互式界面（启动命令由配置项 `claudeCodeCommand` 指定，默认 `claude`）

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
3. `resolveTargetWorktree()` 解析目标 worktree（`-b` 可选）：
   - 未传 `-b`：仅 1 个 worktree 直接使用，多个通过 `promptSelectBranch()`（Enquirer.Select）交互选择
   - 传了 `-b`：`findExactMatch()` 精确匹配 → `findFuzzyMatches()` 子串模糊匹配（大小写不敏感，唯一直接使用，多个交互选择） → 无匹配报错并列出可用分支
4. `launchInteractiveClaude()` 在目标 worktree 中启动 Claude Code 交互式界面

### validate + merge 工作流

- `validate`：将目标分支的全量变更（已提交 + 未提交）通过 `git diff HEAD...branch --binary` 的 patch 方式迁移到主 worktree，便于在主 worktree 中测试。支持两种模式：
  - **首次 validate**（无历史快照）：patch 迁移全量变更 → 通过 `git write-tree` 保存快照为 git tree 对象 → 结果：暂存区=空，工作目录=全量变更
  - **增量 validate**（存在历史快照）：读取旧 tree hash → 确保主 worktree 干净 → patch 迁移最新变更 → 保存新 tree 对象快照 → `git read-tree` 将旧 tree 载入暂存区 → 结果：暂存区=上次快照，工作目录=最新变更（可通过 `git diff` 查看增量差异）
  - `--clean` 选项：根据 `confirmDestructiveOps` 配置提示确认 → 重置主 worktree + 删除对应快照文件
  - 快照存储路径：`~/.clawt/validate-snapshots/<projectName>/<branchName>.tree`（存储 git tree 对象 hash）
  - tree 对象不依赖主分支 HEAD，无需一致性校验
  - 变更检测：同时检测目标 worktree 的未提交修改和已提交 commit，两者均无则提示无需验证
  - 未提交修改处理：有未提交修改时先做临时 commit，diff 完成后通过 `git reset --soft` 撤销恢复原状
- `merge`：检测目标 worktree 状态（有修改则需 `-m` 提交，已提交则跳过，无变更则报错）→ **squash 检测**（检查目标分支是否存在 `AUTO_SAVE_COMMIT_MESSAGE` 前缀的 auto-save commit，如有则提示用户是否压缩所有提交：用户确认后通过 `gitMergeBase` 计算分叉点、`gitResetSoftTo` 将所有 commit reset 到暂存区；有 `-m` 则直接提交继续流程，无 `-m` 则提示用户自行提交后退出）→ 合并到主 worktree → 根据 `autoPullPush` 配置决定是否 pull + push（成功消息动态显示推送状态）→ merge 成功后确认并清理 worktree 和分支（受 `autoDeleteBranch` 配置或交互式确认控制）→ 清理对应的 validate 快照
- `run` 中断清理：Ctrl+C 终止所有子进程后，根据 `autoDeleteBranch` 配置自动清理或交互式确认清理本次创建的 worktree 和分支

### sync 命令流程

1. `validateMainWorktree()` 确认在主 worktree 根目录
2. 检查目标 worktree 是否存在
3. 获取主分支名（`getCurrentBranch()`，不硬编码 main/master）
4. 如果目标 worktree 有未提交变更，自动 `git add . && git commit` 保存
5. 在目标 worktree 中执行 `git merge <mainBranch>` 合并主分支
6. 冲突处理：有冲突时提示用户手动解决，无冲突则输出成功
7. 合并成功后清除该分支的 validate 快照（代码基础已变化，旧快照无效）

### reset 命令流程

1. `validateMainWorktree()` 确认在主 worktree 根目录
2. 检测主 worktree 工作区和暂存区是否干净（`isWorkingDirClean()`）
3. 不干净 → 根据 `confirmDestructiveOps` 配置决定是否通过 `confirmDestructiveAction()` 提示确认 → `gitResetHard()` + `gitCleanForce()` 重置工作区和暂存区（保留 validate 快照）
4. 已干净 → 提示无需重置

### 目录层级

- `src/commands/` — 各命令的注册与处理逻辑
- `src/utils/` — 工具函数（git 操作（含三点 diff、分支合并、冲突检测、merge-base 计算、commit message 检测、soft reset 到指定 commit、write-tree/read-tree、分支存在性检测等）、shell 执行与子进程管理、分支名处理、worktree 管理与批量清理、配置、格式化输出与破坏性操作确认、交互式输入、Claude Code 交互式启动、validate 快照管理（基于 git tree 对象））
- `src/constants/` — 常量定义（路径、退出码、消息模板、分支规则、配置默认值、终端控制序列、validate 快照目录、sync 相关消息、git 常量（如 `AUTO_SAVE_COMMIT_MESSAGE`）、squash 相关消息、reset 相关消息、remove 相关消息、破坏性操作确认消息）
- `src/types/` — TypeScript 类型定义
- `src/errors/` — 自定义 `ClawtError` 错误类（携带退出码）
- `src/logger/` — winston 日志（按日期滚动，写入 `~/.clawt/logs/`）

### 关键约定

- 所有命令执行前都会调用 `validateMainWorktree()` 确保在主 worktree 根目录（`git rev-parse --git-common-dir === ".git"`）
- Worktree 统一存放在 `~/.clawt/worktrees/<projectName>/` 下
- 全局配置文件 `~/.clawt/config.json`，postinstall 时自动创建/合并，包含 `autoDeleteBranch`（是否自动删除分支）、`claudeCodeCommand`（Claude Code CLI 启动指令，用于 `run` 和 `resume` 的交互式界面）、`autoPullPush`（merge 后是否自动 pull/push）、`confirmDestructiveOps`（破坏性操作前是否提示确认，影响 `reset` 和 `validate --clean`）四个配置项。配置项以 `CONFIG_DEFINITIONS` 为单一数据源，`DEFAULT_CONFIG` 和 `CONFIG_DESCRIPTIONS` 均从中派生
- shell 命令执行有同步（`execCommand` → `execSync`）、异步（`spawnProcess` → `spawn`）和同步带 stdin（`execCommandWithInput` → `execFileSync`）三种方式
- 项目为纯 ESM（`"type": "module"`），模块导入需带 `.js` 后缀
- 分支名特殊字符会被 `sanitizeBranchName()` 自动清理
