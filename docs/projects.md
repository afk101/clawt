### 5.18 跨项目 Worktree 概览

**命令：**

```bash
clawt projects [name] [--json]
```

**参数：**

| 参数     | 必填 | 说明                                           |
| -------- | ---- | ---------------------------------------------- |
| `[name]` | 否   | 指定项目名，查看该项目的 worktree 详情           |
| `--json` | 否   | 以 JSON 格式输出完整数据                        |

**使用场景：**

当使用 clawt 管理多个不同项目时，快速了解所有项目的 worktree 数量、磁盘占用和最近活跃时间。也可以指定项目名查看该项目下每个 worktree 的分支、路径、最后修改时间和磁盘占用。

**注意：** `projects` 命令不需要在主 worktree 中执行（与其他命令不同），它直接扫描 `~/.clawt/worktrees/` 目录。

**运行流程：**

#### 无参数模式（项目概览）

1. 扫描 `~/.clawt/worktrees/` 目录，列出所有项目子目录
2. 对每个项目收集以下信息：
   - **项目名**（目录名即项目名）
   - **worktree 数量**（项目目录下的子目录数）
   - **最近活跃时间**（取项目目录自身和所有 worktree 目录 mtime 的最大值，通过 `formatLocalISOString()` 格式化为本机时区的 ISO 8601 字符串）
   - **磁盘占用**（通过 `calculateDirSize()` 递归计算整个项目目录的总大小）
3. 按最近活跃时间降序排序
4. 输出概览信息（文本或 JSON）

#### 指定项目模式（worktree 详情）

1. 检查 `~/.clawt/worktrees/<name>/` 是否存在，不存在则报错退出
2. 扫描项目目录，对每个 worktree 子目录收集：
   - **分支名**（目录名即分支名）
   - **worktree 路径**
   - **最后修改时间**（目录 mtime，通过 `formatLocalISOString()` 格式化）
   - **磁盘占用**（通过 `calculateDirSize()` 递归计算）
3. 按最后修改时间降序排序
4. 输出详情信息（文本或 JSON）

**文本输出格式（概览模式）：**

```
════════════════════════════════════════
  项目概览
════════════════════════════════════════

  ● my-project
    3 个 worktree   最近活跃: 2 小时前   磁盘占用: 1.5 GB

  ● another-project
    1 个 worktree   最近活跃: 3 天前   磁盘占用: 256.0 MB

────────────────────────────────────────

  共 2 个项目   总占用: 1.8 GB

════════════════════════════════════════
```

**文本输出格式（详情模式）：**

```
════════════════════════════════════════
  项目详情: my-project
════════════════════════════════════════

  ◆ 路径: ~/.clawt/worktrees/my-project
    总占用: 1.5 GB

────────────────────────────────────────

  ● feature-login
    ~/.clawt/worktrees/my-project/feature-login
    最后修改: 2 小时前   磁盘占用: 800.0 MB

  ● feature-signup
    ~/.clawt/worktrees/my-project/feature-signup
    最后修改: 1 天前   磁盘占用: 700.0 MB

════════════════════════════════════════
```

**JSON 输出格式（概览模式，`--json`）：**

```json
{
  "projects": [
    {
      "name": "my-project",
      "worktreeCount": 3,
      "lastActiveTime": "2025-06-15T18:30:00.000+08:00",
      "diskUsage": 1610612736
    }
  ],
  "totalProjects": 1,
  "totalDiskUsage": 1610612736
}
```

**JSON 输出格式（详情模式，`--json`）：**

```json
{
  "name": "my-project",
  "projectDir": "~/.clawt/worktrees/my-project",
  "worktrees": [
    {
      "branch": "feature-login",
      "path": "~/.clawt/worktrees/my-project/feature-login",
      "lastModifiedTime": "2025-06-15T18:30:00.000+08:00",
      "diskUsage": 838860800
    }
  ],
  "totalDiskUsage": 838860800
}
```

**实现要点：**

- 命令注册函数：`registerProjectsCommand()`（在 `src/commands/projects.ts`）
- 类型定义在 `src/types/project.ts`：`ProjectOverview`、`ProjectWorktreeDetail`、`ProjectDetailResult`、`ProjectsOverviewResult`
- 命令选项类型：`ProjectsOptions`（在 `src/types/command.ts`）
- 消息常量在 `PROJECTS_MESSAGES`（在 `src/constants/messages/projects.ts`）
- 时间格式化使用 `formatLocalISOString()`（在 `src/utils/formatter.ts`），输出本机时区的 ISO 8601 字符串（替代 `Date.toISOString()` 的 UTC 输出）
- 磁盘大小展示使用 `formatDiskSize()`（在 `src/utils/formatter.ts`），将字节数格式化为带单位的可读字符串
- 目录大小计算使用 `calculateDirSize()`（在 `src/utils/fs.ts`），递归遍历目录计算总字节数
- 时间的相对展示使用 `formatRelativeTime()`（在 `src/utils/formatter.ts`），将 ISO 8601 日期转换为中文相对时间（如"2 小时前"）

---
