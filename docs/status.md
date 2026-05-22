### 5.14 项目全局状态总览

**命令：**

```bash
clawt status [--json] [-i | --interactive]
```

**参数：**

| 参数                  | 必填 | 说明                                     |
| --------------------- | ---- | ---------------------------------------- |
| `--json`              | 否   | 以 JSON 格式输出完整状态数据              |
| `-i, --interactive`   | 否   | 启动交互式面板模式（TUI 实时刷新面板）     |

**使用场景：**

在管理多个 worktree 时，快速了解项目全局状态：主 worktree 当前分支及干净状态、配置的主工作分支信息、所有 worktree 的变更情况和与主分支的同步状态、validate 快照摘要。

交互式面板模式适用于需要持续监控项目状态并快速执行操作的场景，无需反复输入命令。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **收集主 worktree 状态**：
   - 获取当前分支名（`getCurrentBranch()`）
   - 检测工作区是否干净（`isWorkingDirClean()`）
   - 获取项目名（`getProjectName()`）
   - 加载项目配置（`loadProjectConfig()`），读取配置的主工作分支名（`clawtMainWorkBranch`）
   - 检测配置的主工作分支是否存在（`checkBranchExists()`）
3. **收集各 worktree 详细状态**：
   - 获取项目所有 worktree（`getProjectWorktrees()`）
   - 对每个 worktree 收集以下信息：
     - **变更状态**（优先级：合并冲突 > 未提交修改 > 已提交 > 无变更）
     - **行数差异**（新增/删除行数，通过 `getDiffStat()` 获取）
     - **提交差异**（相对于主分支的领先提交数 `getCommitCountAhead()` 和落后提交数 `getCommitCountBehind()`）
     - **快照时间**（validate 快照文件的 mtime，通过 `getSnapshotModifiedTime()` 获取，返回 ISO 8601 时间字符串或 null）
     - **创建时间**（通过 `getWorktreeCreatedTime()` 从文件系统 birthtime 获取 worktree 目录的创建时间）
4. **收集 validate 快照摘要**：
   - 通过 `getProjectSnapshotBranches()` 扫描快照目录下的 `.tree` 文件获取所有存在快照的分支名
   - 统计快照总数和孤立快照数（对应 worktree 已不存在的快照）
5. **输出状态信息**：
   - 指定 `--json` → 以 JSON 格式输出完整状态数据（`JSON.stringify`）
   - 指定 `-i` / `--interactive` → 启动交互式面板模式（见下方「交互式面板模式」章节）
   - 未指定 → 以文本格式输出

**文本输出格式（默认）：**

输出分为三个区块：主 Worktree、Worktree 列表、Validate 快照摘要。每个 worktree 条目每行展示一种信息。

主 Worktree 区块会显示配置的主工作分支信息，根据状态有以下三种展示：
- **正常**（灰色）：`主工作分支: <branchName>`
- **当前分支不一致**（红色）：`⚠ 主工作分支: <branchName>（当前分支不一致，如需更新请执行 clawt init）`
- **分支已不存在**（红色）：`✗ 主工作分支: <branchName>（已不存在，请执行 clawt init 重新设置）`

注意：当项目未初始化（`configuredMainBranch` 为 null）时不展示配置分支信息；当主 worktree 当前处于验证分支（`VALIDATE_BRANCH_PREFIX` 前缀）时不显示不一致警告。

```
════════════════════════════════════════
  项目状态总览: main-project
════════════════════════════════════════

  ◆ 主 Worktree
    分支: main
    状态: ✓ 干净
    主工作分支: main

────────────────────────────────────────

  ◆ Worktree 列表 (2 个)

  ● feature-login   [已提交]
    +120 -30
    3 个本地提交
    与主分支同步
    创建于 3 天前
    上次验证: 2 小时前

  ● feature-signup   [未提交修改]
    +45 -10
    1 个本地提交
    落后主分支 2 个提交
    创建于 1 天前
    ✗ 未验证

────────────────────────────────────────

  ◆ Validate 快照 (3 个)
    其中 1 个快照对应的 worktree 已不存在

════════════════════════════════════════
```

**变更状态标签：**

