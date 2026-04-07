### 5.6 合并验证过的分支

**命令：**

```bash
# 指定分支名（支持模糊匹配）
clawt merge -b <branchName> [-m <commitMessage>]

# 不指定分支名（列出所有分支供选择）
clawt merge [-m <commitMessage>]
```

**参数：**

| 参数 | 必填 | 说明                                                                     |
| ---- | ---- | ------------------------------------------------------------------------ |
| `-b` | 否   | 要合并的分支名（支持模糊匹配，不传则列出所有分支供选择）                   |
| `-m` | 否   | 提交信息（目标 worktree 工作区有修改时使用；交互模式下未提供会询问输入）     |
| `--auto` | 否   | 遇到冲突直接调用 AI 解决，不再询问                                        |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **HEAD 存在性校验**（`requireHead`）：确保仓库有至少一次 commit
3. **确保在主工作分支上**（`ensureOnClawtMainWorkBranch`）：确保当前处于主工作分支上。如果在验证分支上，清理工作区后切回；如果在其他分支上，检查工作区是否干净，不干净则交互处理（reset/stash/exit），然后切回主工作分支。
4. **解析目标 worktree**：根据 `-b` 参数解析目标 worktree，匹配策略如下：
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
5. **主 worktree 状态检测**
   - 执行 `git status --porcelain`
   - 如果有更改：
     - 如果存在该分支的 validate 快照（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`），额外输出警告 `主 worktree 可能存在 validate 残留状态，可先执行 clawt validate -b <branchName> --clean 清理`
     - 提示 `主 worktree 有未提交的更改，请先处理`，退出
   - 无更改 → 继续
6. **Squash 检测与执行（auto-save 临时提交压缩）**
   - 通过 `git log HEAD..<branchName> --format=%s` 检查目标分支是否存在以 `AUTO_SAVE_COMMIT_MESSAGE_PREFIX`（`clawt: auto-save before merging`）为前缀的 commit
   - **不存在** → 跳过，进入步骤 7
   - **存在** → 提示用户是否将所有提交压缩为一个：
     ```
     检测到 sync 产生的临时提交，是否将所有提交压缩为一个？
       压缩后变更将保留在目标worktree的暂存区，需要重新提交（可使用 Claude Code Cli或其他工具生成提交信息）
     ```
   - **用户选择不压缩** → 跳过，进入步骤 7
   - **用户选择压缩** →
     1. 获取主分支名（从项目级配置 `clawtMainWorkBranch` 获取）
     2. 计算分叉点：`git merge-base <mainBranch> <branchName>`
     3. 在目标 worktree 中执行 `git reset --soft <merge-base>`，将所有 commit 撤销到暂存区
     4. 如果用户提供了 `-m` → 在目标 worktree 执行 `git add . && git commit -m '<commitMessage>'`，输出成功提示，继续步骤 7
     5. 如果用户未提供 `-m`：
        - **交互模式** → 通过 `promptCommitMessage` 交互式询问用户输入提交信息，用户输入后执行 `git add . && git commit`，继续步骤 7
        - **非交互模式** → 提示用户前往目标 worktree 自行提交后重新执行 `clawt merge`，**退出流程**（不执行 `git add`，不改变暂存区）：
          ```
          ✓ 已将所有提交压缩到暂存区
            请在目标 worktree 中提交后重新执行 merge：
            cd <worktreePath>
            提交完成后执行：clawt merge -b <branch>
          ```

   > **最小副作用原则**：`git add .` 延后到确定要提交时才执行，紧邻 `git commit` 之前。非交互模式温和退出时不触发 `git add .`，避免不必要地改变暂存区状态。提交逻辑通过 `commitSquash` 函数统一封装（`git add . → git commit → 输出成功提示`），确保单一职责。
7. **根据目标 worktree 状态决定是否需要提交**
   - 检测目标 worktree 工作区是否干净（`git status --porcelain`）
   - **工作区有未提交修改**：
     - 提供了 `-m` → 执行提交：
       ```bash
       cd ~/.clawt/worktrees/<project>/<branchName>
       git add .
       git commit -m '<commitMessage>'
       ```
     - 未提供 `-m`：
       - **交互模式** → 通过 `promptCommitMessage` 交互式询问用户输入提交信息，输入后执行 `git add . && git commit`
       - **非交互模式** → 提示 `<worktreePath> 有未提交的修改，请通过 -m 参数提供提交信息`，退出
   - **工作区干净**：
     - 检查目标分支相对于主分支是否有本地提交（`git log HEAD..<branchName> --oneline`）
     - 有本地提交 → 跳过提交步骤，直接进入合并
     - 无本地提交 → 提示 `目标 worktree 没有任何可合并的变更（工作区干净且无本地提交）`，退出
8. **回到主 worktree 进行合并**
   ```bash
   cd <主 worktree 路径>
   git merge <branchName>
   ```
9. **冲突检测**（双层机制）
   - **try-catch 层**：`git merge` 抛出异常时，先检查是否有冲突，有冲突则标记冲突状态，否则重新抛出原始异常
   - **二次确认层**：即使 merge 未抛异常，也再次检查是否有合并冲突
   - **有冲突** → 进入 AI 辅助冲突解决流程（见下文），解决失败则退出
   - **无冲突** → 继续

9.5. **AI 辅助冲突解决**

   当检测到合并冲突时，通过 `handleMergeConflict()` 函数处理。冲突解决行为由全局配置项 `conflictResolveMode` 和 `--auto` 选项共同控制：

   | `conflictResolveMode` | `--auto` | 行为 |
   | --- | --- | --- |
   | `ask`（默认） | 否 | 询问用户是否使用 AI 解决冲突 |
   | `ask` | 是 | 直接调用 AI 解决，不询问 |
   | `auto` | — | 直接调用 AI 解决，不询问 |
   | `manual` | — | 输出冲突提示信息，用户手动解决 |

   AI 解决冲突时，调用 Claude Code CLI 在主 worktree 中分析并解决冲突文件，超时时间由配置项 `conflictResolveTimeoutMs` 控制（默认 15 分钟）。冲突解决子进程通过 `getEnvWithoutNestedSessionFlag()` 启动，会自动注入环境变量 `CLAUDE_CODE_ENTRYPOINT="cli"` 使会话支持 `--continue` 恢复。AI 解决成功后自动执行 `git add . && git merge --continue` 完成合并。
10. **推送（受 `autoPullPush` 配置控制）**
   - `autoPullPush` 为 `false` → 输出提示 `已跳过自动 pull/push，请手动执行 git pull && git push`
   - `autoPullPush` 为 `true` → 执行 `git pull` + `git push`：
     - `git pull` 失败且有冲突 → 输出警告 `自动 pull 时发生冲突，merge 已完成但远程同步失败`，退出（不再 push）
     - `git pull` 失败且无冲突 → 抛出错误
     - `git push` 失败 → 输出警告 `自动 push 失败，merge 和 pull 已完成\n  请手动执行 git push`，退出
11. **输出成功提示**

```
# 提供了 -m 且已推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
  提交信息: <commitMessage>
  已推送到远程仓库

