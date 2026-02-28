### 5.14 项目全局状态总览

**命令：**

```bash
clawt status [--json]
```

**参数：**

| 参数     | 必填 | 说明                                     |
| -------- | ---- | ---------------------------------------- |
| `--json` | 否   | 以 JSON 格式输出完整状态数据              |

**使用场景：**

在管理多个 worktree 时，快速了解项目全局状态：主 worktree 当前分支及干净状态、所有 worktree 的变更情况和与主分支的同步状态、validate 快照摘要。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **收集主 worktree 状态**：
   - 获取当前分支名（`getCurrentBranch()`）
   - 检测工作区是否干净（`isWorkingDirClean()`）
   - 获取项目名（`getProjectName()`）
3. **收集各 worktree 详细状态**：
   - 获取项目所有 worktree（`getProjectWorktrees()`）
   - 对每个 worktree 收集以下信息：
     - **变更状态**（优先级：合并冲突 > 未提交修改 > 已提交 > 无变更）
     - **行数差异**（新增/删除行数，通过 `getDiffStat()` 获取）
     - **提交差异**（相对于主分支的领先提交数 `getCommitCountAhead()` 和落后提交数 `getCommitCountBehind()`）
     - **快照时间**（validate 快照文件的 mtime，通过 `getSnapshotModifiedTime()` 获取，返回 ISO 8601 时间字符串或 null）
     - **分支创建时间**（通过 `getBranchCreatedAt()` 从 git reflog 获取分支创建时的时间戳）
4. **收集 validate 快照摘要**：
   - 通过 `getProjectSnapshotBranches()` 扫描快照目录下的 `.tree` 文件获取所有存在快照的分支名
   - 统计快照总数和孤立快照数（对应 worktree 已不存在的快照）
5. **输出状态信息**：
   - 指定 `--json` → 以 JSON 格式输出完整状态数据（`JSON.stringify`）
   - 未指定 → 以文本格式输出

**文本输出格式（默认）：**

输出分为三个区块：主 Worktree、Worktree 列表、Validate 快照摘要。每个 worktree 条目每行展示一种信息。

```
════════════════════════════════════════
  项目状态总览: main-project
════════════════════════════════════════

  ◆ 主 Worktree
    分支: main
    状态: ✓ 干净

────────────────────────────────────────

  ◆ Worktree 列表 (2 个)

  ● feature-login   [已提交]
    +120 -30   3 个本地提交   与主分支同步
    创建于 3 天前
    上次验证: 2 小时前

  ● feature-signup   [未提交修改]
    +45 -10   1 个本地提交   落后主分支 2 个提交
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

**差异统计行展示规则：**

- 行数变更（`+N -N`）仅在有变更时展示
- 本地提交数（`N 个本地提交`）仅在有提交时展示
- 与主分支同步状态始终展示（落后时显示黄色，同步时显示绿色）

**分支创建时间行：**

- 通过 `getBranchCreatedAt()` 从 git reflog 获取分支创建时间，以 `formatRelativeTime()` 格式化为中文相对时间（如"3 天前"、"2 小时前"、"刚刚"）
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
    "projectName": "main-project"
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

**实现要点：**

- 类型定义在 `src/types/status.ts`：`WorktreeDetailedStatus`（`hasSnapshot` 已改为 `snapshotTime: string | null`，新增 `createdAt: string | null`）、`MainWorktreeStatus`、`SnapshotInfo`、`SnapshotSummary`（新增，包含 `total` 和 `orphaned`）、`StatusResult`（`snapshots` 已从 `SnapshotInfo[]` 改为 `SnapshotSummary`）
- 消息常量在 `MESSAGES.STATUS_*` 系列，新增：
  - `STATUS_LAST_VALIDATED`：上次验证时间标签（如 `上次验证: 2 小时前`）
  - `STATUS_NOT_VALIDATED`：未验证红色警示文本（`✗ 未验证`）
  - `STATUS_CREATED_AT`：分支创建时间标签（如 `创建于 3 天前`）
  - `STATUS_SNAPSHOT_ORPHANED`：改为接受数量参数的函数（如 `其中 1 个快照对应的 worktree 已不存在`）
- `getBranchCreatedAt()` 是新增的工具函数（在 `src/utils/git.ts`），通过 `git reflog show <branch> --format=%cI` 获取 reflog 最后一条记录的时间戳（即分支创建时间），返回 ISO 8601 格式字符串或 null
- `getSnapshotModifiedTime()` 是新增的工具函数（在 `src/utils/validate-snapshot.ts`），通过 `fs.statSync` 获取快照文件的修改时间（mtime），返回 ISO 8601 格式字符串或 null
- `formatRelativeTime()` 是新增的格式化函数（在 `src/utils/formatter.ts`），将 ISO 8601 日期字符串转换为中文相对时间描述（如"3 天前"、"2 小时前"、"刚刚"），无效日期时返回 null
- `getCommitCountBehind()` 是新增的工具函数（在 `src/utils/git.ts`），通过 `git rev-list --count <branch>..HEAD` 计算落后提交数
- `getProjectSnapshotBranches()` 是新增的工具函数（在 `src/utils/validate-snapshot.ts`），通过扫描快照目录下的 `.tree` 文件提取分支名列表
- `formatDiskSize()` 是新增的格式化函数（在 `src/utils/formatter.ts`），将字节数格式化为带单位的磁盘大小字符串（如 `"1.5 GB"`、`"256.0 MB"`、`"10.2 KB"`、`"512 B"`）
- `formatLocalISOString()` 是新增的格式化函数（在 `src/utils/formatter.ts`），将 Date 对象格式化为本机时区的 ISO 8601 字符串（输出格式: `YYYY-MM-DDTHH:mm:ss.sss+HH:MM`），替代 `Date.toISOString()` 的 UTC 时区输出
- `calculateDirSize()` 是新增的文件系统工具函数（在 `src/utils/fs.ts`），递归计算目录占用的磁盘大小（字节），遇到无法访问的文件或目录时静默跳过

---
