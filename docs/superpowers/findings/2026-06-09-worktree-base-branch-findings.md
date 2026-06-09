# 发现与决策

## 需求
- 为 `clawt status`、`clawt status -i`、`clawt list` 增加当前 worktree/branch 的来源原始分支展示。
- 目标是避免把基于 `test` 等分支创建的 worktree 误合并到 `master` 等错误目标分支。
- 优先通过 git 信息识别来源分支；如果不可行，则在 `~/.clawt/` 的合适位置记录。
- 用户确认来源语义为：记录创建 worktree 时所在的真实当前分支，例如当时在 `test` 上创建就记录 `test`。

## 研究发现
- `src/commands/status.ts` 的 `collectStatus()` 通过 `getProjectWorktrees()` 取得 worktree，再为每个 worktree 收集提交差异、porcelain、diff 统计、创建时间和 validate 快照。
- `src/commands/list.ts` 文本输出目前展示 `path [branch]`，JSON 输出只包含 `path` 和 `branch`。
- `src/utils/worktree.ts` 的 `getProjectWorktrees()` 只从 `~/.clawt/worktrees/<project>/` 目录名和 `git worktree list` 交叉验证得到 path/branch，没有来源分支字段。
- `src/utils/git-branch.ts` 的 `getCommitDivergenceAsync(branchName)` 当前使用 `HEAD...branchName`，在主 worktree 当前分支作为基准时有效，但不是每个 worktree 创建时的来源分支。
- `src/commands/create.ts` 通过 `createWorktrees(options.branch, count)` 创建 worktree；前置检查由 `PRE_CHECK_CREATE` 控制，文档说明 create 应确保当前在 `clawtMainWorkBranch` 上。
- 项目已有 `src/constants/paths.ts`，其中 `PROJECTS_CONFIG_DIR` 可复用为 worktree metadata 的项目级根目录。
- `src/constants/pre-checks.ts` 中 `PRE_CHECK_CREATE` 包含 `ensureOnClawtMainWorkBranch: true`，因此当前 `clawt create` 会尽量从项目配置主分支创建。
- `src/utils/project-config.ts` 将项目配置放在 `~/.clawt/projects/<projectName>/config.json`，但这是项目级单份配置，不适合直接塞大量 worktree 条目。
- `src/utils/interactive-panel-render.ts` 的 `renderWorktreeBlock()` 负责 `status -i` 每个 worktree 条目的显示，需要与文本版 `printWorktreeItem()` 保持字段一致。
- `tests/unit/commands/status.test.ts`、`tests/unit/commands/list.test.ts`、`tests/unit/utils/worktree.test.ts` 已覆盖 JSON 输出、文本渲染调用和 worktree 创建/解析，是本功能主要测试入口。
- 设计确认后，范围限定为：创建时记录 metadata，`status` / `status -i` / `list` 展示；不新增历史回填命令，不修改 merge 目标逻辑。

## 技术决策
| 决策 | 理由 |
|------|------|
| 优先设计创建时记录来源分支 | Git worktree/list/reflog 不能稳定表达“当初从哪个业务分支创建”，尤其分支移动、merge、rebase 后事后推断容易误判 |
| 来源分支元数据放在 `~/.clawt/` 项目维度目录下 | 用户接受无法从 git 稳定获取时在 `~/.clawt/` 记录；现有 `WORKTREES_DIR` 和 `PROJECTS_CONFIG_DIR` 都在该目录下 |
| 展示逻辑应复用同一个来源解析函数 | `status`、`status -i`、`list` 都需要相同字段，避免三个命令各自拼装导致不一致 |
| 历史 worktree 缺失 metadata 时只显示未记录 | 只记录新建 worktree 会让旧 worktree 没有来源数据；显示未记录比不可靠推断更安全 |
| 来源分支定义为创建瞬间的当前分支 | 用户明确选择此语义；它能区分从 `master`、`test` 等不同分支创建的 worktree |
| 元数据存放在 `~/.clawt/projects/<projectName>/worktrees/<branchName>.json` | 用户认可该路径；它属于项目级动态元数据，不污染项目配置 `config.json`，且单分支单文件便于局部清理 |
| 历史 worktree 缺失 metadata 时显示未记录 | 不用不可靠 git 推断伪造来源，避免给用户错误安全感 |
| 不新增历史回填命令 | 本次目标是新增展示和新建记录能力，回填属于后续可独立设计的增强功能 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| Git 无法稳定反推出创建时原始分支 | 在创建 worktree 时写入 `~/.clawt/` 元数据，展示时读取；历史数据用回退策略标记 |
| `status -i` 和普通文本输出分别渲染 | 在状态数据层新增来源字段，让两个渲染器只负责显示 |
| `config.json` 不适合存储 worktree 来源 | 使用项目目录下的 `worktrees/<branch>.json` 存储动态元数据，保持配置与运行元数据分离 |

## 资源
- `src/commands/status.ts`
- `src/commands/list.ts`
- `src/commands/create.ts`
- `src/utils/git-worktree.ts`
- `src/utils/worktree.ts`
- `src/utils/git-branch.ts`
- `src/constants/paths.ts`
- `src/types/status.ts`
- `src/types/worktree.ts`

## 视觉 / 浏览器发现
<!-- 每执行 2 次查看/浏览器操作后必须更新此部分 -->
<!-- 多模态内容必须立即以文本形式记录 -->
- 本任务暂无视觉内容。

---
*每执行 2 次查看/浏览器/搜索操作后更新此文件*
