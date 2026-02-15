# Docs Sync Updater - Agent Memory

## 文档结构与对应关系

### docs/spec.md
- 完整的软件规格说明，包含 7 大章节
- 命令流程在 `5. 需求场景详细设计` 下，每个命令一个子章节（5.1-5.11）
- run 命令对应 `5.2 批量创建 Worktree + 执行 Claude Code 任务`，流程按步骤编号描述
- merge 命令对应 `5.6 合并验证过的分支`，流程按步骤编号描述
- config 命令对应 `5.10 查看全局配置`，只读展示配置
- resume 命令对应 `5.11 在已有 Worktree 中恢复会话`，查找已有 worktree 并启动交互式界面
- 配置项说明在 `5.7 默认配置文件` 章节的表格中
- 更新模式：新增步骤时追加编号，配置项影响范围变化时更新说明列

### CLAUDE.md
- 面向 Claude Code 的项目架构指引，精简扼要
- run 命令流程在 `核心流程（run 命令）` 章节，编号列表描述
- resume 命令流程在独立的 `### resume 命令流程` 章节，编号列表描述
- merge 和 run 中断清理在 `validate + merge 工作流` 章节，一行式描述用箭头连接流程
- utils 目录描述用括号内逗号分隔列举功能模块
- 更新模式：编号列表追加步骤，箭头链追加阶段，括号内追加关键词

### README.md
- 面向用户的使用文档
- 每个命令一个 `###` 小节，含命令格式、参数表格、简要说明、示例
- 配置文件说明在 `## 配置文件` 章节
- 更新模式：更新命令说明段落，配置项表格

## 关键约定
- `autoDeleteBranch` 配置项影响三处：remove 命令、merge 命令、run 中断清理
- merge 的清理确认在 merge 操作之前询问（避免交互中断），但清理在 merge 成功后执行
- merge 成功后自动清理对应的 validate 快照（hasSnapshot + removeSnapshot）
- run 的中断清理在所有子进程退出后执行
- 文档中文风格，技术术语保留英文（worktree, merge, branch, SIGINT 等）
- cleanupWorktrees 是 merge 和 run 共用的公共清理函数（在 src/utils/worktree.ts）
- `launchInteractiveClaude` 是 run（交互式模式）和 resume 共用的公共函数（在 src/utils/claude.ts）
- killAllChildProcesses 是 run 专用的子进程终止函数（在 src/utils/shell.ts）
- validate 快照管理函数在 `src/utils/validate-snapshot.ts`，被 validate 和 merge 两个命令使用

## 配置项同步检查点

配置项变更时需在以下 5 处保持一致：
1. `src/constants/config.ts` — CONFIG_DEFINITIONS 对象（单一数据源，包含 defaultValue + description）
2. `src/types/config.ts` — ClawtConfig 接口
3. `docs/spec.md` — 5.7 默认配置文件章节（JSON 示例 + 配置项表格）
4. `CLAUDE.md` — 关键约定段落中的配置描述
5. `README.md` — 配置文件章节（JSON 示例 + 配置项表格）

## 配置架构

- `CONFIG_DEFINITIONS` 是配置项的单一数据源，定义在 `src/constants/config.ts`
- `DEFAULT_CONFIG` 和 `CONFIG_DESCRIPTIONS` 均从 `CONFIG_DEFINITIONS` 派生
- 新增配置项时只需在 `CONFIG_DEFINITIONS` 中维护，派生值自动同步
- 类型：`ConfigItemDefinition<T>` 和 `ConfigDefinitions` 定义在 `src/types/config.ts`

## run 命令双模式

run 命令有两种模式（自 claudeCodeCommand 特性后）：
- 不传 `--tasks`：交互式界面模式（单 worktree + `launchInteractiveClaude` + spawnSync）
- 传 `--tasks`：并行任务模式（多 worktree + `executeClaudeTask` + spawnProcess）
- CLAUDE.md 中的核心流程按模式分段描述

## 命令清单（8 个）

`create`、`run`、`resume`、`list`、`remove`、`validate`、`merge`、`config`

Notes:
- resume 和 run（交互式模式）共用 `launchInteractiveClaude()`，该函数从 run.ts 提取到 src/utils/claude.ts
- `claudeCodeCommand` 配置项同时影响 run 交互式模式和 resume 命令

## validate 快照机制

- validate 命令支持首次/增量两种模式，通过 `hasSnapshot()` 判断
- 快照路径：`~/.clawt/validate-snapshots/<projectName>/<branchName>.patch`
- 常量 `VALIDATE_SNAPSHOTS_DIR` 定义在 `src/constants/paths.ts`
- validate 新增 `--clean` 选项（`ValidateOptions.clean?: boolean`）
- 增量模式核心：旧 patch 应用到暂存区 + 新全量变更在工作目录 → `git diff` 可查看增量差异
- 增量 apply 失败时自动降级为全量模式
- shell 层新增 `execCommandWithInput()`（`execFileSync` + stdin），用于 `gitApplyCachedFromStdin()`
- git 层新增 `gitDiffCachedBinary()`（返回 Buffer）和 `gitApplyCachedFromStdin()`
- merge 成功后自动清理对应快照；merge 时主 worktree 脏 + 存在快照会输出警告提示
- docs/spec.md 中 validate 章节（5.4）按 `--clean 模式`、`首次 validate`、`增量 validate` 三段描述
- CLAUDE.md 中在 validate + merge 工作流章节用缩进列表描述两种模式
