### 5.21 将验证分支修改覆盖回目标 Worktree

**命令：**

```bash
clawt cover
```

> 无需指定分支名，自动从当前验证分支名（`clawt-validate-<branchName>`）中推导目标分支。

**参数：**

无额外参数。必须在验证分支上执行。

**使用场景：**

在 `validate` 验证过程中，用户可能会在主 worktree（验证分支上）对代码进行修改（如修复测试失败、调整逻辑等）。`cover` 命令用于将这些修改覆盖回目标 worktree，使目标 worktree 的代码与验证分支上的最新状态同步。

**运行流程：**

##### 步骤 1：前置校验

1. **主 worktree 校验**（`requireMainWorktree`）
2. **HEAD 校验**（`requireHead`）
3. **项目级配置校验**（`requireProjectConfig`）
4. **验证分支校验**：当前分支必须以 `clawt-validate-` 开头，否则报错退出

##### 步骤 2：查找目标 worktree

从验证分支名中提取目标分支名（去掉 `clawt-validate-` 前缀），然后在项目的 worktree 列表中精确匹配目标分支对应的 worktree。如果目标 worktree 不存在（可能已被移除），报错退出。

##### 步骤 3：校验快照存在并读取

校验目标分支的 validate 快照是否存在。如果快照不存在，提示用户先执行 `clawt validate -b <branch>` 创建快照。读取快照中的 tree hash（`snapshotTreeHash`），作为增量计算的基准。

##### 步骤 3.5：工作区干净检查

检测主 worktree（验证分支上）的工作区和暂存区是否干净（`isWorkingDirClean`）：

- **不干净**（有修改）→ 正常继续，这是 cover 的典型使用场景
- **干净**（无修改）→ 输出提示信息 `当前验证分支的工作区和暂存区没有任何修改，可能为误操作`，并通过 `confirmAction` 询问用户 `是否继续执行覆盖？`：
  - 用户确认 → 继续执行
  - 用户取消 → 直接返回，不执行后续步骤

> 工作区干净时通常意味着用户没有在验证分支上做任何修改就执行了 cover，这大概率是误操作。增加确认提示可以避免不必要的覆盖操作。

##### 步骤 4：计算当前 tree hash

通过 `computeWorktreeTreeHash()` 计算验证分支当前的完整 tree hash：

1. 保存当前暂存区的 tree hash，用于后续恢复
2. `git add .` + `git write-tree` 获取当前工作区的完整 tree hash
3. 通过 `git read-tree` 恢复原始暂存区状态

比较 snapshotTreeHash 与 currentTreeHash，如果相同则无变更，输出提示后返回。

##### 步骤 5：直接覆盖目标 worktree

采用 **直接 checkout tree** 方式，实现真正的覆盖语义：

1. **写入暂存区**：通过 `git read-tree <currentTreeHash>` 将验证分支的完整 tree 写入目标 worktree 的暂存区
2. **强制检出工作区**：通过 `git checkout-index -f -a` 将暂存区内容强制写入工作区
3. **清理残留文件**：通过 `git clean -fd` 删除目标 worktree 中未跟踪文件

> **关键优势**：无基准依赖，无条件覆盖目标 worktree，符合 cover 的语义。

##### 步骤 6：更新快照

将 `currentTreeHash` 写入快照的 `.tree` 文件，使后续再次 cover 时的基准正确。**只更新 `treeHash`，不更新 `headCommitHash` 和 `stagedTreeHash`**（保留 validate 时写入的原值）。

##### 步骤 7：输出成功提示

```
✓ 已将验证分支上的修改覆盖到 worktree => <branchName>
```

**错误消息：**

| 消息常量 | 触发条件 | 提示内容 |
| -------- | -------- | -------- |
| `COVER_VALIDATE_NOT_ON_VALIDATE_BRANCH` | 当前分支不是验证分支 | 提示先通过 `clawt validate` 切换到验证分支 |
| `COVER_VALIDATE_TARGET_NOT_FOUND` | 目标 worktree 不存在 | 提示确认该 worktree 尚未被移除 |
| `COVER_VALIDATE_NO_SNAPSHOT` | 无快照 | 提示先执行 `clawt validate -b <branch>` 创建快照 |
| `COVER_VALIDATE_NO_CHANGES` | 无增量变更 | 提示无需覆盖 |
| `COVER_VALIDATE_WORKING_DIR_CLEAN` | 工作区干净 | 提示可能为误操作，需确认是否继续 |
| `COVER_VALIDATE_COVER_FAILED` | tree checkout/clean 失败 | 提示检查目标 worktree 状态后重试 |

**实现要点：**

- 命令注册名为 `cover`（非 `cover-validate`），用户通过 `clawt cover` 调用
- 核心函数：`handleCoverValidate()`（`src/commands/cover-validate.ts`）
- 辅助函数：
  - `extractTargetBranchName()`：从验证分支名提取目标分支名
  - `findTargetWorktreePath()`：查找目标 worktree 路径
  - `computeWorktreeTreeHash()`：计算当前工作区 tree hash（保存并恢复暂存区状态）
- Git 工具函数：
  - `gitReadTree()`：将 tree 写入暂存区
  - `gitCheckoutIndexForce()`：强制检出暂存区到工作区
  - `gitCleanForce()`：清理未跟踪文件
- 消息常量：`COVER_VALIDATE_MESSAGES`（`src/constants/messages/cover-validate.ts`）
- `writeSnapshot` 调用时只传 `treeHash`，利用其可选参数特性保留磁盘上的 `headCommitHash` 和 `stagedTreeHash` 原值

---