| 状态        | 标签           | 颜色   | 说明                          |
| ----------- | -------------- | ------ | ----------------------------- |
| `committed` | 已提交         | 绿色   | 有已提交内容，工作区干净       |
| `uncommitted` | 未提交修改   | 黄色   | 有未提交的修改                 |
| `conflict`  | 合并冲突       | 红色   | 存在合并冲突                   |
| `clean`     | 无变更         | 灰色   | 工作区干净且无本地提交          |

**差异统计展示规则（每项独立一行）：**

- 行数变更（`+N -N`）：仅在有变更时展示，独立一行
- 本地提交数（`N 个本地提交`）：仅在有提交时展示，独立一行（黄色）
- 与主分支同步状态：始终展示，独立一行（落后时显示黄色，同步时显示绿色）

**创建时间行：**

- 通过 `getWorktreeCreatedTime()` 从文件系统 `birthtime` 获取 worktree 目录的创建时间，以 `formatRelativeTime()` 格式化为中文相对时间（如"3 天前"、"2 小时前"、"刚刚"）
- 展示为灰色文本 `创建于 X前`，无法获取时不展示

**验证状态行：**

- 有快照时：显示绿色 `上次验证: X前`（通过 `getSnapshotModifiedTime()` 获取快照文件 mtime，再用 `formatRelativeTime()` 格式化）
- 无快照时：显示红色 `✗ 未验证` 警示

**快照区块：**

- 标题显示快照总数
- 如果存在孤立快照（对应 worktree 已不存在），显示黄色警告 `其中 N 个快照对应的 worktree 已不存在`
- 无孤立快照时不显示额外信息

**JSON 输出格式（`--json`）：**

```json
{
  "main": {
    "branch": "main",
    "isClean": true,
    "projectName": "main-project",
    "configuredMainBranch": "main",
    "configuredBranchExists": true,
    "insertions": 185,
    "deletions": 42
  },
  "worktrees": [
    {
      "path": "~/.clawt/worktrees/main-project/feature-login",
      "branch": "feature-login",
      "changeStatus": "committed",
      "commitsAhead": 3,
      "commitsBehind": 0,
      "snapshotTime": "2025-02-06T12:30:00.000Z",
      "insertions": 120,
      "deletions": 30,
      "createdAt": "2025-02-03T10:00:00.000Z"
    }
  ],
  "snapshots": {
    "total": 3,
    "orphaned": 1
  },
  "totalWorktrees": 1
}
```

`MainWorktreeStatus` 各字段说明：

| 字段                    | 类型              | 说明                                        |
| ----------------------- | ----------------- | ------------------------------------------- |
| `branch`                | `string`          | 当前分支名                                   |
| `isClean`               | `boolean`         | 工作区是否干净                                |
| `projectName`           | `string`          | 项目名                                       |
| `configuredMainBranch`  | `string \| null`  | 配置的主工作分支名（项目未初始化时为 null）     |
| `configuredBranchExists`| `boolean \| null` | 配置的主工作分支是否存在（项目未初始化时为 null）|
| `insertions`            | `number`          | 工作区和暂存区的新增行数                      |
| `deletions`             | `number`          | 工作区和暂存区的删除行数                      |

**实现要点：**

- 类型定义在 `src/types/status.ts`：`WorktreeDetailedStatus`（`snapshotTime: string | null`、`createdAt: string | null`）、`MainWorktreeStatus`（包含 `configuredMainBranch`、`configuredBranchExists`、`insertions`、`deletions`）、`SnapshotInfo`、`SnapshotSummary`（包含 `total` 和 `orphaned`）、`StatusResult`（`snapshots` 为 `SnapshotSummary` 类型）
- 消息常量在 `MESSAGES.STATUS_*` 系列：
  - `STATUS_TITLE(projectName)`：标题文本
  - `STATUS_MAIN_SECTION`：主 worktree 区块标题
  - `STATUS_WORKTREES_SECTION`：worktree 列表区块标题
  - `STATUS_SNAPSHOTS_SECTION`：快照区块标题
  - `STATUS_NO_WORKTREES`：无活跃 worktree 提示
  - `STATUS_CHANGE_COMMITTED` / `STATUS_CHANGE_UNCOMMITTED` / `STATUS_CHANGE_CONFLICT` / `STATUS_CHANGE_CLEAN`：变更状态标签
  - `STATUS_LAST_VALIDATED(relativeTime)`：上次验证时间标签
  - `STATUS_NOT_VALIDATED`：未验证红色警示文本（`✗ 未验证`）
  - `STATUS_CREATED_AT(relativeTime)`：创建时间标签
  - `STATUS_SNAPSHOT_ORPHANED(count)`：孤立快照警告（接受数量参数）
  - `STATUS_CONFIGURED_BRANCH(branchName)`：配置的主工作分支（正常状态，灰色）
  - `STATUS_CONFIGURED_BRANCH_DELETED(branchName)`：配置的主工作分支已不存在（红色）
  - `STATUS_CONFIGURED_BRANCH_MISMATCH(branchName)`：当前分支与配置不一致（红色）
