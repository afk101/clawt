### 5.4 在主 Worktree 验证其他分支

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt validate -b <branchName> [--clean] [-r <command>]

# 不指定分支名（列出所有分支供选择）
clawt validate [--clean] [-r <command>]
```

**参数：**

| 参数          | 必填 | 说明                                                                     |
| ------------- | ---- | ------------------------------------------------------------------------ |
| `-b`          | 否   | 要验证的 worktree 分支名（支持模糊匹配，不传则列出所有分支供选择）           |
| `--clean`     | 否   | 清理 validate 状态（重置主 worktree 并删除快照）                            |
| `-r, --run`   | 否   | validate 成功后在主 worktree 中执行的命令（如测试、构建等）。不传时自动从项目配置的 `validateRunCommand` 读取 |

> **限制：** 单次只能验证一个分支，不支持批量验证。

**背景说明：**

Git worktree 不会包含 `node_modules`、`.venv` 等依赖文件，每次安装依赖耗时较长。利用 `git diff HEAD...branch --binary`（三点 diff）可以获取目标分支自分叉点以来的全量变更（包含已提交和未提交的修改），将其作为 patch 应用到主 worktree 中进行测试，无需重新安装依赖。

**验证分支机制：**

validate 不再在主工作分支上直接 apply patch，而是先切换到目标分支对应的**验证分支**（`clawt-validate-<branchName>`），再 apply patch。验证分支的 HEAD 不会随主工作分支推进，因此 patch apply 永远不会冲突。详见 [2.5 验证分支](#25-验证分支)。

**快照机制：**

validate 命令引入了**快照（snapshot）机制**来支持增量对比。每次 validate 执行成功后，会将当前全量变更通过 `git write-tree` 保存为 git tree 对象，并将 tree hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），同时将验证分支的 HEAD commit hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.head`），以及 validate 结束时暂存区对应的 tree hash 记录到文件（`~/.clawt/validate-snapshots/<project>/<branchName>.staged`），用于增量 validate 时对齐基准和无变更恢复。当再次执行 validate 时，先计算当前变更的 tree hash 与旧快照对比：如果没有新变更（tree hash 和 HEAD 均未变化），直接通过 `git read-tree` 恢复上次 validate 结束时的暂存区状态，跳过后续步骤；如果有新变更，则继续执行暂存区载入流程——如果验证分支 HEAD 未变化（正常情况），通过 `git read-tree` 将上次快照的 tree 对象载入暂存区；如果验证分支 HEAD 已变化（sync 后重建了验证分支），则将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上，避免新旧 tree 基准不同导致 diff 混入 HEAD 变化的内容。最终用户可通过 `git diff` 查看两次 validate 之间的增量差异。

**运行流程：**

#### `--clean` 模式

当指定 `--clean` 选项时，执行清理逻辑后直接返回，不进入常规 validate 流程：

1. **前置校验**：主 worktree 校验 + HEAD 存在性校验 + 项目配置校验（`runPreChecks`）
2. **解析目标 worktree**：通过模糊匹配解析目标分支（匹配策略同下文常规 validate 流程中的描述）
3. 如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的危险指令和操作后果），用户取消则退出
4. 如果主 worktree 有未提交更改，执行 `git reset --hard` + `git clean -fd` 清空
5. 确保当前处于主工作分支上（`ensureOnMainWorkBranch`）：如果在验证分支上，清理后切回；如果在其他分支上，交互处理脏工作区后切回
6. 删除对应分支的快照文件
7. 输出清理成功提示

#### 首次 validate（无历史快照）

> 常规 validate（首次和增量）执行前均会先进行前置校验：主 worktree 校验 + HEAD 存在性校验 + 项目配置校验（`runPreChecks`）。

##### 步骤 0：解析目标 worktree

根据 `-b` 参数解析目标 worktree，匹配策略如下：

- **未传 `-b` 参数**：
  - 获取当前项目所有 worktree
  - 无可用 worktree → 报错退出
  - 仅 1 个 worktree → 直接使用，无需选择
  - 多个 worktree → 通过交互式列表（Enquirer.Select）让用户选择
- **传了 `-b` 参数**：
  1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
  2. **模糊匹配**（子串匹配，大小写不敏感）：
     - 唯一匹配 → 直接使用
     - 多个匹配 → 通过交互式列表让用户从匹配结果中选择
  3. **无匹配** → 报错退出，并列出所有可用分支名

##### 步骤 0.5：清理外部软链接

在变更检测之前，自动扫描目标 worktree 根目录，移除指向 worktree 外部路径的软链接。

