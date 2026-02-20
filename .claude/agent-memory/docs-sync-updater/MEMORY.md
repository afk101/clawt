# Docs Sync Updater - Agent Memory

## 文档结构与对应关系

### docs/spec.md
- 完整的软件规格说明，包含 7 大章节
- 命令流程在 `5. 需求场景详细设计` 下，每个命令一个子章节（5.1-5.13）
- run 命令对应 `5.2 批量创建 Worktree + 执行 Claude Code 任务`，流程按步骤编号描述
- merge 命令对应 `5.6 合并验证过的分支`，流程按步骤编号描述
- config 命令对应 `5.10 查看全局配置`，只读展示配置
- resume 命令对应 `5.11 在已有 Worktree 中恢复会话`，支持模糊匹配和交互式分支选择（-b 可选）
- 配置项说明在 `5.7 默认配置文件` 章节的表格中
- 更新模式：新增步骤时追加编号，配置项影响范围变化时更新说明列

### CLAUDE.md
- 面向 Claude Code 的项目架构指引，精简扼要
- run 命令流程在 `核心流程（run 命令）` 章节，编号列表描述
- resume 命令流程在独立的 `### resume 命令流程` 章节，编号列表 + 缩进列表描述匹配策略
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
- `confirmDestructiveOps` 配置项影响两处：reset 命令、validate --clean
- merge 的清理确认和清理操作均在 merge 成功后执行（避免 merge 冲突时提前询问用户造成困惑）
- merge 成功后自动清理对应的 validate 快照（hasSnapshot + removeSnapshot）
- merge 成功消息根据 `autoPullPush` 配置动态显示推送状态
- run 的中断清理在所有子进程退出后执行
- run 交互式模式在创建 worktree 前检测分支是否已存在，已存在则提示使用 resume
- remove 命令删除 worktree 时自动清理对应快照，`--all` 模式额外清理项目快照目录
- remove 批量操作时收集错误继续处理，最后汇总报告
- 文档中文风格，技术术语保留英文（worktree, merge, branch, SIGINT 等）
- cleanupWorktrees 是 merge 和 run 共用的公共清理函数（在 src/utils/worktree.ts）
- `launchInteractiveClaude` 是 run（交互式模式）和 resume 共用的公共函数（在 src/utils/claude.ts）
- killAllChildProcesses 是 run 专用的子进程终止函数（在 src/utils/shell.ts）
- validate 快照管理函数在 `src/utils/validate-snapshot.ts`，被 validate、merge 和 remove 三个命令使用
- `confirmDestructiveAction` 在 `src/utils/formatter.ts`，被 reset 和 validate --clean 使用
- sanitizeBranchName 清理后为空串时抛出 BRANCH_NAME_EMPTY 错误

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

## 命令清单（10 个）

`create`、`run`、`resume`、`list`、`remove`、`validate`、`merge`、`config`、`sync`、`reset`

Notes:
- resume 和 run（交互式模式）共用 `launchInteractiveClaude()`，该函数从 run.ts 提取到 src/utils/claude.ts
- `claudeCodeCommand` 配置项同时影响 run 交互式模式和 resume 命令
- reset 命令与 validate --clean 的区别：reset 不删除快照文件，validate --clean 会删除快照
- resume 的 `-b` 参数为可选，核心函数 `resolveTargetWorktree()` 封装匹配策略：精确→模糊（子串，大小写不敏感）→交互选择
- resume 的交互式选择使用 Enquirer.Select（`promptSelectBranch()`），消息常量在 `MESSAGES.RESUME_*`

## validate 快照机制

- validate 命令支持首次/增量两种模式，通过 `hasSnapshot()` 判断
- 快照路径：`~/.clawt/validate-snapshots/<projectName>/<branchName>.tree`（存储 git tree 对象 hash）
- 常量 `VALIDATE_SNAPSHOTS_DIR` 定义在 `src/constants/paths.ts`
- validate 新增 `--clean` 选项（`ValidateOptions.clean?: boolean`）
- 快照保存：`git add . → git write-tree → git restore --staged .`，将 tree hash 写入 `.tree` 文件
- 增量模式核心：`git read-tree <旧 tree hash>` 将旧快照载入暂存区 + 新全量变更在工作目录 → `git diff` 可查看增量差异
- tree 对象不依赖主分支 HEAD，无需一致性校验（旧方案需要 `.head` 文件校验 HEAD 一致性）
- 增量 read-tree 失败时自动降级为全量模式（tree 对象可能被 git gc 回收）
- git 层有 `gitWriteTree()`（返回 tree hash）和 `gitReadTree()`（载入暂存区）
- merge 成功后自动清理对应快照；merge 时主 worktree 脏 + 存在快照会输出警告提示
- docs/spec.md 中 validate 章节（5.4）按 `--clean 模式`、`首次 validate`、`增量 validate` 三段描述
- CLAUDE.md 中在 validate + merge 工作流章节用缩进列表描述两种模式