- `getWorktreeCreatedTime()` 工具函数（在 `src/utils/worktree-matcher.ts`），通过 `fs.statSync().birthtime` 获取 worktree 目录的创建时间，返回 ISO 8601 格式字符串或 null
- `getSnapshotModifiedTime()` 工具函数（在 `src/utils/validate-snapshot.ts`），通过 `fs.statSync` 获取快照文件的修改时间（mtime），返回 UTC 时区的 ISO 8601 格式字符串（`toISOString()` 格式）或 null
- `formatRelativeTime()` 格式化函数（在 `src/utils/formatter.ts`），将 ISO 8601 日期字符串转换为中文相对时间描述（如"3 天前"、"2 小时前"、"刚刚"），无效日期时返回 null
- `getCommitCountBehind()` 工具函数（在 `src/utils/git-branch.ts`），通过 `git rev-list --count <branch>..HEAD` 计算落后提交数
- `getProjectSnapshotBranches()` 工具函数（在 `src/utils/validate-snapshot.ts`），通过扫描快照目录下的 `.tree` 文件提取分支名列表
- `loadProjectConfig()` 加载项目配置，读取 `clawtMainWorkBranch` 字段
- `checkBranchExists()` 检测分支是否存在

**交互式面板模式（`-i` / `--interactive`）：**

通过 `-i` 选项启动一个实时刷新的 TUI（Text User Interface）面板，在终端中提供键盘导航和快捷键操作功能。面板基于备选屏幕（alternate screen）渲染，退出后终端恢复原状。

**前置条件：**

- 需要 TTY 终端环境。非 TTY 时（如管道、重定向场景）会输出降级提示并退出。

**面板布局：**

```
项目状态总览: my-project
主工作分支: main
工作区: +185 -42
──────── ↑ 更多 worktree... ────────
  ════ 2026-03-01（2 天前） ════

▶ feature-login   [已提交]
    +120 -30
    3 个本地提交
    与主分支同步
    创建于 3 天前
    上次验证: 2 小时前

  feature-signup   [未提交修改]
    +45 -10
    1 个本地提交
    落后主分支 2 个提交
    创建于 1 天前
    ✗ 未验证

  ════ 2026-02-28（3 天前） ════

  fix-bug   [无变更]
    与主分支同步
    创建于 5 天前
    ✗ 未验证

──────── ↓ 更多 worktree... ────────
[v]验证  [m]合并  [d]删除  [r]恢复  [s]同步  [c]覆盖  [f]刷新  [q]退出  (3s 后刷新)
```

面板从上到下分为以下区域：

1. **标题行**：显示项目名（`项目状态总览: <projectName>`）
2. **配置分支信息行**：显示配置的主工作分支状态，有以下四种情况：
   - 正常（灰色）：`主工作分支: <branchName>`
   - 分支已删除（红色）：`✗ 主工作分支: <branchName>（已不存在）`
   - 分支不一致（红色）：`⚠ 主工作分支: <branchName>（不一致）`
   - 未初始化（灰色）：`未初始化（执行 clawt init 设置主工作分支）`
