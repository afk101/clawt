# validate 被忽略文件冲突检测 — 设计文档

## 问题

当目标分支跟踪了某些在 `.gitignore` 中的文件（如 AI Agent 用 `git add -f` 强制提交），validate 通过 `git apply` 将这些文件创建到主 worktree 工作目录后，`git clean -fd` 无法清理它们（因为被 `.gitignore` 忽略）。后续 validate 的 patch apply 因文件已存在而失败，且 sync 无法打破这个死循环。

## 修复目标

在 `migrateChangesViaPatch` 中，`git apply` 之前检测被 `.gitignore` 忽略且物理存在于主 worktree 工作目录的文件（"幽灵文件"），若检测到冲突则输出清晰的错误提示和可执行的清理命令，而非当前的误导性信息 "diverged too far from main"。

## 验收标准

1. 检测到幽灵文件时，输出文件列表和 `git clean -fdx <dir>` 清理命令
2. 未检测到幽灵文件时，行为与当前完全一致（无回归）
3. 提示信息为双语（中英）
4. 有单元测试覆盖检测逻辑

## 架构

### 检测流程

```
migrateChangesViaPatch()
  ├── gitDiffBinaryAgainstBranch()  → 获取 patch
  ├── detectIgnoredFilesInPatch()   → 新增：检测幽灵文件
  │     ├── git diff --name-only HEAD...branch  → 获取 patch 涉及的文件列表
  │     ├── git check-ignore <files>            → 筛选被忽略的文件
  │     └── fs.existsSync                       → 筛选物理存在的文件
  ├── 有冲突 → printWarning + return { success: false }
  └── 无冲突 → gitApplyFromStdin()  → 正常 apply
```

### 新增函数

| 函数 | 文件 | 职责 |
|------|------|------|
| `gitCheckIgnored(paths, cwd)` | `src/utils/git-core.ts` | 批量检测文件是否被 `.gitignore` 忽略 |
| `detectIgnoredFilesInPatch(branchName, mainWorktreePath)` | `src/utils/validate-core.ts` | 检测 patch 中的幽灵文件列表 |

### 修改函数

| 函数 | 文件 | 变更 |
|------|------|------|
| `migrateChangesViaPatch` | `src/utils/validate-core.ts` | apply 前调用检测函数 |

### 新增消息常量

| 常量 | 文件 | 用途 |
|------|------|------|
| `VALIDATE_IGNORED_FILES_CONFLICT` | `src/constants/messages/validate.ts` | 幽灵文件冲突提示（含文件列表和清理命令） |

### 提示格式

```
⚠ 检测到被 .gitignore 忽略的文件残留在主 worktree 中，导致变更无法应用：
  - docs/superpowers/findings/2026-05-30-chat-message-block-findings.md
  - docs/superpowers/plans/2026-05-30-chat-message-block.md
  ...（共 18 个文件）

请手动清理后重试：
  git clean -fdx docs/superpowers/
```

清理命令按冲突文件的直接父目录去重生成。

## 错误处理

- `git check-ignore` 无匹配时退出码为 1（非错误），需 catch 后返回空数组
- `git diff --name-only` 失败时不阻断流程，跳过检测继续 apply（降级为当前行为）
- 检测函数本身的异常不应阻断 validate 流程

## 回归测试要求

- 无幽灵文件时：validate 正常通过（现有测试覆盖）
- 有幽灵文件时：validate 返回 `{ success: false }` 并输出提示
- `gitCheckIgnored` 单元测试：空输入、全部忽略、全部不忽略、混合场景
