### 5.12 将主分支代码同步到目标 Worktree

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt sync -b <branchName>

# 不指定分支名（列出所有分支供选择）
clawt sync
```

**参数：**

| 参数 | 必填 | 说明                                                                     |
| ---- | ---- | ------------------------------------------------------------------------ |
| `-b` | 否   | 要同步的分支名（支持模糊匹配，不传则列出所有分支供选择）                   |

**使用场景：**

当目标 worktree 的分支需要使用主分支的最新代码继续工作时，通过 `clawt sync` 将主分支最新代码合并到目标 worktree。在新架构下，sync 不再是为了解决 validate 冲突（因为不会冲突了），而是纯粹的「将主分支最新代码同步到目标 worktree」的操作。

**运行流程：**

1. **统一前置校验**：调用 `runPreChecks(PRE_CHECK_SYNC)` 执行以下校验：
   - `requireMainWorktree`：校验当前目录是否在主 worktree 根目录
   - `requireHead`：校验 HEAD 是否存在（仓库至少有一次 commit）
   - `requireProjectConfig`：校验项目配置文件是否存在且合法（存在 `clawtMainWorkBranch` 配置）
   - `ensureOnClawtMainWorkBranch`：确保当前处于主工作分支上，不在则自动切换。sync 命令需要从主分支发起合并操作，因此必须保证当前分支状态正确
2. **解析目标 worktree**：根据 `-b` 参数解析目标 worktree，匹配策略如下：
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
3. 调用 `executeSyncForBranch(targetWorktreePath, branch)` 执行核心同步逻辑

#### `executeSyncForBranch` — sync 核心操作函数

`executeSyncForBranch(targetWorktreePath: string, branch: string): Promise<SyncResult>` 是从 `handleSync` 中抽取的核心同步逻辑（async 函数），不包含 worktree 解析交互，供 validate 等命令复用。

**接口定义：**

```typescript
/** sync 核心操作的执行结果 */
export interface SyncResult {
  /** 是否同步成功 */
  success: boolean;
  /** 是否存在合并冲突 */
  hasConflict: boolean;
}
```

**执行流程：**

1. **获取主 worktree 路径和主分支名**：通过 `getGitTopLevel()` 获取主 worktree 路径（后续传给 `rebuildValidateBranch`），通过项目级配置 `clawtMainWorkBranch` 获取主工作分支名（不再通过 `getCurrentBranch` 动态获取，因为在新架构下主 worktree 可能处于验证分支上）
2. **自动保存未提交变更**：检查目标 worktree 是否有未提交修改
   - 有修改 → 自动执行 `git add . && git commit -m "<message>"` 保存变更（commit message 由 `buildAutoSaveCommitMessage(mainBranch, branch)` 函数动态生成，格式为 `clawt: auto-save before merging {mainBranch} into {branch}`，前缀部分由常量 `AUTO_SAVE_COMMIT_MESSAGE_PREFIX` 定义，值为 `clawt: auto-save before merging`，同时用于 merge 命令的 squash 检测）
   - 无修改 → 跳过
3. **在目标 worktree 中合并主分支**：
   ```bash
   cd ~/.clawt/worktrees/<project>/<branchName>
   git merge <mainBranch>
   ```
4. **冲突处理**：
   - **有冲突** → 输出警告，提示用户进入目标 worktree 手动解决：
     ```
     合并存在冲突，请进入目标 worktree 手动解决：
       cd ~/.clawt/worktrees/<project>/<branchName>
       解决冲突后执行 git add . && git merge --continue
       clawt validate -b <branch> 验证变更
     ```
   - 返回 `{ success: false, hasConflict: true }`
   - **无冲突** → 继续
5. **输出合并成功提示**：`✓ 已将 <mainBranch> 的最新代码同步到 <branchName>`
6. **重建验证分支**（`rebuildValidateBranch`，async 函数）：sync 将主分支合并到目标 worktree 后，目标分支的代码基点发生变化。为保持验证分支与目标分支基点一致，需要重建验证分支。
   - 确保在主工作分支上创建验证分支，处理三种情况：
     - **已在主工作分支上** → 直接重建
     - **在验证分支上** → 验证分支修改可丢弃，清理工作区后自动切回主工作分支
     - **在其他普通分支上** → 检查工作区是否干净，干净则直接切回主工作分支；不干净则交互处理（`handleDirtyWorkingDir`：reset / stash / exit）后切回
   ```bash
   # 情况 1：已在主工作分支上，无需切换

   # 情况 2：在验证分支上，先清理工作区再切回主分支
   git reset --hard
   git clean -fd
   git checkout <clawtMainWorkBranch>

   # 情况 3：在其他分支上
   # 如果工作区不干净，交互式处理（reset/stash/exit）
   # 然后切回主工作分支
   git checkout <clawtMainWorkBranch>

   # 删除旧验证分支
   git branch -D clawt-validate-<branchName>

   # 基于当前主分支 HEAD 重新创建验证分支
   git branch clawt-validate-<branchName>
   ```
7. **输出验证分支重建提示并返回结果**：输出 `验证分支 clawt-validate-<branchName> 已重建`，返回 `{ success: true, hasConflict: false }`

**设计说明 — 保留 validate 快照**：sync 合并成功后，不清除该分支的 validate 快照。因为 validate 使用三点 diff（`main...feature`），sync 后 merge-base 更新为合并提交，三点 diff 仍然只包含 feature 分支自身的修改，旧快照依然有效。增量 validate 时若检测到 HEAD 变化，会自动通过 diff-tree + apply 路径正确恢复暂存区状态。
示意图：
  场景：将 HEAD(master) 合并到 branchName

  执行 git checkout branchName && git merge master 后：

        A -- B -- C  (HEAD/master)
       /            \
      *              M  (branchName, merge commit)
       \            /
        D -- E ----

  此时执行 git diff HEAD...branchName：

  - merge-base 变成了 C（因为合并后，HEAD 和 branchName 的最近共同祖先就是 C）

#### validate 中自动 sync 的联动

当 validate 的 patch apply 失败（兜底场景）并触发自动 sync 时，sync 内部会自动重建验证分支，validate 流程结束后用户重新执行 validate 即可。

---
