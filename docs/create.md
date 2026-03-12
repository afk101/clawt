### 5.1 批量创建 Worktree（Worktree 对应分支）

**命令：**

```bash
clawt create -b <branchName> [-n <count>] [--no-post-create]
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b, --branch` | 是   | 分支名                                                |
| `-n, --number` | 否   | 需要创建的 worktree 数量，默认 `1`                      |
| `--post-create` | 否   | 执行 postCreate hook（默认开启，`--no-post-create` 跳过）。详见 [post-create-hook.md](./post-create-hook.md) |

**运行流程：**

通过 `runPreChecks(PRE_CHECK_CREATE)` 执行统一前置校验，包含以下检查项：

1. **主 worktree 校验**（`requireMainWorktree`）(2.1)
2. **HEAD 存在性校验**（`requireHead`）：确保仓库有至少一次 commit
3. **确保在主工作分支上**（`ensureOnClawtMainWorkBranch`）：在创建 worktree 之前，确保当前处于配置的主工作分支（`clawtMainWorkBranch`）上。
   - 如果当前分支**是** `clawtMainWorkBranch`，正常继续
   - 如果当前在**验证分支**（`clawt-validate-` 前缀）上：
     - 验证分支上的修改视为可丢弃的临时状态
     - 如果工作区有未提交更改，自动执行 `git reset --hard HEAD && git clean -fd` 清理；若已干净则跳过清理
     - 然后自动切换到主工作分支，继续创建流程
   - 如果当前在**其他普通分支**上：
     - 首先显示警告：`当前分支 <currentBranch> 与配置的主工作分支 <mainBranch> 不一致，如需更新请执行 clawt init`
     - 然后通过 `confirmAction('是否继续执行？')` 让用户确认是否继续；用户拒绝则抛出"已取消操作"退出
     - 用户确认后，如果工作区有未提交的更改，提供交互式选择（避免将修改意外带到主工作分支上）：
       ```
       ⚠ 当前分支有未提交的更改，请选择处理方式：

       ❯ reset        - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)
         stash        - 暂存更改 (git add . && git stash)
         exit         - 退出，手动处理
       ```
       - 选择 reset → 执行 `git reset --hard HEAD && git clean -fd`
       - 选择 stash → 执行 `git add . && git stash push -m "clawt:auto-stash"`
       - 选择 exit → 抛出错误"用户选择退出，请手动处理工作区更改后重试"
       - 处理完成后再次校验工作区是否干净，不干净则报错"工作区仍然不干净，请手动处理"
     - 执行 `git checkout <clawtMainWorkBranch>`，然后继续创建流程
4. **主分支工作区干净校验**（`requireCleanWorkingDir`）：确保主工作分支的工作区和暂存区干净，存在未提交更改时报错"主 worktree 有未提交的更改，请先处理"
5. **创建数量校验**：校验 `-n` 参数必须为正整数，否则报错 `无效的创建数量: "<value>"，请输入正整数`
6. **分支名合法性校验与转换** (2.3)
7. **分支名存在性校验** (2.4)
   - 若 `n = 1`：校验 `branchName`
   - 若 `n > 1`：校验 `branchName-1` 到 `branchName-n`
   - 所有分支名在创建任何 worktree **之前**完成全部校验
8. **批量创建 worktree + 验证分支**
   - 若 `n = 1`：
     ```bash
     git worktree add -b <branchName> ~/.clawt/worktrees/<project>/<branchName>
     git branch clawt-validate-<branchName>
     ```
   - 若 `n > 1`：
     ```bash
     git worktree add -b <branchName>-1 ~/.clawt/worktrees/<project>/<branchName>-1
     git branch clawt-validate-<branchName>-1
     git worktree add -b <branchName>-2 ~/.clawt/worktrees/<project>/<branchName>-2
     git branch clawt-validate-<branchName>-2
     ...
     git worktree add -b <branchName>-n ~/.clawt/worktrees/<project>/<branchName>-n
     git branch clawt-validate-<branchName>-n
     ```
9. **执行 postCreate hook**：调用 `runPostCreateHooks(worktrees, !options.postCreate)` 以 fire-and-forget 模式后台异步并行执行 postCreate hook（用户自定义的初始化操作）。`--no-post-create` 时跳过。详见 [post-create-hook.md](./post-create-hook.md)
10. **输出创建日志**

**输出格式：**

```
✓ 已创建 3 个 worktree

目录路径1：
  ~/.clawt/worktrees/main-project/feature-scheme-1
  分支名: feature-scheme-1
  验证分支: clawt-validate-feature-scheme-1
────────────────────────────────────────
目录路径2：
  ~/.clawt/worktrees/main-project/feature-scheme-2
  分支名: feature-scheme-2
  验证分支: clawt-validate-feature-scheme-2
────────────────────────────────────────
目录路径3：
  ~/.clawt/worktrees/main-project/feature-scheme-3
  分支名: feature-scheme-3
  验证分支: clawt-validate-feature-scheme-3
────────────────────────────────────────
```

**实现要点：**

- 前置校验配置定义在 `src/constants/pre-checks.ts` 的 `PRE_CHECK_CREATE` 常量中
- 分支名清理逻辑在 `src/utils/branch.ts` 的 `sanitizeBranchName` 中
- 分支名生成逻辑在 `src/utils/branch.ts` 的 `generateBranchNames` 中
- worktree 批量创建逻辑在 `src/utils/worktree.ts` 的 `createWorktrees` 中
- 确保在主工作分支的逻辑在 `src/utils/validate-branch.ts` 的 `ensureOnMainWorkBranch` 中
- 脏工作区交互处理逻辑在 `src/utils/validate-branch.ts` 的 `handleDirtyWorkingDir` 中
- 相关消息常量定义在 `src/constants/messages/create.ts` 和 `src/constants/messages/common.ts` 中
- postCreate hook 执行逻辑在 `src/hooks/post-create.ts` 中，通过 `src/utils/index.js` 统一导出 `runPostCreateHooks`
- hook 相关消息常量定义在 `src/constants/messages/post-create.ts` 中

---