3. **工作区 diff 信息行**：显示主工作分支的工作区 diff 统计，有变更时格式为 `工作区: +N -M`（新增行数绿色，删除行数红色），无变更时显示 `工作区: 无变更`（绿色）
4. **顶部分隔线**：当存在向上溢出时，分隔线中间嵌入 `↑ 更多 worktree...` 提示
5. **Worktree 滚动区域**：按日期分组显示 worktree 列表，支持上下滚动
6. **底部分隔线**：当存在向下溢出时，分隔线中间嵌入 `↓ 更多 worktree...` 提示
7. **底栏**：快捷键提示 + 自动刷新倒计时

**Worktree 日期分组显示：**

Worktree 按创建日期分组（复用 `groupWorktreesByDate()`），每组前显示日期分隔线，格式为 `════ YYYY-MM-DD（相对日期） ════`，相对日期如"今天"、"昨天"、"3 天前"等（通过 `formatRelativeDate()` 格式化）。无法获取创建日期时归入"未知日期"分组。

每个 worktree 条目的渲染内容与文本输出模式一致（分支名 + 变更状态标签、行数差异、本地提交数、同步状态、创建时间、验证状态），选中项前显示 `▶` 指示器（青色），未选中项前显示等宽空格占位。

**键盘操作：**

| 按键    | 操作                                     |
| ------- | ---------------------------------------- |
| `↑`     | 向上导航，选中上一个 worktree             |
| `↓`     | 向下导航，选中下一个 worktree             |
| `v`     | 对选中 worktree 执行 `clawt validate`    |
| `m`     | 对选中 worktree 执行 `clawt merge`       |
| `d`     | 对选中 worktree 执行 `clawt remove`      |
| `r`     | 对选中 worktree 执行 `clawt resume`      |
| `s`     | 对选中 worktree 执行 `clawt sync`        |
| `c`     | 执行 `clawt cover`（从当前验证分支自动推导目标分支） |
| `f`     | 手动刷新数据                              |
| `q`     | 退出面板                                 |
| `Ctrl+C`| 退出面板                                 |

**操作执行流程：**

当用户按下操作快捷键（v/m/d/r/s/c）时，面板会：

1. 暂停定时器和键盘监听
2. 退出备选屏幕，恢复终端状态
3. 以继承 stdio 的方式执行对应的 clawt 子命令（如 `clawt validate -b <branch>`）。其中 `c`（cover）命令不需要指定分支，直接执行 `clawt cover`
4. 命令完成后，输出 `按 Enter 返回面板...` 提示
5. 等待用户按 Enter 键
6. 重新进入备选屏幕，立即用旧数据渲染一帧（消除白屏等待），再异步刷新数据，恢复面板

执行操作期间设置操作锁（`isOperating`），阻止其他按键响应。

**自动刷新机制：**

- 数据刷新间隔：每 5 秒自动调用 `collectStatus()` 重新收集数据（常量 `PANEL_REFRESH_INTERVAL_MS`）
- 倒计时更新：每 1 秒更新底栏的倒计时显示（常量 `PANEL_COUNTDOWN_INTERVAL_MS`）
- 刷新后保持选中位置：通过记录刷新前选中的分支名，在新数据中查找匹配的分支恢复选中位置；若分支已被删除则调整到安全范围

**滚动机制：**

- 滚动区域高度 = 终端行数 - 固定行数（标题 + 配置分支信息 + 快照摘要 + 顶部分隔线 + 底部分隔线 + 底栏 = `PANEL_FIXED_ROWS + 1`），最小 3 行
- 导航时自动调整滚动偏移（`scrollOffset`），确保选中项及其所属日期分组标题在可见区域内
- 溢出提示嵌入分隔线中间，不额外占用行数
- 终端 resize 时自动触发重绘

**渲染机制：**

- 使用备选屏幕（`ALT_SCREEN_ENTER` / `ALT_SCREEN_LEAVE`）避免污染原始终端内容
- 使用同步输出序列（`SYNC_OUTPUT_START` / `SYNC_OUTPUT_END`）防止闪烁
- 隐藏光标、禁用行换行，确保渲染效果整洁
- 注册 `exit` 事件兜底处理器，确保异常退出时终端状态被恢复
- 操作返回面板时，先立即用旧数据渲染一帧（消除备选屏幕进入后的白屏），再异步刷新数据并重新渲染
- 每行通过 `truncateToTerminalWidth()` 截断以适配终端宽度

