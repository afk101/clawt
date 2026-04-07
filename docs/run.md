### 5.2 批量创建 Worktree + 执行 Claude Code 任务

> **注意：** run 命令内部调用 `createWorktrees` 或 `createWorktreesByBranches`，因此验证分支的创建和主工作分支检测逻辑（包括工作区脏状态处理）**自动继承** create 命令的变更，无需额外修改 run 命令本身。

**命令：**

```bash
# 方式一：通过 --tasks 参数直接指定任务（多任务并行，支持 variadic 语法）
clawt run -b <branchName> --tasks <task1> <task2> <task3>

# 方式二：通过 -f 从任务文件读取任务列表
clawt run -f <path>

# 方式三：不传 --tasks 也不传 -f，在 worktree 中打开 Claude Code 交互式界面
clawt run -b <branchName>
```

**参数：**

| 参数      | 必填 | 说明                                                        |
| --------- | ---- | ----------------------------------------------------------- |
| `-b`      | 否   | 分支名（使用 `-f` 时可选，否则必填）                          |
| `--tasks` | 否   | 任务描述（可多次指定，每个 --tasks 对应一个任务，任务数量即 worktree 数量）。不传则在 worktree 中打开 Claude Code 交互式界面 |
| `-f`      | 否   | 从任务文件读取任务列表（与 `--tasks` 互斥）                    |
| `-c`      | 否   | 最大并发数，`0` 表示不限制                                    |
| `--dry-run` | 否 | 试运行模式，仅输出预览信息不实际执行                            |
| `--post-create` | 否 | 执行 postCreate hook（默认开启，`--no-post-create` 跳过）。详见 [post-create-hook.md](./post-create-hook.md) |

**互斥约束：**

- `--file` 和 `--tasks` **不能同时使用**
- 非 `-f` 模式必须指定 `-b`

**交互式 Claude Code 界面模式：**

当不传 `--tasks` 也不传 `-f` 时，会创建单个 worktree，然后通过 `spawnSync` + `inherit stdio` 在该 worktree 中直接启动 Claude Code CLI 交互式界面，让用户与 Claude Code 直接交互。

启动命令通过配置项 `claudeCodeCommand`（默认值 `claude`）指定，支持自定义命令及参数。

#### 任务文件格式

任务文件使用嵌入 HTML 注释标签的自定义格式，不限制文件类型，标签外的任何文本都不会被解析。

```markdown
这里可以写任何说明文字，会被忽略

<!-- CLAWT-TASKS:START -->
# branch: feat-login
实现用户登录功能
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch: fix-bug
修复内存泄漏问题
这是多行任务描述
可以写很多行
<!-- CLAWT-TASKS:END -->
```

**格式规则：**

1. **任务块界定**：每个任务用 `<!-- CLAWT-TASKS:START -->` 和 `<!-- CLAWT-TASKS:END -->` 包裹
2. **分支名声明**：块内必须有一行 `# branch: <分支名>`（冒号前后的空格可灵活）
3. **任务描述**：块内除分支名行以外的所有行，合并为任务描述（支持多行）
4. **块外内容忽略**：标签外的任何文本都不会被解析
5. **必填校验**：每个块必须包含任务描述；分支名默认必填，但使用 `-b` 参数时分支名为可选（会被忽略，用 `-b` 值自动编号）

**解析实现：** `src/utils/task-file.ts` 中的 `parseTaskFile()`、`loadTaskFile()` 和 `parseTasksFromOptions()` 函数，类型定义为 `TaskFileEntry`（`src/types/taskFile.ts`）。

#### 任务文件模式运行流程

使用 `-f` 时的执行路径（`handleRun` → `handleRunFromFile`）：

1. 调用 `loadTaskFile(options.file)` 读取解析文件
2. **有 `-b` 参数**：忽略文件中的分支名，用 `-b` 值自动编号创建 worktree（`createWorktrees(branch, count)`）
3. **无 `-b` 参数**：使用文件中每个任务的独立分支名，先 `sanitizeBranchName` 清理后调用 `createWorktreesByBranches(branches)`
4. **执行 postCreate hook**：调用 `runPostCreateHooks(worktrees, !options.postCreate)`，以 fire-and-forget 模式后台异步并行执行，不阻塞后续流程。详见 [post-create-hook.md](./post-create-hook.md)
5. 调用 `executeBatchTasks(worktrees, tasks, concurrency)` 执行

#### --tasks 模式运行流程

