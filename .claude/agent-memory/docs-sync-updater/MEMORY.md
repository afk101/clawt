# Docs Sync Updater - Agent Memory

## 文档结构与对应关系

### docs/spec.md
- 完整的软件规格说明，包含 7 大章节
- 命令流程在 `5. 需求场景详细设计` 下，每个命令一个子章节（5.1-5.14）
- run 命令对应 `5.2 批量创建 Worktree + 执行 Claude Code 任务`，流程按步骤编号描述
- merge 命令对应 `5.6 合并验证过的分支`，-b 可选，支持模糊匹配（与 resume/validate 共享匹配逻辑），流程按步骤编号描述
- config 命令对应 `5.10 查看和管理全局配置`，包含查看配置和 config reset 子命令两部分（使用 `####` 子标题区分）
- resume 命令对应 `5.11 在已有 Worktree 中恢复会话`，支持模糊匹配和交互式分支选择（-b 可选）
- validate 命令对应 `5.4 在主 Worktree 验证其他分支`，-b 可选，支持模糊匹配（与 resume 共享匹配逻辑）
- sync 命令对应 `5.12 将主分支代码同步到目标 Worktree`，-b 可选，支持模糊匹配（与 resume/validate/merge 共享匹配逻辑）
- status 命令对应 `5.14 项目全局状态总览`，支持 `--json` 格式输出，展示主 worktree 状态、各 worktree 详细状态、未清理快照
- 配置项说明在 `5.7 默认配置文件` 章节的表格中
- 更新模式：新增步骤时追加编号，配置项影响范围变化时更新说明列

### README.md
- 面向用户的使用文档
- 全局选项在 `## 全局选项` 章节（位于 `## 使用前提` 和 `## 命令` 之间）
- 每个命令一个 `###` 小节，含命令格式、参数表格、简要说明、示例
- 配置文件说明在 `## 配置文件` 章节
- 日志说明在 `## 日志` 章节（文档末尾）
- 更新模式：更新命令说明段落，配置项表格

## 关键约定
- `autoDeleteBranch` 配置项影响三处：remove 命令、merge 命令、run 中断清理
- `confirmDestructiveOps` 配置项影响三处：reset 命令、validate --clean、config reset
- merge 的清理确认和清理操作均在 merge 成功后执行（避免 merge 冲突时提前询问用户造成困惑）
- merge 成功后自动清理对应的 validate 快照（hasSnapshot + removeSnapshot）
- merge 成功消息根据 `autoPullPush` 配置动态显示推送状态
- run 的中断清理在所有子进程退出后执行
- run 交互式模式在创建 worktree 前检测分支是否已存在，已存在则提示使用 resume
- remove 命令通过 `resolveTargetWorktrees` 支持模糊匹配+多选（-b 可选），删除 worktree 时自动清理对应快照，`--all` 模式额外清理项目快照目录
- remove 批量操作时收集错误继续处理，最后汇总报告
- 文档中文风格，技术术语保留英文（worktree, merge, branch, SIGINT 等）
- cleanupWorktrees 是 merge 和 run 共用的公共清理函数（在 src/utils/worktree.ts）
- `launchInteractiveClaude` 是 run（交互式模式）和 resume 共用的公共函数（在 src/utils/claude.ts），启动前自动检测会话历史并追加 `--continue`
- `hasClaudeSessionHistory` 检测 `~/.claude/projects/<encoded-path>/` 下是否有 `.jsonl` 文件（在 src/utils/claude.ts）
- `CLAUDE_PROJECTS_DIR` 常量（`~/.claude/projects/`）定义在 `src/constants/paths.ts`
- killAllChildProcesses 是 run 专用的子进程终止函数（在 src/utils/shell.ts）
- validate 快照管理函数在 `src/utils/validate-snapshot.ts`，被 validate、merge、remove 和 status 四个命令使用
- `confirmDestructiveAction` 在 `src/utils/formatter.ts`，被 reset、validate --clean 和 config reset 使用
- sanitizeBranchName 清理后为空串时抛出 BRANCH_NAME_EMPTY 错误

## 配置项同步检查点

配置项变更时需在以下 4 处保持一致：
1. `src/constants/config.ts` — CONFIG_DEFINITIONS 对象（单一数据源，包含 defaultValue + description）
2. `src/types/config.ts` — ClawtConfig 接口
3. `docs/spec.md` — 5.7 默认配置文件章节（JSON 示例 + 配置项表格）
4. `README.md` — 配置文件章节（JSON 示例 + 配置项表格）

## 配置架构

- `CONFIG_DEFINITIONS` 是配置项的单一数据源，定义在 `src/constants/config.ts`
- `DEFAULT_CONFIG` 和 `CONFIG_DESCRIPTIONS` 均从 `CONFIG_DEFINITIONS` 派生
- 新增配置项时只需在 `CONFIG_DEFINITIONS` 中维护，派生值自动同步
- 类型：`ConfigItemDefinition<T>` 和 `ConfigDefinitions` 定义在 `src/types/config.ts`

## run 命令双模式

