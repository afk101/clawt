### 5.1 批量创建 Worktree（Worktree 对应分支）

**命令：**

```bash
clawt create -b <branchName> [-n <count>]
```

**参数：**

| 参数 | 必填 | 说明                                                  |
| ---- | ---- | ----------------------------------------------------- |
| `-b` | 是   | 分支名                                                |
| `-n` | 否   | 需要创建的 worktree 数量，默认 `1`                      |

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. **主工作分支检测**：在创建 worktree 之前，检测当前 HEAD 所在分支是否为配置的主工作分支（`clawtMainWorkBranch`）。
   - 读取项目级配置（如果配置不存在，由前置校验拦截，见 [第 6 章规则 2](#6-验证架构规则)）
   - 如果当前分支**是** `clawtMainWorkBranch`，正常继续
   - 如果当前在**验证分支**（`clawt-validate-` 前缀）上：
     - 验证分支上的修改视为可丢弃的临时状态
     - 如果工作区有未提交更改，自动执行 `git reset --hard HEAD && git clean -fd` 清理
     - 然后自动切换到主工作分支，继续创建流程
   - 如果当前在**其他普通分支**上：
     - 如果全局配置 `warnBranchOnCreate` 为 `false`，跳过分支切换提醒
     - 否则，黄色提醒并交互确认：
       ```
       ⚠ 当前不在主工作分支上，即将切换到主工作分支 main 来创建新的 worktree

       ❯ yes (确认切换并创建)
         no  (取消)
       ```
     - 用户选择 no → 退出
     - 用户选择 yes 或 `warnBranchOnCreate` 为 `false` → 继续下一步
   - 切换前**检测工作区脏状态**：如果当前分支有未提交的更改，提供交互式选择（避免将修改意外带到主工作分支上）：
     ```
     ⚠ 当前分支有未提交的更改，请选择处理方式：

     ❯ reset (推荐) - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)
       stash        - 暂存更改 (git add . && git stash push -m "clawt:auto-stash")
       exit         - 退出，手动处理
     ```
     - 选择 reset → 执行 `git reset --hard HEAD && git clean -fd`
     - 选择 stash → 执行 `git add . && git stash push -m "clawt:auto-stash"`
     - 选择 exit → 抛出错误退出
     - 处理完成后再次校验工作区是否干净，不干净则报错退出
   - 执行 `git checkout <clawtMainWorkBranch>`，然后继续创建流程
4. **分支名合法性校验与转换** (2.3)
5. **分支名存在性校验** (2.4)
   - 若 `n = 1`：校验 `branchName`
   - 若 `n > 1`：校验 `branchName-1` 到 `branchName-n`
   - 所有分支名在创建任何 worktree **之前**完成全部校验
6. **批量创建 worktree + 验证分支**
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
7. **输出创建日志**

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

---
