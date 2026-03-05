### 5.8 获取当前项目所有 Worktree

**命令：**

```bash
clawt list [--json]
```

**参数：**

| 参数     | 必填 | 说明                                     |
| -------- | ---- | ---------------------------------------- |
| `--json` | 否   | 以 JSON 格式输出（仅包含 path 和 branch） |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. 获取项目的所有 worktree 列表（扫描 `~/.clawt/worktrees/<project>/` 目录，与 `git worktree list` 交叉验证）
4. 根据 `--json` 选项决定输出格式：
   - 指定 `--json` → 以 JSON 格式输出（仅包含 path 和 branch）
   - 未指定 → 以文本格式输出（包含变更状态信息）

**文本输出格式（默认）：**

每个 worktree 会显示路径、分支名和变更状态。每个 worktree 条目下方额外显示一行状态信息（提交数、变更行数、未提交修改），各条目之间以空行分隔。如果某个 worktree 处于空闲状态（0 个提交、无变更、无未提交修改），其路径会以橙色高亮显示，方便用户快速识别可能需要清理或还未开始工作的 worktree。

```
当前项目: main-project

  ~/.clawt/worktrees/main-project/feature-scheme-1   [feature-scheme-1]
    3 个提交   +120 -30   (未提交修改)

  ~/.clawt/worktrees/main-project/feature-scheme-2   [feature-scheme-2]
    1 个提交   +45 -10

  ~/.clawt/worktrees/main-project/feature-scheme-3   [feature-scheme-3]    ← 橙色路径（空闲）
    0 个提交   无变更

  ~/.clawt/worktrees/main-project/bugfix-login   [bugfix-login]
    2 个提交   +80 -25

共 4 个 worktree
```

如果没有 worktree：

```
当前项目: main-project

  (无 worktree)
```

**JSON 输出格式（`--json`）：**

```json
{
  "project": "main-project",
  "total": 4,
  "worktrees": [
    {
      "path": "~/.clawt/worktrees/main-project/feature-scheme-1",
      "branch": "feature-scheme-1"
    },
    {
      "path": "~/.clawt/worktrees/main-project/feature-scheme-2",
      "branch": "feature-scheme-2"
    }
  ]
}
```

---