# 提供了 -m 但未推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
  提交信息: <commitMessage>

# 未提供 -m 且已推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
  已推送到远程仓库

# 未提供 -m 且未推送时
✓ 分支 feature-scheme-1 已成功合并到当前分支
```

12. **merge 成功后确认并清理 worktree 和分支（可选）**
   - 如果配置文件中 `autoDeleteBranch` 为 `true`，自动执行清理
   - 否则交互式询问用户是否清理
   - 用户确认后，依次执行：
     ```bash
     # 移除 worktree
     git worktree remove -f <worktree路径>
     # 删除本地分支
     git branch -D <branchName>
     # 同步删除验证分支
     git branch -D clawt-validate-<branchName>
     # 修剪 worktree 引用
     git worktree prune
     # 如果项目 worktree 目录为空，则清理空目录
     ```
   - 输出清理成功提示：`✓ 已清理 worktree 和分支: <branchName>`
   - 验证分支的删除时机与目标分支保持一致（见 [2.5 验证分支生命周期](#25-验证分支)）：用户确认清理 → 同步删除验证分支；用户拒绝清理 → 验证分支也保留

13. **清理 validate 快照**
    - merge 成功后，如果存在该分支的 validate 快照（`~/.clawt/validate-snapshots/<project>/<branchName>.tree`、`<branchName>.head` 和 `<branchName>.staged`），自动删除这些快照文件（merge 成功后快照已无意义）

> **注意：** 清理确认和清理操作均在 merge 成功后执行。只有 merge 成功才会询问用户是否清理 worktree 和分支，避免 merge 冲突时用户被提前询问造成困惑。

---
