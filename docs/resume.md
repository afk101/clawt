### 5.11 在已有 Worktree 中恢复会话

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt resume -b <branchName>

# 不指定分支名（列出所有分支供多选）
clawt resume
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b` | 否   | 要恢复的分支名（支持模糊匹配，不传则列出所有分支供多选） |

**使用场景：**

当用户之前通过 `clawt run` 或 `clawt create` 创建了 worktree 但会话已结束，希望在该 worktree 中重新打开 Claude Code 交互式界面继续工作。支持一次选中多个分支，自动在独立终端 Tab 中批量恢复。

**运行流程：**

1. **前置校验**（`PRE_CHECK_RESUME`）：主 worktree 校验 (2.1) + HEAD 存在性校验 + Claude Code CLI 可用性校验
2. **解析目标 worktree**：根据是否传入 `-b` 参数以及 worktree 数量，采用不同的解析策略：
   - **未传 `-b` 参数**：
     - 获取当前项目所有 worktree
     - 无可用 worktree → 报错退出
     - 仅 1 个 worktree → 通过 `resolveTargetWorktrees` 直接使用，无需选择
     - 多个 worktree → 通过 `promptGroupedMultiSelectBranches` 展示**按日期分组的交互式多选列表**（详见下文「按日期分组多选」）
   - **传了 `-b` 参数**：通过 `resolveTargetWorktrees` 解析，匹配策略如下：
     1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
     2. **模糊匹配**（子串匹配，大小写不敏感）：
        - 唯一匹配 → 直接使用
        - 多个匹配 → 通过交互式多选列表让用户从匹配结果中选择
     3. **无匹配** → 报错退出，并列出所有可用分支名
3. **根据选中数量自动分发**：
   - **用户未选择任何分支** → 直接退出
   - **选中 1 个** → 根据全局配置项 `resumeInPlace` 决定打开方式：
     - `resumeInPlace: true` → 在当前终端就地恢复，通过 `launchInteractiveClaude()` 启动（使用 `spawnSync` + `inherit stdio`）
     - `resumeInPlace: false`（默认） → 通过 `launchInteractiveClaudeInNewTerminal()` 在新终端 Tab 中恢复，终端类型由 `terminalApp` 配置控制
   - **选中多个** → 进入批量恢复流程（见下文），始终在新终端 Tab 中打开，不受 `resumeInPlace` 影响

**批量恢复流程：**

1. **计算会话状态**：一次性遍历所有选中的 worktree，通过 `hasClaudeSessionHistory()` 检测是否存在历史会话，构建 sessionMap 避免重复 I/O
2. **输出预览**：列出即将恢复的分支及其会话状态（"继续上次对话"或"新对话"）
3. **用户确认**：提示即将在 N 个独立终端 Tab 中恢复会话，等待用户确认
4. **逐个在新终端 Tab 中启动**：通过 `launchInteractiveClaudeInNewTerminal()` 构建 shell 命令并通过 AppleScript 在新终端 Tab 中执行
5. **输出完成提示**

**终端 Tab 管理：**

批量恢复通过 `openCommandInNewTerminalTab()`（`src/utils/terminal.ts`）在新终端 Tab 中启动 Claude Code。终端类型由配置项 `terminalApp` 控制：

| 配置值     | 行为                                                         |
| ---------- | ------------------------------------------------------------ |
| `auto`     | 自动检测：优先检测 iTerm2 是否已安装（`/Applications/iTerm.app`），已安装则使用 iTerm2，否则降级到 Terminal.app |
| `iterm2`   | 强制使用 iTerm2                                               |
| `terminal` | 强制使用 Terminal.app                                         |

**平台限制：** 批量恢复目前仅支持 macOS 平台（通过 AppleScript 打开终端 Tab）。非 macOS 平台会抛出错误。

**权限要求：** Terminal.app 通过 System Events 模拟键盘操作（`Cmd+T`）新建 Tab，需要在「系统设置 → 隐私与安全性 → 辅助功能」中授权终端应用。iTerm2 使用原生 AppleScript 接口，无需辅助功能权限。

启动命令通过配置项 `claudeCodeCommand`（默认值 `claude`）指定，与 `clawt run` 不传 `--tasks` 时的交互式界面行为一致。

**按日期分组多选：**

当未传 `-b` 且有多个 worktree 时，使用 `promptGroupedMultiSelectBranches` 展示按创建日期分组的交互式多选列表，实现流程如下：

1. **日期分组**（`groupWorktreesByDate`）：通过 `statSync` 获取各 worktree 目录的文件系统创建时间（`birthtime`），按本地时区格式化为 `YYYY-MM-DD` 作为分组键。无法获取创建时间的分支归入「未知日期」组。分组按日期降序排列，未知日期组在最后。
2. **构建选项列表**（`buildGroupedChoices`）：生成包含以下元素的 Enquirer MultiSelect choices 数组：
   - 顶部：全局全选选项 `[select-all]`
   - 每组：日期分隔线（显示日期和相对时间，如「2026-02-26（昨天）」）→ 组级全选选项 `[select-all: YYYY-MM-DD]` → 该组内各分支
2.5. **构建组成员映射**（`buildGroupMembershipMap`）：生成"组全选 name → 该组分支 name 列表"的 Map，供三级联动的 `space()` 方法快速查找某个组全选项对应的所有分支
3. **三级联动选择**：通过继承 Enquirer MultiSelect 并覆写 `space()` 方法实现，同步逻辑由 `syncGlobalSelectAll` 和 `syncGroupSelectAll` 两个内部函数负责：
   - **全局全选**：toggle 所有 choices（含组全选）
   - **组级全选**：toggle 该组内所有分支，并同步全局全选状态
   - **普通分支**：toggle 该分支，同步所属组全选和全局全选状态
4. **过滤结果**：返回时过滤掉全选项和组全选项，只返回实际选中的 worktree

相对日期显示规则：`formatRelativeDate` 基于自然日差值计算——今天 / 昨天 / N 天前 / N 个月前 / N 年前。

相关常量定义在 `src/constants/prompt.ts`：

| 常量 | 说明 |
| ---- | ---- |
| `GROUP_SELECT_ALL_PREFIX` | 组级全选选项的 name 前缀（`__group_select_all_`） |
| `GROUP_SELECT_ALL_LABEL(dateLabel)` | 生成组级全选选项的显示文本 |
| `GROUP_SEPARATOR_LABEL(dateLabel, relativeTime)` | 生成日期分隔线的显示文本（含 chalk 高亮） |
| `UNKNOWN_DATE_GROUP` | 无法获取创建日期时的默认分组名称（`未知日期`） |
| `UNKNOWN_DATE_SEPARATOR_LABEL` | 未知日期分组的分隔线显示文本 |
| `SELECT_ALL_NAME` | 全局全选选项的标识名称（`__select_all__`） |
| `SELECT_ALL_LABEL` | 全局全选选项的显示文本（`[select-all]`） |

**会话自动续接：** 启动前会自动检测该 worktree 是否存在 Claude Code 历史会话（通过检查 `~/.claude/projects/<encoded-path>/` 下是否有 `.jsonl` 文件判断），如果存在则自动追加 `--continue` 参数继续上次对话，否则打开新对话。启动信息中会显示当前模式（"继续上次对话"或"新对话"）。路径编码规则：将绝对路径中所有非字母数字字符替换为 `-`（与 Claude Code 源码的编码逻辑一致）。

---
