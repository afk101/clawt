### 5.5 移除 Worktree

**命令：**

```bash
# 移除当前项目所有 worktree
clawt remove --all

# 指定分支名（支持模糊匹配）
clawt remove -b <branchName>

# 不指定参数（列出所有分支供多选）
clawt remove
```

**参数：**

| 参数      | 必填 | 说明                                                                   |
| --------- | ---- | ---------------------------------------------------------------------- |
| `--all`   | 否   | 移除当前项目 (`~/.clawt/worktrees/<project>/`) 下所有 worktree           |
| `-b`      | 否   | 指定分支名（支持模糊匹配，不传则列出所有分支供多选）                       |

> **提示：** 不传 `--all` 也不传 `-b` 时，会列出当前项目所有 worktree 供交互式多选。

**运行流程：**

1. **主 worktree 校验** (2.1)
2. **获取项目名** (2.2)
3. **确定待移除的 worktree 列表**：
   - **指定 `--all`** → 选中当前项目所有 worktree（若当前项目无 worktree，则提示并退出）
   - **未指定 `--all`** → 通过 `resolveTargetWorktrees` 解析目标 worktree（多选版本），匹配策略如下：
     - **未传 `-b` 参数**：
       - 无可用 worktree → 报错退出
       - 仅 1 个 worktree → 直接使用，无需选择
       - 多个 worktree → 通过交互式多选列表（Enquirer.MultiSelect）让用户选择（空格选择，回车确认）
     - **传了 `-b` 参数**：
       1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
       2. **模糊匹配**（子串匹配，大小写不敏感）：
          - 唯一匹配 → 直接使用
          - 多个匹配 → 通过交互式多选列表让用户从匹配结果中选择
       3. **无匹配** → 报错退出，并列出所有可用分支名
4. 列出即将移除的 worktree 及对应分支：

```
即将移除以下 worktree 及本地分支：

  1. ~/.clawt/worktrees/main-project/feature-scheme-1  →  分支: feature-scheme-1  验证分支: clawt-validate-feature-scheme-1
  2. ~/.clawt/worktrees/main-project/feature-scheme-2  →  分支: feature-scheme-2  验证分支: clawt-validate-feature-scheme-2
  3. ~/.clawt/worktrees/main-project/feature-scheme-3  →  分支: feature-scheme-3  验证分支: clawt-validate-feature-scheme-3

是否同时删除对应的本地分支和验证分支？(y/N)
```

5. 用户确认后（只需确认一次），对每个 worktree 依次执行（单个失败不影响其他）：

```bash
# 确保当前处于主工作分支上（若不在则自动切回）
git checkout <clawtMainWorkBranch>

# 移除 worktree
git worktree remove -f <worktree路径>

# 如果用户选择了删除分支
git branch -D <branchName>

# 无条件删除验证分支和清理快照（不受用户确认控制）
git branch -D clawt-validate-<branchName>
# 清理该分支对应的 validate 快照
```

6. 如果配置文件 `~/.clawt/config.json` 中 `autoDeleteBranch` 为 `true`，则跳过询问，直接删除分支。

7. 如果使用 `--all` 模式，额外清理整个项目的 validate 快照目录。

8. 移除完成后，清理空目录（如果 `~/.clawt/worktrees/<project>/` 下已无 worktree，则删除该项目目录）。

9. 批量移除时，单个 worktree 移除失败不会中断整个流程，而是收集所有失败项，最后汇总报告并以错误状态退出（抛出 ClawtError）。

---