**背景：** AI Agent（如 Claude Code）在 worktree 中执行任务时，可能会通过软链接（如 `node_modules → /path/to/main-worktree/node_modules`）引用主 worktree 或其他外部路径的依赖目录。这些指向外部的软链接会导致 `git diff` 和 `git apply` 的行为异常，进而使 patch apply 失败。validate 命令在变更检测前自动清理这些软链接，确保后续 patch 流程正常执行。

**实现要点：**

- `removeExternalSymlinks(dir)`（`src/utils/symlink-guard.ts`）：扫描目录中所有软链接，判断其目标路径是否在 worktree 根目录之外（通过 `path.relative` 判断是否以 `..` 开头），移除外部软链接并返回被移除的路径列表
- 内部辅助函数 `isExternalSymlink(linkPath, worktreeRoot)` 判断软链接目标是否指向外部：先解析软链接目标（绝对路径直接使用，相对路径基于 worktreeRoot 解析），再通过 `relative` 判断目标是否在 worktree 之外
- 安全措施：删除前通过 `lstatSync` 再次确认目标仍是软链接（而非已被替换的普通文件），缩小 TOCTOU 口
- 不可读目录或删除失败时静默处理（仅输出 warn 日志），不中断 validate 流程
- 如果移除了外部软链接，输出警告提示：`⚠ 检测到 N 个指向 worktree 外部的软链接（可能由 AI Agent 创建），已自动移除`
- 消息常量：`MESSAGES.VALIDATE_EXTERNAL_SYMLINKS_FOUND`（`src/constants/messages/validate.ts`）

##### 步骤 1：检测目标分支变更

统一检测目标 worktree 的未提交修改和已提交 commit：

```bash
# 检测未提交修改
cd ~/.clawt/worktrees/<project>/<branchName>
git status --porcelain

# 检测已提交 commit（在主 worktree 中执行）
cd <主 worktree 路径>
git log HEAD..<branchName> --oneline
```

- **两者均无** → 输出提示 `该 worktree 的分支上没有任何更改，无需验证`，退出
- **至少有一项** → 继续

##### 步骤 2：检测主 worktree 工作区状态

执行 `git status --porcelain`，判断主 worktree 是否有未提交的更改。

- **无更改** → 进入步骤 3
- **有更改** → 提示用户选择处理方式，使用交互式选择（方向键切换，回车确认）：

```
⚠ 当前分支有未提交的更改，请选择处理方式：

❯ reset        - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)
  stash        - 暂存更改 (git add . && git stash)
  exit         - 退出，手动处理
```

| 选项    | 执行命令                                  | 默认 |
| ------- | ----------------------------------------- | ---- |
| `reset` | `git reset --hard HEAD && git clean -fd`  | 是   |
| `stash` | `git add . && git stash push -m "clawt:auto-stash"` | 否   |
| `exit`  | 退出程序                                  | 否   |

执行完毕后，通过 `git status --porcelain` 再次检测状态，确保工作区干净。如果仍然不干净，报错退出。

##### 步骤 3：切换到验证分支

```bash
cd <主 worktree 路径>
git checkout clawt-validate-<branchName>
```

如果验证分支不存在，直接报错退出：

```
验证分支 clawt-validate-<branchName> 不存在，请先执行 clawt create 或 clawt run 创建分支 <branchName>
```

##### 步骤 4：通过 patch 迁移目标分支全量变更

使用三点 diff（`git diff HEAD...branchName --binary`）获取目标分支自分叉点以来的全量变更。如果目标 worktree 有未提交修改，先做临时 commit 以便 diff 能捕获全部变更，diff 完成后撤销临时 commit 恢复原状。

```bash
# 如果有未提交修改，先临时提交
cd ~/.clawt/worktrees/<project>/<branchName>
git add .
git commit -m "clawt:temp-commit-for-validate"

# 在主 worktree（已切换到验证分支）中执行三点 diff
cd <主 worktree 路径>
git diff HEAD...<branchName> --binary | git apply

# 撤销临时 commit，恢复目标 worktree 原状
cd ~/.clawt/worktrees/<project>/<branchName>
git reset --soft HEAD~1
git restore --staged .
```

