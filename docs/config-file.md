### 5.7 默认配置文件

**路径：** `~/.clawt/config.json`

**生成时机：** 全局安装后自动生成（通过 `postinstall` 脚本）。

**升级策略：** 配置文件已存在时，执行增量合并而非简单跳过：

- **新版本新增的配置项** → 使用默认值补充到用户配置中
- **用户已有的配置项** → 保留用户的值，不覆盖
- **新版本已移除的配置项** → 从用户配置中删除

仅在合并后配置发生变化时才写入文件。配置文件损坏或无法解析时，视为不存在，重新生成默认配置。

**默认内容：**

```json
{
  "autoDeleteBranch": false,
  "claudeCodeCommand": "claude",
  "autoPullPush": false,
  "confirmDestructiveOps": true,
  "maxConcurrency": 0,
  "terminalApp": "auto",
  "resumeInPlace": false,
  "aliases": {},
  "autoUpdate": true,
  "conflictResolveMode": "ask",
  "conflictResolveTimeoutMs": 600000
}
```

**配置项说明：**

| 配置项             | 类型      | 默认值    | 说明                                               |
| ------------------ | --------- | --------- | -------------------------------------------------- |
| `autoDeleteBranch` | `boolean` | `false`   | 移除 worktree 时是否自动删除对应本地分支（无需每次确认）；merge 成功后是否自动清理 worktree 和分支；run 任务被中断（Ctrl+C）后是否自动清理本次创建的 worktree 和分支 |
| `claudeCodeCommand` | `string` | `"claude"` | Claude Code CLI 启动指令，用于 `clawt run` 不传 `--tasks` 时和 `clawt resume` 在 worktree 中打开交互式界面 |
| `autoPullPush` | `boolean` | `false` | merge 成功后是否自动执行 git pull 和 git push |
| `confirmDestructiveOps` | `boolean` | `true` | 执行破坏性操作（reset、validate --clean）前是否提示确认 |
| `maxConcurrency` | `number` | `0` | run 命令默认最大并发数，`0` 表示不限制 |
| `terminalApp` | `string` | `"auto"` | 批量 resume 使用的终端应用：`auto`（自动检测）、`iterm2`、`terminal`（macOS） |
| `resumeInPlace` | `boolean` | `false` | resume 单选时是否在当前终端就地打开，`false` 则通过 `terminalApp` 在新 Tab 中打开 |
| `aliases` | `Record<string, string>` | `{}` | 命令别名映射，键为别名，值为目标内置命令名 |
| `autoUpdate` | `boolean` | `true` | 是否启用自动更新检查（每 24 小时通过 npm registry 检查一次新版本） |
| `conflictResolveMode` | `string` | `"ask"` | merge 冲突时的解决模式：`ask`（询问是否使用 AI）、`auto`（自动 AI 解决）、`manual`（手动解决） |
| `conflictResolveTimeoutMs` | `number` | `600000` | Claude Code 冲突解决超时时间（毫秒），默认 600000（10 分钟） |

---