1. 若传了 `--tasks`，解析得到任务数组 `tasks[]`；若未传，先检测分支是否已存在（已存在则提示使用 `clawt resume -b <branchName>` 恢复会话），然后创建单个 worktree，执行 postCreate hook（fire-and-forget）后启动 Claude Code 交互式界面（`launchInteractiveClaude(worktree)`），流程结束，不进入后续并行执行阶段
2. `n = tasks.length`
3. 按照 **5.1** 的流程创建 `n` 个 worktree
4. **执行 postCreate hook**：调用 `runPostCreateHooks(worktrees, !options.postCreate)`，以 fire-and-forget 模式后台异步并行执行，不阻塞后续流程。详见 [post-create-hook.md](./post-create-hook.md)
5. 通过公共函数 `executeBatchTasks`（`src/utils/task-executor.ts`）启动批量任务执行，该函数负责进度面板渲染、SIGINT 中断处理、并发控制和汇总输出。对每个 worktree 并行启动 Claude Code CLI：
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>-<i>
   claude -p "<tasks[i]>" --output-format stream-json --verbose --permission-mode bypassPermissions --append-system-prompt "<系统提示>"
   ```
   其中 `--append-system-prompt` 使用统一的 `APPEND_SYSTEM_PROMPT` 常量（定义在 `src/constants/config.ts`）。
   子进程通过 `spawnProcess()`（`src/utils/shell.ts`）启动，会自动注入环境变量 `CLAUDE_CODE_ENTRYPOINT="cli"`（通过 `getEnvWithoutNestedSessionFlag()` 函数），用于标识启动来源。
   使用 `stream-json` 格式可实时获取 Claude Code 的流式事件（工具调用、文本输出、最终结果），用于在进度面板中显示每个任务的实时活动描述和结果预览。流式事件解析由 `src/utils/stream-parser.ts` 负责。
6. 进入**事件监听通知**阶段（见 [5.3](#53-任务完成通知机制)）
7. **中断处理（Ctrl+C / SIGINT）**
   - 监听 `SIGINT` 信号，用户按下 Ctrl+C 时触发
   - 向所有正在运行的 Claude Code 子进程发送 `SIGTERM` 终止信号
   - 等待所有子进程退出后，进入清理流程：
     - 如果 `autoDeleteBranch` 为 `true`：自动清理本次创建的所有 worktree 和对应分支
     - 否则：交互式询问用户是否移除刚刚创建的 worktree 和对应分支
       - 用户选择保留时，提示可使用 `clawt remove` 手动清理
   - 清理完成后以退出码 `1` 退出

**注意：** 当 `n = 1` 时（只有一个任务），worktree 目录命名规则同 **5.1**（不加 `-1` 后缀）。

#### `--dry-run` 预览模式

传入 `--dry-run` 时不实际创建 worktree 和执行任务，仅输出预览信息供用户确认。预览由 `printDryRunPreview()`（`src/utils/dry-run.ts`）负责渲染。

**输出格式：**

```
════════════════════════════════════════
  Dry Run 预览
════════════════════════════════════════
任务数: 3 │ 并发数: 不限制 │ Worktree: ~/.clawt/worktrees/project
────────────────────────────────────────
✓ [1/3] feat-login
  路径: ~/.clawt/worktrees/project/feat-login
  任务: 实现登录功能

⚠ [2/3] feat-signup — 分支 feat-signup 已存在
  路径: ~/.clawt/worktrees/project/feat-signup
  任务: 实现注册功能

✓ [3/3] fix-bug
  路径: ~/.clawt/worktrees/project/fix-bug
  任务: 修复内存泄漏

════════════════════════════════════════
✓ 预览完成，无冲突。移除 --dry-run 即可正式执行。
```

**格式规则：**

1. **标题区**：双线分隔符包裹标题 `Dry Run 预览`
2. **摘要行**：任务数、并发数、Worktree 目录路径合并为一行，用灰色 `│` 分隔；交互式模式（无 `--tasks`）会额外追加模式信息
3. **分支列表**：
   - 正常分支：行首绿色 `✓` + 序号 + 青色分支名
   - 冲突分支：行首黄色 `⚠` + 序号 + 黄色分支名 + 灰色 `—` + 黄色警告文本（如 `分支 xxx 已存在`），警告合并在序号行
4. **路径/任务行**：2 空格缩进，灰色标签前缀（`路径:` / `任务:`）
5. **任务描述截断**：超过 80 字符时末尾加 `...`，多行合并为单行
6. **结尾**：双线分隔符后根据冲突情况输出结论——无冲突时绿色 `✓` 提示，有冲突时黄色 `⚠` 警告

**实现要点：**

- 常量定义在 `src/constants/messages/run.ts`（`DRY_RUN_*` 系列）
- `DRY_RUN_WORKTREE_DIR` 前缀为 `Worktree:`（简短形式）
- `truncateTaskDesc()` 负责截断任务描述（最大长度 80 字符，定义在 `src/utils/dry-run.ts`）

---
