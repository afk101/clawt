# sync 后 validate 仍然失败 — 调查记录

**日期：** 2026-06-01

---

## 现象描述

用户在交互式面板（`clawt status`）中对目标分支执行 validate，patch apply 失败，提示：

```
⚠ Change migration failed: target branch has diverged too far from main
  Please run clawt sync -b <target-branch> first, then retry
```

用户选择自动 sync（或手动执行 `clawt sync -b <target-branch>`），sync 成功：

```
✓ Synced latest code from <main-branch> to <target-branch>
Validation branch clawt-validate-<target-branch> has been rebuilt
```

但再次执行 validate 时，仍然报同样的错误。

---

## 调查过程

### 第一步：确认分支状态

- 主工作分支：HEAD 指向最新 commit
- 验证分支：与主分支 HEAD 一致（sync 后已重建）
- 目标分支：包含多次 merge commit，已合并主分支最新代码

**结论：** sync 已成功，验证分支已正确重建，分支状态本身没有问题。

### 第二步：模拟 patch apply

执行三点 diff 并尝试 apply：

```bash
git diff clawt-validate-<target-branch>...<target-branch> --binary | git apply --check -
```

输出：

```
错误：<ignored-dir>/findings/some-findings.md：已经存在于工作区中
错误：<ignored-dir>/plans/some-plan.md：已经存在于工作区中
...（共 N 个文件）
```

**关键发现：** patch 失败的原因不是分支差异过大，而是目标分支中跟踪的某些文件在主 worktree 工作目录中已经物理存在。

### 第三步：追溯文件来源

检查主 worktree 工作目录：

```bash
ls <ignored-dir>/findings/
# some-findings.md  ← 物理存在
# ...（共多个文件）
```

检查 `git status`：

```
无文件要提交，干净的工作区
```

**为什么这些文件物理存在但 git status 不显示？**

检查 `.gitignore`：

```bash
cat .gitignore | grep <ignored-dir>
# <ignored-dir>/   ← 被忽略！
```

**结论：** 该目录在主分支的 `.gitignore` 中，这些文件是**被忽略的未跟踪文件**，`git status` 不会显示它们。

### 第四步：追溯文件如何进入主 worktree

这些文件是由**之前的 validate 操作**创建的：

1. validate 通过 `git diff HEAD...branch --binary | git apply -` 将目标分支的变更（包括被忽略目录下的文件）应用到主 worktree 工作目录
2. 目标分支跟踪了这些文件（尽管 `.gitignore` 中有该目录，但 AI Agent 在 worktree 中用 `git add -f` 强制添加了它们）
3. validate 完成后，这些文件作为**未跟踪文件**留在主 worktree 工作目录中

### 第五步：追溯为什么清理无效

validate 的清理逻辑（`handleIncrementalValidate` 步骤 2 和 `handleDirtyWorkingDir` 的 reset 选项）使用：

```bash
git reset --hard    # 只影响已跟踪文件
git clean -fd       # 删除未跟踪文件，但**不删除被忽略的文件**
```

`git clean -fd` 的行为：
- 删除未跟踪且未被忽略的文件 ✓
- **跳过**在 `.gitignore` 中的文件 ✗

要删除被忽略的文件，需要 `git clean -fdx`（`-x` 表示包括被忽略的文件）。

### 第六步：确认 sync 为什么不解决问题

`executeSyncForBranch` 的操作：
1. 检查目标 worktree 未提交变更 → 自动 commit
2. 在目标 worktree 中 `git merge <main-branch>`
3. 重建验证分支

**sync 完全不清理主 worktree 的工作目录**，因此那些被忽略的残留文件仍然存在。

---

## 根本原因

**完整因果链：**

```
上游 commit 将某目录加入 .gitignore 并从 git 跟踪中移除
    ↓
目标分支仍然跟踪着自己新增的文件（AI Agent 用 git add -f 强制提交）
    ↓
validate 通过 patch apply 将这些文件创建到主 worktree 工作目录
    ↓
validate 结束后的清理（git clean -fd）无法删除这些文件（因为在 .gitignore 中）
    ↓
文件作为"被忽略的未跟踪文件"永久残留在主 worktree
    ↓
下次 validate 的 patch apply 试图创建同名文件 → "已经存在于工作区中" → 失败
    ↓
auto-sync 不清理主 worktree 工作目录 → 问题持续存在（死循环）
```

**核心矛盾：**

- 被忽略目录在主分支 `.gitignore` 中 → `git clean -fd` 不删除
- 被忽略目录在目标分支被跟踪 → patch 包含这些文件 → apply 时与物理存在的文件冲突

---

## 影响范围

此 bug 在以下条件同时满足时触发：

1. 目标分支跟踪了某些在 `.gitignore` 中的文件（通常是 AI Agent 用 `git add -f` 强制添加）
2. 主分支的 `.gitignore` 包含对应路径
3. 至少执行过一次 validate（使文件通过 patch 进入主 worktree）
4. 后续再次执行 validate（patch apply 因文件已存在而失败）

---

## 技术决策记录

| 假设 | 验证结果 |
|------|----------|
| 分支确实 diverged（差异过大） | ❌ 排除：三点 diff 正常，merge-base 正确 |
| 验证分支未正确重建 | ❌ 排除：验证分支与主分支 HEAD 一致 |
| sync 未成功执行 | ❌ 排除：sync 成功，目标分支已合并主分支 |
| patch 内容与主分支冲突 | ❌ 排除：不是内容冲突，是文件已存在 |
| **被忽略文件残留导致 patch apply 失败** | ✅ 确认：`git apply --check` 明确报 "已经存在于工作区中" |

---

## Brainstorming 决策（2026-06-01）

### 方案评估

| 方案 | 安全性 | 便利性 | 误删风险 | 代码复杂度 |
|------|--------|--------|----------|------------|
| A：检测 + 提示用户手动清理 | 高 | 低 | 无 | 低 |
| B：检测 + 自动清理后继续 | 中 | 高 | 有 | 略高 |

### 最终决策

**选择方案 A（检测 + 提示用户手动清理）**

理由：
1. 这类冲突本质上是项目 `.gitignore` 配置与分支跟踪状态不一致导致的，属于需要用户知情的项目级决策
2. 不应该由工具静默处理，用户需要知道哪些文件被清理了
3. 实现简单，风险为零

### 实现方案

1. 新增 `gitCheckIgnored(paths, cwd)` — 批量检测文件是否被 `.gitignore` 忽略
2. 新增 `detectIgnoredFilesInPatch(branchName, mainWorktreePath)` — 检测 patch 中的幽灵文件
3. 修改 `migrateChangesViaPatch` — apply 前调用检测函数，有冲突则输出提示并返回失败
4. 新增消息常量 `VALIDATE_IGNORED_FILES_CONFLICT`（双语）

### 提示格式

```
⚠ 检测到被 .gitignore 忽略的文件残留在主 worktree 中，导致变更无法应用：
  - <ignored-dir>/findings/some-findings.md
  - <ignored-dir>/plans/some-plan.md
  ...（共 N 个文件）

请手动清理后重试：
  git clean -fdx <ignored-dir>/
```

清理命令按冲突文件的直接父目录去重生成。