> 由于验证分支的 HEAD 与目标分支的创建基点一致，patch apply **永远不会冲突**。
> 此步骤结束后，目标 worktree 的代码保持原样，主 worktree 工作目录包含目标分支的全量变更。
> 如果 patch apply 失败（兜底场景），`migrateChangesViaPatch` 返回 `{ success: false }`，进入自动 sync 交互流程（见下文 [patch apply 失败后的自动 sync 流程](#patch-apply-失败后的自动-sync-流程)）。

##### patch apply 失败后的自动 sync 流程

当 patch apply 失败时，validate 不再直接退出，而是先通过 `ensureOnMainWorkBranch()` 确保主 worktree 切回主工作分支，然后通过 `handlePatchApplyFailure()` 函数进入交互流程：

1. **询问用户**：提示 `是否立即执行 sync 同步主分支到 <branchName>？`
2. **用户拒绝** → 输出提示 `请手动执行 clawt sync -b <branchName> 同步主分支后重试`，退出
3. **用户确认** → 调用 `executeSyncForBranch(targetWorktreePath, branchName)` 自动执行 sync，sync 的结果（成功/冲突）由 `executeSyncForBranch` 内部输出，`handlePatchApplyFailure` 不做额外判断，validate 流程结束（用户需重新执行 validate）

> `executeSyncForBranch` 为 sync 命令抽取的核心操作函数（见 [5.12](#512-将主分支代码同步到目标-worktree)），供 validate 等命令复用。

**实现要点：**

- `migrateChangesViaPatch()`（`src/utils/validate-core.ts`）返回 `{ success: boolean }`，patch apply 失败时返回 `{ success: false }` 而非抛出异常
- `handleFirstValidate()` 和 `handleIncrementalValidate()` 为 `async` 函数，支持交互式确认
- `handlePatchApplyFailure()`（`src/commands/validate.ts`）为异步函数，负责 patch 失败后的交互逻辑
- 消息常量：`MESSAGES.VALIDATE_CONFIRM_AUTO_SYNC`、`MESSAGES.VALIDATE_AUTO_SYNC_START`、`MESSAGES.VALIDATE_AUTO_SYNC_DECLINED`（`src/constants/messages/validate.ts`）

##### 步骤 5：保存快照为 git tree 对象

将主 worktree 工作目录的全量变更保存为 git tree 对象，同时记录验证分支的 HEAD commit hash：

```bash
git add .
git write-tree  # → 返回 tree hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.tree
git rev-parse HEAD  # → 返回验证分支的 HEAD commit hash，写入 ~/.clawt/validate-snapshots/<project>/<branchName>.head
# 同时写入 ~/.clawt/validate-snapshots/<project>/<branchName>.staged（首次 validate 为空字符串）
git restore --staged .
```

> 此处保存的 HEAD commit hash 是验证分支的 HEAD（即创建时的基点），而非主工作分支的 HEAD。
> 结果：暂存区=空，工作目录=全量变更。

##### 步骤 6：输出成功提示

```
✓ 已切换到验证分支 clawt-validate-feature-scheme-1 并应用分支 feature-scheme-1 的变更
  可以开始验证了
```

##### 步骤 7：执行 `--run` 命令（可选）

如果用户传入了 `-r, --run` 选项，在 validate 成功后自动在主 worktree 中执行指定命令。**如果未传 `-r`，则自动从项目配置的 `validateRunCommand` 字段读取默认命令**（通过 `resolveRunCommand` 解析优先级：`-r` 参数 > 项目配置 > 不执行）。

```bash
# 示例：单命令
clawt validate -b feature-scheme-1 -r "npm test"

# 示例：并行执行多个命令（& 为并行分隔符）
clawt validate -b feature-scheme-1 -r "pnpm test & pnpm build"
```

**执行说明：**

- 命令执行失败（退出码非 0 或进程启动失败）**不影响** validate 本身的结果，仅输出提示信息
- `--clean` 模式下传入 `--run` 会被忽略（只执行 clean 逻辑）

**命令解析规则：**

`-r` 选项支持通过 `&` 将多个命令并行执行。解析由 `parseParallelCommands()`（`src/utils/shell.ts`）负责：

1. 先将命令字符串中的 `&&` 临时替换为占位符，避免被误拆
2. 按单个 `&` 分割为多个独立命令
3. 还原占位符为 `&&`，去除首尾空白，过滤空串

| 输入示例 | 解析结果 | 执行方式 |
| -------- | -------- | -------- |
| `"npm test"` | `["npm test"]` | 单命令，同步执行（`spawnSync` + `inherit`） |
| `"npm lint && npm test"` | `["npm lint && npm test"]` | 单命令（`&&` 不拆分），同步执行 |
| `"npm test & npm build"` | `["npm test", "npm build"]` | 并行执行（`spawn` + `Promise.all`） |
| `"npm lint && npm test & npm build"` | `["npm lint && npm test", "npm build"]` | 并行执行 2 个命令 |

**单命令执行：**

当解析后只有 1 个命令时，通过 `spawnSync` + `inherit` stdio 模式同步执行，输出实时显示在终端。

**并行命令执行：**

当解析后有多个命令时，通过 `runParallelCommands()`（`src/utils/shell.ts`）执行：

- 每个命令通过 Node.js `spawn` 以 shell 模式启动，`stdio: 'inherit'`
- 使用 `Promise.all` 等待全部命令完成
- 完成后汇总输出各命令的执行结果

**向后兼容性：**

- `-r "npm test"` — 单命令，走原有同步路径，行为无变化
- `-r "npm lint && npm test"` — `&&` 不拆分，走原有同步路径，行为无变化
- `-r "npm test & npm build"` — **新行为**：并行执行，等全部完成后汇总

**输出格式：**

```
# 单命令执行成功
正在主 worktree 中执行命令: npm test
────────────────────────────────────────
... 命令的实时输出 ...
────────────────────────────────────────
✓ 命令执行完成: npm test，退出码: 0

# 单命令执行失败（退出码非 0）
正在主 worktree 中执行命令: npm test
────────────────────────────────────────
... 命令的实时输出 ...
────────────────────────────────────────
✗ 命令执行完成: npm test，退出码: 1

# 单命令执行出错（进程启动失败）
正在主 worktree 中执行命令: nonexistent
────────────────────────────────────────
────────────────────────────────────────
✗ 命令执行出错: spawn ENOENT

# 并行命令执行（全部成功）
正在并行执行 2 个命令...
[1/2] pnpm test
[2/2] pnpm build
────────────────────────────────────────
... 各命令的实时输出（交错显示） ...
────────────────────────────────────────
  ✓ pnpm test
  ✓ pnpm build
✓ 全部 2 个命令执行成功

# 并行命令执行（部分失败）
正在并行执行 2 个命令...
[1/2] pnpm test
[2/2] pnpm build
────────────────────────────────────────
... 各命令的实时输出（交错显示） ...
────────────────────────────────────────
  ✗ pnpm test（退出码: 1）
  ✓ pnpm build
共 2 个命令，1 个成功，1 个失败
```

**实现要点：**

- 命令解析：`parseParallelCommands()`（`src/utils/shell.ts`）
- 并行执行：`runParallelCommands()`（`src/utils/shell.ts`），返回 `ParallelCommandResult[]`
- 结果汇总：`reportParallelResults()`（`src/utils/validate-runner.ts`）
- 消息常量：`MESSAGES.VALIDATE_PARALLEL_*` 系列（`src/constants/messages/validate.ts`）
- 命令解析优先级：`resolveRunCommand()`（`src/commands/validate.ts`）负责解析最终要执行的命令，优先使用 `-r` 参数，否则从项目配置读取 `validateRunCommand`（通过 `getValidateRunCommand()`，`src/utils/project-config.ts`）

#### 增量 validate（存在历史快照）

当 `~/.clawt/validate-snapshots/<project>/<branchName>.tree` 存在时，自动进入增量模式：

##### 步骤 1：读取旧快照

在清空主 worktree 之前，读取上次保存的快照 tree hash、当时的 HEAD commit hash 和暂存区 tree hash（`stagedTreeHash`）。

##### 步骤 2：确保主 worktree 干净

如果主 worktree 有残留状态，直接执行 `git reset --hard` + `git clean -fd` 兜底清理（无交互，用户交互已在 `handleValidate` 主函数中通过 `handleDirtyMainWorktree` 完成）。

##### 步骤 3：切换到验证分支

如果当前已在该验证分支上（上次 validate 后未切回），跳过。如果当前在另一个验证分支上（验证了分支 A，现在要验证分支 B），直接切换：

```bash
git checkout clawt-validate-<branchName>
```

##### 步骤 4：从目标分支获取最新全量变更

通过 patch 方式从目标分支获取最新全量变更（流程同首次 validate 的步骤 4）。如果 patch apply 失败，同样进入自动 sync 交互流程（见首次 validate 的 [patch apply 失败后的自动 sync 流程](#patch-apply-失败后的自动-sync-流程)），validate 流程提前结束。

##### 步骤 5：检测是否有新变更

计算当前工作目录变更的 tree hash（`git add . → git write-tree → git restore --staged .`），并与旧快照的 tree hash 及 HEAD commit hash 对比：

```bash
# 计算当前变更的 tree hash
git add .
git write-tree  # → newTreeHash
git restore --staged .

# 获取当前 HEAD
git rev-parse HEAD  # → currentHeadCommitHash

# 判断是否有新变更
hasNewChanges = (newTreeHash !== oldTreeHash) || (oldHeadCommitHash !== currentHeadCommitHash)
```

- **无新变更**（tree hash 和 HEAD 均未变化）→ 不更新快照；如果旧快照记录了 `oldStagedTreeHash`（非空），通过 `git read-tree <oldStagedTreeHash>` 恢复上次 validate 结束时的暂存区状态（恢复失败仅输出 warn 日志，不影响流程）；输出提示后返回
- **有新变更** → 继续步骤 6

> 无变更检测避免了重复 validate 时不必要的快照更新和暂存区重载操作。恢复上次暂存区状态后，用户看到的 `git diff` 结果与上次 validate 结束时完全一致。

##### 步骤 6：将旧变更状态载入暂存区

由于验证分支的 HEAD 不会变化，`oldHeadCommitHash` 与 `currentHeadCommitHash` 始终一致（除非执行了 sync 重建验证分支），因此：

**正常情况（HEAD 未变化）：**

直接通过 `git read-tree` 将旧 tree 对象载入暂存区：

```bash
git read-tree <旧 tree hash>
```

- **读取成功** → 记录 `newStagedTreeHash = oldTreeHash`，结果：暂存区=上次快照，工作目录=最新全量变更（用户可通过 `git diff` 查看增量差异）
- **读取失败**（tree 对象可能被 git gc 回收）→ 降级为全量模式，写入快照（`stagedTreeHash` 为空）后返回，暂存区保持为空，等同于首次 validate 的结果

> 这是最常见的路径。相比重构前，正常情况不再需要处理 HEAD 变化的复杂逻辑，代码路径更简单、更可靠。

**sync 后（HEAD 变化，验证分支已重建）：**

此时旧 tree 对象基于旧 HEAD，直接 read-tree 会导致 diff 混入 HEAD 变化的内容。需要将旧变更 patch（旧 tree 相对于旧 HEAD 的差异）重放到当前 HEAD 暂存区上：

```bash
# 获取旧 HEAD 对应的 tree hash
git rev-parse <旧 HEAD commit hash>^{tree}  # → 旧 HEAD tree hash

# 提取旧变更 patch（旧 HEAD tree → 旧快照 tree 的差异）
git diff-tree -p --binary <旧 HEAD tree hash> <旧快照 tree hash>

# 检测 patch 能否无冲突地应用到暂存区
git apply --cached --check < patch

# 无冲突：apply --cached 到当前 HEAD 暂存区
git apply --cached < patch

# 记录暂存区的 tree hash
git write-tree  # → newStagedTreeHash
```

- **patch 为空**（旧变更为空）→ 暂存区保持干净
- **无冲突** → apply --cached 到当前 HEAD 暂存区，通过 `git write-tree` 记录 `newStagedTreeHash`，结果与正常情况一致
- **有冲突** → 降级为全量模式（暂存区保持为空），写入快照（`stagedTreeHash` 为空）后返回

##### 步骤 7：写入新快照

将步骤 5 计算的 `newTreeHash`、当前 HEAD commit hash 和步骤 6 记录的 `newStagedTreeHash` 写入快照文件，供下次 validate 使用：

```bash
# 写入 ~/.clawt/validate-snapshots/<project>/<branchName>.tree
echo <newTreeHash>

# 写入 ~/.clawt/validate-snapshots/<project>/<branchName>.head
echo <currentHeadCommitHash>

# 写入 ~/.clawt/validate-snapshots/<project>/<branchName>.staged
echo <newStagedTreeHash>
```

> `stagedTreeHash` 记录了 validate 结束时暂存区的完整状态。下次 validate 如果检测到无新变更，可直接通过此值恢复暂存区，避免重复执行 read-tree 或 apply --cached 流程。

##### 步骤 8：输出成功提示

```
# 增量模式成功
✓ 已将分支 feature-scheme-1 的最新变更应用到主 worktree（增量模式）
  暂存区 = 上次快照，工作目录 = 最新变更

# 增量无变更
分支 feature-scheme-1 自上次 validate 以来没有新的变更，已恢复到上次验证状态
✓ 已切换到验证分支 clawt-validate-feature-scheme-1 并应用分支 feature-scheme-1 的变更
  可以开始验证了

# 增量降级为全量
增量对比失败，已降级为全量模式
✓ 已切换到验证分支 clawt-validate-feature-scheme-1 并应用分支 feature-scheme-1 的变更
  可以开始验证了
```

##### 步骤 9：执行 `--run` 命令（可选）

与首次 validate 的步骤 7 相同，增量 validate 成功后也会执行 `-r, --run` 指定的命令（或从项目配置 `validateRunCommand` 读取的默认命令）。

---
