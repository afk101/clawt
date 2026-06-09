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

1. **前置校验**：
   - 主 worktree 校验 (2.1)
   - HEAD 存在性校验
   - 项目配置文件校验（确保项目已通过 `clawt init` 初始化）
2. **获取项目名** (2.2)
3. **确定待移除的 worktree 列表**：
   - **指定 `--all`** → 选中当前项目所有 worktree（若当前项目无 worktree，则提示并退出）
   - **未指定 `--all`** → 通过 `resolveTargetWorktrees` 解析目标 worktree（多选版本），匹配策略如下：
     - **未传 `-b` 参数**：
       - 无可用 worktree → 报错退出
       - 仅 1 个 worktree → 直接使用，无需选择
       - 多个 worktree → 通过 `promptGroupedMultiSelectBranches` 展示**按日期分组的交互式多选列表**（详见 [resume.md](./resume.md) 中的「按日期分组多选」章节），支持三级联动选择（全局全选 → 组全选 → 单分支）
     - **传了 `-b` 参数**：
       1. **精确匹配优先**：在 worktree 列表中查找分支名完全相同的 worktree，找到则直接使用
       2. **模糊匹配**（子串匹配，大小写不敏感）：
          - 唯一匹配 → 直接使用
          - 多个匹配 → 通过按日期分组的交互式多选列表让用户从匹配结果中选择
       3. **无匹配** → 报错退出，并列出所有可用分支名
4. **当前分支安全检查**：逐个检查待移除的分支，如果该分支或其对应的验证分支（`clawt-validate-<branchName>`）是主 worktree 当前所在分支，则抛出错误并阻止移除。
5. 列出即将移除的 worktree 及对应分支：

```
即将移除以下 worktree 及本地分支：

  1. ~/.clawt/worktrees/main-project/feature-scheme-1  →  分支: feature-scheme-1  验证分支: clawt-validate-feature-scheme-1
  2. ~/.clawt/worktrees/main-project/feature-scheme-2  →  分支: feature-scheme-2  验证分支: clawt-validate-feature-scheme-2
  3. ~/.clawt/worktrees/main-project/feature-scheme-3  →  分支: feature-scheme-3  验证分支: clawt-validate-feature-scheme-3

是否同时删除对应的本地分支和验证分支？(y/N)
```

6. **判断是否删除本地分支**：
   - 如果配置文件 `~/.clawt/config.json` 中 `autoDeleteBranch` 为 `true`，则跳过询问，直接删除分支
   - 否则询问用户是否删除，用户拒绝时提示可稍后手动删除
7. 对每个 worktree 依次执行（单个失败不影响其他）：

```bash
# 移除 worktree
git worktree remove -f <worktree路径>

# 如果用户选择了删除分支（或 autoDeleteBranch 为 true）
git branch -D <branchName>

# 无条件删除验证分支（不受用户确认控制，存在则删除）
git branch -D clawt-validate-<branchName>
# 无条件清理该分支对应的 validate 快照
# 无条件清理该分支的元数据文件（~/.clawt/projects/<projectName>/worktrees/<branchName>.json）
```

8. 如果使用 `--all` 模式，额外清理整个项目的 validate 快照目录。

9. 移除完成后执行清理：
   - `git worktree prune` 清理已失效的 worktree 引用
   - 如果 `~/.clawt/worktrees/<project>/` 下已无 worktree，则删除该项目目录

10. 批量移除时，单个 worktree 移除失败不会中断整个流程，而是收集所有失败项，最后汇总报告并以错误状态退出（抛出 ClawtError）。

**实现要点：**

- 消息常量定义在 `src/constants/messages/remove.ts`
- 分支解析逻辑复用公共模块 `resolveTargetWorktrees`（`src/utils/worktree-matcher.ts`）
- 验证分支删除通过 `deleteValidateBranch`（`src/utils/validate-branch.ts`），内部判断分支是否存在后才执行删除
- 快照清理通过 `removeSnapshot` 和 `removeProjectSnapshots`（`src/utils/validate-snapshot.ts`）
- 元数据清理通过 `removeWorktreeMetadata`（`src/utils/worktree-metadata.ts`），删除 `~/.clawt/projects/<projectName>/worktrees/<branchName>.json`，失败时仅记录日志不抛异常（best-effort 语义）

---
