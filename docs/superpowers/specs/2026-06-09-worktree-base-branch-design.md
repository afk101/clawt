# Worktree Base Branch Design

## 背景

当前 `clawt status`、`clawt status -i` 和 `clawt list` 会把同一项目下的 worktree 展示在一起，但不会标明这些 worktree 分支最初基于哪个分支创建。当用户同时从 `master`、`test` 等多个分支创建 worktree 时，容易把基于 `test` 的 worktree 误合并到 `master`，风险较高。

## 目标

- 在 `clawt create` 创建 worktree 时记录创建瞬间的真实当前分支，作为该 worktree 的来源分支。
- 在 `clawt status`、`clawt status -i`、`clawt list` 中展示来源分支。
- JSON 输出包含稳定字段，便于脚本消费。
- 历史 worktree 没有元数据时明确展示未记录，不通过不可靠 git 推断伪造结果。

## 非目标

- 不新增历史回填命令。
- 不修改 `clawt merge` 的合并目标逻辑。
- 不改变 `clawt init` 的项目主工作分支配置语义。
- 不把 worktree 元数据写入 `~/.clawt/projects/<projectName>/config.json`。

## 来源分支语义

来源分支定义为执行 `clawt create` 时，创建 worktree 前主 worktree 当前所在的真实分支。示例：用户当时位于 `test` 分支并创建 `feature-login`，则 `feature-login` 的 `baseBranch` 为 `test`。

该语义优先于项目配置中的 `clawtMainWorkBranch`。如果现有前置检查在创建前切换了分支，则记录切换后的真实当前分支，因为它才是实际执行 `git worktree add -b` 的基准。

## 存储设计

每个 worktree 分支使用一个独立 JSON 文件：

```text
~/.clawt/projects/<projectName>/worktrees/<branchName>.json
```

文件内容：

```json
{
  "branch": "feature-login",
  "baseBranch": "test",
  "createdAt": "2026-06-09T10:30:00.000Z"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `branch` | `string` | worktree 对应分支名 |
| `baseBranch` | `string` | 创建 worktree 时所在的真实当前分支 |
| `createdAt` | `string` | 元数据写入时间，ISO 8601 字符串 |

元数据属于项目级动态数据，应放在 `~/.clawt/projects/<projectName>/worktrees/` 下。项目配置 `config.json` 继续只保存配置项，避免运行元数据污染配置文件。

## 代码结构

新增 `src/utils/worktree-metadata.ts`，职责限定为 worktree 元数据路径、读写、删除：

- `getWorktreeMetadataPath(projectName, branchName)`：生成单个分支元数据路径。
- `saveWorktreeMetadata(projectName, metadata)`：保存来源分支元数据。
- `loadWorktreeMetadata(projectName, branchName)`：读取元数据，缺失或解析失败时返回 `null`。
- `removeWorktreeMetadata(projectName, branchName)`：删除元数据，文件不存在时不报错。

新增类型 `WorktreeMetadata`，包含 `branch`、`baseBranch`、`createdAt`。现有 `WorktreeInfo` 和 `WorktreeDetailedStatus` 增加 `baseBranch: string | null`。

## 数据流

创建流程：

1. `clawt create` 完成前置检查。
2. `createWorktrees()` 在创建前读取 `getCurrentBranch()`。
3. 每成功创建一个 worktree 和 validate 分支后，写入对应 metadata 文件。
4. 命令输出继续展示目录、分支、验证分支；是否在创建输出中展示来源分支由实现保持简洁，可不新增。

读取流程：

1. `getProjectWorktrees()` 扫描 `~/.clawt/worktrees/<projectName>/` 并与 `git worktree list` 交叉验证。
2. 对每个有效 worktree 读取 `~/.clawt/projects/<projectName>/worktrees/<branch>.json`。
3. 返回 `WorktreeInfo` 时带上 `baseBranch`，没有元数据时为 `null`。
4. `status` 的收集层把 `baseBranch` 传入 `WorktreeDetailedStatus`。
5. `list`、`status` 文本渲染和交互面板只负责展示已有字段。

## 展示规则

`clawt status` 普通文本输出中，每个 worktree 条目增加一行：

```text
来源分支: test
```

英文语言环境显示：

```text
Base branch: test
```

没有元数据时显示：

```text
来源分支: 未记录
```

英文语言环境显示：

```text
Base branch: Not recorded
```

`clawt status -i` 交互面板在每个 worktree 块中同样显示来源分支行。

`clawt list` 文本输出在路径与分支行中追加来源分支：

```text
~/.clawt/worktrees/project/feature-login   [feature-login]   <- test
```

没有元数据时：

```text
~/.clawt/worktrees/project/feature-login   [feature-login]   <- 未记录
```

JSON 输出新增 `baseBranch` 字段：

```json
{
  "path": "~/.clawt/worktrees/project/feature-login",
  "branch": "feature-login",
  "baseBranch": "test"
}
```

历史 worktree 无元数据时：

```json
{
  "path": "~/.clawt/worktrees/project/legacy",
  "branch": "legacy",
  "baseBranch": null
}
```

## 清理规则

`cleanupWorktrees()` 删除 worktree、普通分支和 validate 分支时，同步删除对应 metadata 文件。删除 metadata 失败不阻断主清理流程，只记录日志。

## 错误处理

- 元数据文件不存在：返回 `null`，展示未记录。
- 元数据 JSON 解析失败：记录 warning，返回 `null`。
- 保存 metadata 失败：记录错误并抛出，让创建流程暴露问题，因为创建后无法记录来源会削弱防误操作能力。
- 删除 metadata 失败：记录错误，不影响删除 worktree 的主流程。

## 测试要求

- `createWorktrees()` 和 `createWorktreesByBranches()` 创建成功后写入 `baseBranch`。
- `getProjectWorktrees()` 能读取已有 `baseBranch`，缺失时返回 `null`。
- `cleanupWorktrees()` 删除对应 metadata。
- `clawt list --json` 输出 `baseBranch`。
- `clawt status --json` 输出 `baseBranch`。
- `status` 文本输出和 `status -i` 渲染显示来源分支。
- 元数据解析失败不导致 status/list 崩溃。

## 验收标准

- 新创建的 worktree 在 `status`、`status -i`、`list` 中能看到来源分支。
- 旧 worktree 没有 metadata 时显示未记录，JSON 为 `null`。
- 删除 worktree 时对应 metadata 文件被清理。
- 现有 `status`、`list`、`create` 单元测试通过，新增测试覆盖来源分支功能。