run 命令有两种模式（自 claudeCodeCommand 特性后）：
- 不传 `--tasks`：交互式界面模式（单 worktree + `launchInteractiveClaude` + spawnSync）
- 传 `--tasks`：并行任务模式（多 worktree + `executeBatchTasks` + spawnProcess）
  - 批量任务执行逻辑从 `src/commands/run.ts` 提取到 `src/utils/task-executor.ts`（公共函数 `executeBatchTasks`）
  - 进度面板渲染逻辑从 `src/utils/progress.ts` 拆分出 `src/utils/progress-render.ts`（纯渲染函数 + TaskProgress 类型）
  - `formatDuration` 从 `src/utils/progress.ts` 移至 `src/utils/formatter.ts`
  - 进度面板每个任务行末尾显示 worktree 路径（终端可点击跳转）

## 命令清单（11 个）

`create`、`run`、`resume`、`list`、`remove`、`validate`、`merge`、`config`、`sync`、`reset`、`status`

Notes:
- resume 和 run（交互式模式）共用 `launchInteractiveClaude()`，该函数从 run.ts 提取到 src/utils/claude.ts
- `claudeCodeCommand` 配置项同时影响 run 交互式模式和 resume 命令
- reset 命令与 validate --clean 的区别：reset 不删除快照文件，validate --clean 会删除快照
- `resolveTargetWorktree()` 是 resume、validate、merge 和 sync 共用的单选分支匹配函数（在 src/utils/worktree-matcher.ts）
- `resolveTargetWorktrees()` 是多选分支匹配函数（在 src/utils/worktree-matcher.ts），目前被 remove 命令使用
- `WorktreeResolveMessages` 接口用于单选命令的消息解耦，`WorktreeMultiResolveMessages` 接口用于多选命令的消息解耦
- `promptSelectBranch()`（Enquirer.Select）用于单选交互，`promptMultiSelectBranches()`（Enquirer.MultiSelect）用于多选交互
- resume 的消息常量在 `MESSAGES.RESUME_*`，validate 的消息常量在 `MESSAGES.VALIDATE_*`，merge 的消息常量在 `MESSAGES.MERGE_*`，sync 的消息常量在 `MESSAGES.SYNC_*`，status 的消息常量在 `MESSAGES.STATUS_*`，remove 的 fuzzy search 消息在 `MESSAGES.REMOVE_*`
- resume、validate、merge 和 sync 的 `-b` 参数均为可选，匹配策略一致：精确→模糊（子串，大小写不敏感）→交互单选
- remove 的 `-b` 参数可选，匹配策略：精确→模糊→交互多选；不传 `-b` 时列出所有分支供多选
- validate 的交互式选择和 resume 使用同一个 `promptSelectBranch()`（Enquirer.Select）；remove 使用 `promptMultiSelectBranches()`（Enquirer.MultiSelect）

## validate 快照机制

- validate 命令支持首次/增量两种模式，通过 `hasSnapshot()` 判断
- 快照由两个文件组成：`.tree`（git tree 对象 hash）和 `.head`（快照时主 worktree 的 HEAD commit hash）
- 快照路径：`~/.clawt/validate-snapshots/<projectName>/<branchName>.tree` 和 `<branchName>.head`
- 常量 `VALIDATE_SNAPSHOTS_DIR` 定义在 `src/constants/paths.ts`
- validate 新增 `--clean` 选项（`ValidateOptions.clean?: boolean`）
- 快照保存：`git add . → git write-tree → git rev-parse HEAD → git restore --staged .`，tree hash 写入 `.tree`，HEAD commit hash 写入 `.head`
- 增量模式核心：检测 HEAD 是否变化决定策略
  - HEAD 未变化：`git read-tree <旧 tree hash>` 直接载入暂存区
  - HEAD 已变化：提取旧变更 patch（`git diff-tree` 旧 HEAD tree → 旧快照 tree），`git apply --cached` 重放到当前 HEAD 暂存区；有冲突则降级全量
- 增量 read-tree / apply 失败时自动降级为全量模式
- git 层工具函数：`gitWriteTree()`、`gitReadTree()`、`getCommitTreeHash()`、`gitDiffTree()`、`gitApplyCachedCheck()`
- `readSnapshot()` 返回 `{ treeHash, headCommitHash }`，`writeSnapshot()` 接收 4 个参数（含 headCommitHash）
- `removeSnapshot()` 同时清理 `.tree` 和 `.head` 文件
- merge 成功后自动清理对应快照；merge 时主 worktree 脏 + 存在快照会输出警告提示
- docs/spec.md 中 validate 章节（5.4）按 `--clean 模式`、`首次 validate`、`增量 validate` 三段描述

## 全局选项

- `--debug` 全局选项在 `src/index.ts` 通过 Commander.js `.option()` + `preAction` 钩子实现
- `enableConsoleTransport()` 在 `src/logger/index.ts`，幂等地向 winston 添加 Console transport
- 调试相关常量在 `src/constants/logger.ts`：`DEBUG_LOG_PREFIX`、`DEBUG_TIMESTAMP_FORMAT`
- docs/spec.md 中 `--debug` 说明位于 `5.9 日志系统` 章节下的 `#### --debug 控制台调试输出` 子章节
- docs/spec.md 中 `4. 命令总览` 的命令表格后有 `**全局选项：**` 表格
- README.md 中 `## 全局选项` 章节（在 `## 使用前提` 和 `## 命令` 之间）