**实现要点：**

- `InteractivePanel` 类定义在 `src/utils/interactive-panel.ts`，参照 `ProgressRenderer` 的生命周期模式实现
- 渲染函数集定义在 `src/utils/interactive-panel-render.ts`，导出以下函数：
  - `buildPanelFrame()`：构建完整帧内容
  - `buildGroupedWorktreeLines()`：按日期分组构建 worktree 行列表，返回 `PanelLine[]`
  - `buildDisplayOrder()`：构建显示顺序到原始索引的映射
  - `renderDateSeparator()`：渲染日期分隔线
  - `renderWorktreeBlock()`：渲染单个 worktree 的多行块
  - `renderSnapshotSummary()`：渲染快照摘要行
  - `renderFooter()`：渲染底栏
  - `calculateVisibleRows()`：计算滚动区域可用行数
  - `renderConfiguredBranchLine()`：渲染配置分支信息行（内部函数，根据 `MainWorktreeStatus` 渲染不同状态）
- 面板常量定义在 `src/constants/interactive-panel.ts`：
  - `PANEL_REFRESH_INTERVAL_MS`（5000）、`PANEL_COUNTDOWN_INTERVAL_MS`（1000）
  - `SELECTED_INDICATOR`（`▶`）、`UNSELECTED_INDICATOR`（等宽空格）
  - `KEY_ARROW_UP`、`KEY_ARROW_DOWN`、`KEY_CTRL_C`
  - `PANEL_SHORTCUT_KEYS`（快捷键映射对象，包含 `VALIDATE`/`MERGE`/`DELETE`/`RESUME`/`SYNC`/`COVER`/`REFRESH`/`QUIT`）
  - `PANEL_DATE_SEPARATOR_PREFIX`（`════`）
  - `PANEL_FIXED_ROWS`（5，固定占用行数：配置分支信息 + 快照摘要 + 顶部分隔线 + 底部分隔线 + 底栏）
  - `PANEL_SEPARATOR_MAX_WIDTH`（60，终端最大显示宽度限制）
  - `PANEL_DATE_COLOR`（`#FF8C00`，日期分隔线高亮颜色，橙色）
- 面板消息常量定义在 `src/constants/messages/interactive-panel.ts`：
  - `PANEL_FOOTER_SHORTCUTS`：底栏快捷键提示（从 `PANEL_SHORTCUT_KEYS` 自动生成）
  - `PANEL_FOOTER_COUNTDOWN(seconds)`：底栏倒计时文本
  - `PANEL_OVERFLOW_DOWN_HINT` / `PANEL_OVERFLOW_UP_HINT`：溢出提示
  - `PANEL_SNAPSHOT_SUMMARY(total, orphaned)`：快照摘要文本
  - `PANEL_NO_WORKTREES`：无 worktree 提示
  - `PANEL_PRESS_ENTER_TO_RETURN`：操作后返回提示
  - `PANEL_NOT_TTY`：非 TTY 降级提示
  - `PANEL_TITLE(projectName)`：面板标题
  - `PANEL_CONFIGURED_BRANCH(branchName)`：配置分支信息（正常状态，灰色）
  - `PANEL_CONFIGURED_BRANCH_DELETED(branchName)`：配置分支信息（分支已删除，红色）
  - `PANEL_CONFIGURED_BRANCH_MISMATCH(branchName)`：配置分支信息（分支不一致，红色）
  - `PANEL_NOT_INITIALIZED`：未初始化提示（灰色）
- `PanelLine` 接口（`src/utils/interactive-panel-render.ts`）：面板行类型定义，包含 `type`（`'separator'` | `'worktree-content'`）、`text`、可选 `worktreeIndex`
- `collectStatus()` 函数已改为导出（`export`），以便 `InteractivePanel` 作为数据收集函数引用
- `handleStatus()` 为 `async` 函数，返回 `Promise<void>`
- `StatusOptions` 类型包含 `json?: boolean` 和 `interactive?: boolean` 字段
- 从 `src/utils/worktree-matcher.ts` 导出 `formatRelativeDate()`、`getWorktreeCreatedDate()` 和 `getWorktreeCreatedTime()`，供面板渲染和状态收集使用

---
