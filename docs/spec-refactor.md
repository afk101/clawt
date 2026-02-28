# Clawt 验证架构重构方案

> 本文档描述 clawt validate 核心验证机制的重构方案，目标是**彻底杜绝 patch apply 冲突**。

---

## 目录

- [1. 问题分析](#1-问题分析)
- [2. 重构方案概述](#2-重构方案概述)
- [3. 新增概念：验证分支](#3-新增概念验证分支)
- [4. 新增概念：项目级配置](#4-新增概念项目级配置)
- [5. 受影响的命令](#5-受影响的命令)
  - [5.1 init 命令（新增）](#51-init-命令新增)
  - [5.2 create 命令变更](#52-create-命令变更)
  - [5.3 run 命令变更](#53-run-命令变更)
  - [5.4 validate 命令变更](#54-validate-命令变更)
  - [5.5 validate --clean 命令变更](#55-validate---clean-命令变更)
  - [5.6 sync 命令变更](#56-sync-命令变更)
  - [5.7 remove 命令变更](#57-remove-命令变更)
  - [5.8 merge 命令变更](#58-merge-命令变更)
  - [5.9 reset 命令变更](#59-reset-命令变更)
- [6. 重构规则](#6-重构规则)
- [7. 全局目录结构变更](#7-全局目录结构变更)
- [8. 全局配置变更](#8-全局配置变更)

---

## 1. 问题分析

### 当前架构

validate 命令通过 `git diff HEAD...<branchName> --binary` 生成 patch，然后 `git apply` 到主 worktree 的工作目录。这种方式依赖三点 diff，patch 的上下文行基于主 worktree 当前 HEAD 与目标分支的分叉点。

### 冲突根源

当主 worktree 的 HEAD 推进（如合并了其他分支的代码）后，patch 的上下文行可能与主 worktree 当前文件内容不匹配，导致 `git apply` 失败。此时用户必须执行 `clawt sync` 将主分支代码合并到目标 worktree，才能重新 validate。

### 问题影响

- 用户体验差：频繁冲突打断验证流程
- sync 本身也可能产生冲突，需要手动解决
- 增量 validate 中 HEAD 变化的处理逻辑复杂且有降级路径

---

## 2. 重构方案概述

### 核心思路

创建 worktree 时，同时基于主 worktree 当前 HEAD 创建一个**验证分支**（validate branch）。validate 时，在主 worktree 项目中切换到验证分支来验证，而不是在主分支上 apply patch。

### 为什么能杜绝冲突

验证分支在创建后不会被修改（不受主分支 HEAD 推进的影响），它与目标 worktree 的分支共享同一个创建基点。因此 `git diff HEAD...<branchName> --binary` 中的 HEAD（验证分支的 HEAD）永远与目标分支的分叉点一致，patch apply 永远不会冲突。

### 变更范围总览

| 变更项 | 说明 |
| --- | --- |
| 新增验证分支 | 每个目标 worktree 对应一个 `clawt-validate-<原始分支名>` 验证分支 |
| 新增项目级配置 | `~/.clawt/projects/<projectName>/config.json`，存储项目的主工作分支 |
| validate 验证方式 | 从「主分支上 apply patch」改为「切换到验证分支后 apply patch」 |
| create 命令 | 同步创建验证分支 + 主工作分支检测提醒 |
| sync 命令 | 新增验证分支重建逻辑 |
| remove 命令 | 同步删除验证分支 |
| merge 命令 | 同步删除验证分支 |
| 全局配置 | 新增 `warnBranchOnCreate` 开关 |

---

## 3. 新增概念：验证分支

### 命名规则

验证分支命名格式：`clawt-validate-<原始分支名>`

| 目标分支 | 验证分支 |
| --- | --- |
| `feat-login` | `clawt-validate-feat-login` |
| `fix-bug-1` | `clawt-validate-fix-bug-1` |
| `fix-bug-2` | `clawt-validate-fix-bug-2` |

### 创建时机

与目标 worktree 分支同时创建。在 `git worktree add -b <branchName>` 之后，立即执行：

```bash
git branch clawt-validate-<branchName>
```

验证分支是一个普通的本地分支（不关联 worktree），指向创建时主 worktree 的 HEAD commit。

### 生命周期

验证分支的生命周期与目标 worktree 的分支**完全一致**：

| 事件 | 目标分支 | 验证分支 |
| --- | --- | --- |
| create / run | 创建 | 同步创建 |
| remove（用户选择删除分支） | 删除 | 同步删除 |
| remove（用户选择保留分支） | 保留 | 保留 |
| merge 后清理（用户确认） | 删除 | 同步删除 |
| merge 后清理（用户拒绝） | 保留 | 保留 |
| sync | 不变 | 重建（删除后重新创建，基于当前主分支 HEAD） |

### 验证分支前缀常量

在 `src/constants/branch.ts` 中新增：

```typescript
/** 验证分支名前缀 */
export const VALIDATE_BRANCH_PREFIX = 'clawt-validate-';
```

---

## 4. 新增概念：项目级配置

### 存放位置

```
~/.clawt/projects/<projectName>/config.json
```

### 配置内容

```json
{
  "clawtMainWorkBranch": "main"
}
```

| 配置项 | 类型 | 说明 |
| --- | --- | --- |
| `clawtMainWorkBranch` | `string` | 项目的主工作分支名，用于 create 时检测当前分支是否为主分支 |

### 设置方式

通过 `clawt init` 命令设置（见 [5.1 init 命令](#51-init-命令新增)）。

除 `clawt init` 以外的所有命令，执行时都会校验项目级配置是否存在。如果未执行过 `clawt init`，命令会直接报错并提示用户先初始化。

### 路径常量

在 `src/constants/paths.ts` 中新增：

```typescript
/** 项目级配置目录 ~/.clawt/projects/ */
export const PROJECTS_CONFIG_DIR = join(CLAWT_HOME, 'projects');
```

---

## 5. 受影响的命令

### 5.1 init 命令（新增）

**命令：**

```bash
# 设置主工作分支（使用当前分支）
clawt init

# 设置主工作分支（指定分支名）
clawt init -b <branchName>

# 查看当前项目的 init 配置
clawt init show
```

**参数：**

| 参数/子命令 | 必填 | 说明 |
| --- | --- | --- |
| `-b` | 否 | 指定主工作分支名。不传则使用当前分支 |
| `show` | 否 | 查看当前项目的 init 配置 |

**功能说明：**

初始化项目级配置，将指定分支记录为该项目的主工作分支（`clawtMainWorkBranch`）。该配置用于 `create` / `run` 时检测当前分支是否为主工作分支，并在偏离时提醒用户。

**运行流程（设置模式）：**

1. **主 worktree 校验** (2.1)
2. **确定主工作分支名**：
   - 传了 `-b` → 使用指定的分支名
   - 未传 `-b` → 使用当前分支名（`git rev-parse --abbrev-ref HEAD`）
3. **写入项目级配置**：将 `clawtMainWorkBranch` 写入 `~/.clawt/projects/<projectName>/config.json`
   - 配置文件不存在 → 创建
   - 配置文件已存在 → 覆盖 `clawtMainWorkBranch` 字段
4. **输出成功提示**

**运行流程（show 模式）：**

1. **主 worktree 校验** (2.1)
2. **读取项目级配置**：读取 `~/.clawt/projects/<projectName>/config.json`
   - 配置不存在 → 输出提示 `该项目尚未初始化，请执行 clawt init 进行初始化`
   - 配置存在 → 输出配置内容

**输出格式：**

```
# 首次初始化
✓ 已将 main 设为该项目的主工作分支

# 更新已有配置
✓ 已将主工作分支从 develop 更新为 main

# show 查看配置
当前项目: my-project
  主工作分支: main

# show 未初始化
该项目尚未初始化，请执行 clawt init 进行初始化
```

**重复执行：** 支持重复执行，后一次覆盖前一次的配置。

---

### 5.2 create 命令变更

#### 新增逻辑：主工作分支检测

在创建 worktree 之前，检测当前 HEAD 所在分支是否为配置的主工作分支（`clawtMainWorkBranch`）。

**流程：**

1. 读取项目级配置 `~/.clawt/projects/<projectName>/config.json`（如果配置不存在，由前置校验拦截，见 [第 6 章规则 2](#6-重构规则)）
2. 如果当前分支**是** `clawtMainWorkBranch`，正常继续
3. 如果当前在**验证分支**（`clawt-validate-` 前缀）上：
   - 验证分支上的修改视为可丢弃的临时状态
   - 如果工作区有未提交更改，自动执行 `git reset --hard HEAD && git clean -fd` 清理
   - 然后自动切换到主工作分支，继续创建流程
4. 如果当前在**其他普通分支**上：
   - 如果全局配置 `warnBranchOnCreate` 为 `false`，跳过分支切换提醒
   - 否则，黄色提醒并交互确认：

```
⚠ 当前不在主工作分支上，即将切换到主工作分支 main 来创建新的 worktree

❯ yes (确认切换并创建)
  no  (取消)
```

   - 用户选择 no → 退出
   - 用户选择 yes 或 `warnBranchOnCreate` 为 `false` → 继续下一步
5. 切换前**检测工作区脏状态**：如果当前分支有未提交的更改，提供交互式选择（避免将修改意外带到主工作分支上）：

```
⚠ 当前分支有未提交的更改，请选择处理方式：

❯ reset (推荐) - 丢弃所有更改 (git reset --hard HEAD && git clean -fd)
  stash        - 暂存更改 (git add . && git stash)
  exit         - 退出，手动处理
```

   - 选择 reset → 执行 `git reset --hard HEAD && git clean -fd`
   - 选择 stash → 执行 `git add . && git stash push -m "clawt:auto-stash"`
   - 选择 exit → 抛出错误退出
   - 处理完成后再次校验工作区是否干净，不干净则报错退出
6. 执行 `git checkout <clawtMainWorkBranch>`，然后继续创建流程

#### 新增逻辑：同步创建验证分支

在每个 worktree 创建成功后，立即创建对应的验证分支：

```bash
# 创建目标 worktree
git worktree add -b feat-login ~/.clawt/worktrees/<project>/feat-login

# 创建对应的验证分支（指向当前 HEAD）
git branch clawt-validate-feat-login
```

批量创建时（n > 1），每个目标分支都对应创建一个验证分支。

#### 输出格式变更

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
```

---

### 5.3 run 命令变更

run 命令内部调用 `createWorktrees` 或 `createWorktreesByBranches`，因此验证分支的创建和主工作分支检测逻辑（包括工作区脏状态处理）**自动继承** create 命令的变更，无需额外修改 run 命令本身。

---

### 5.4 validate 命令变更

#### 核心变更：切换到验证分支后执行验证

validate 不再在主分支上直接 apply patch，而是先切换到目标分支对应的验证分支，再 apply patch。

#### 首次 validate（无历史快照）

##### 步骤 0：解析目标 worktree

不变，沿用现有的模糊匹配逻辑。

##### 步骤 1：检测主 worktree 工作区状态

不变，沿用现有的 `handleDirtyMainWorktree` 逻辑（内部委托给通用的 `handleDirtyWorkingDir` 函数）。如果工作区有未提交的更改，提示用户选择处理方式（reset / stash / exit）。

##### 步骤 2：检测目标分支变更

不变，沿用现有逻辑。检测未提交修改和已提交 commit，两者均无则退出。

##### 步骤 3：切换到验证分支

```bash
cd <主 worktree 路径>
git checkout clawt-validate-<branchName>
```

如果验证分支不存在，直接报错退出：

```
✗ 未找到验证分支 clawt-validate-<branchName>，请重新创建 worktree
```

##### 步骤 4：通过 patch 迁移目标分支全量变更

与当前逻辑一致，使用三点 diff + apply patch：

```bash
# 如果有未提交修改，先临时提交
cd ~/.clawt/worktrees/<project>/<branchName>
git add .
git commit -m "clawt:temp-commit-for-validate"

# 在主 worktree（已切换到验证分支）中执行三点 diff
cd <主 worktree 路径>
git diff HEAD...<branchName> --binary | git apply

# 撤销临时 commit
cd ~/.clawt/worktrees/<project>/<branchName>
git reset --soft HEAD~1
git restore --staged .
```

> 由于验证分支的 HEAD 与目标分支的创建基点一致，patch apply **永远不会冲突**。

##### 步骤 5：保存快照为 git tree 对象

与当前逻辑一致：

```bash
git add .
git write-tree  # → tree hash，写入快照文件
git rev-parse HEAD  # → HEAD commit hash，写入快照文件
git restore --staged .
```

> 此处保存的 HEAD commit hash 是验证分支的 HEAD（即创建时的基点），而非主分支的 HEAD。

##### 步骤 6：输出成功提示

```
✓ 已将分支 feature-scheme-1 的变更应用到主 worktree（验证分支: clawt-validate-feature-scheme-1）
  可以开始验证了
```

##### 步骤 7：执行 `--run` 命令（可选）

不变。

##### patch apply 失败的处理

在新架构下，由于验证分支 HEAD 不变，patch apply 理论上不会失败。但仍保留 `handlePatchApplyFailure` 作为兜底（例如极端情况下的 binary 文件冲突等），逻辑不变。

#### 增量 validate（存在历史快照）

##### 步骤 1：读取旧快照

不变。

##### 步骤 2：确保主 worktree 干净

不变。

##### 步骤 3：切换到验证分支

如果当前已在该验证分支上（上次 validate 后未切回），跳过。如果当前在另一个验证分支上（验证了分支 A，现在要验证分支 B），直接切换：

```bash
git checkout clawt-validate-<branchName>
```

##### 步骤 4：从目标分支获取最新全量变更

与当前逻辑一致。

##### 步骤 5：保存最新快照

与当前逻辑一致。

##### 步骤 6：将旧变更状态载入暂存区

由于验证分支的 HEAD 不会变化，`oldHeadCommitHash` 与 `currentHeadCommitHash` 始终一致（除非执行了 sync 重建验证分支），因此：

- **正常情况**（HEAD 未变化）：直接 `git read-tree <旧 tree hash>` 载入暂存区，这是最常见的路径
- **sync 后**（HEAD 变化，验证分支已重建）：走当前的 patch 重放逻辑（情况 B），将旧变更 patch 重放到新 HEAD 暂存区上

> 相比重构前，正常情况不再需要处理 HEAD 变化的复杂逻辑，代码路径更简单、更可靠。

##### 步骤 7：输出成功提示

不变。

##### 步骤 8：执行 `--run` 命令（可选）

不变。

---

### 5.5 validate --clean 命令变更

#### 新增逻辑：切回主工作分支

在清理完毕后，如果当前处于验证分支上，自动切回主工作分支：

**流程：**

1. （不变）主 worktree 校验
2. （不变）解析目标 worktree
3. （不变）确认破坏性操作
4. （不变）如果主 worktree 有未提交更改，执行 `git reset --hard` + `git clean -fd` 清空
5. （不变）删除对应分支的快照文件
6. **（新增）** 如果当前分支是验证分支（以 `clawt-validate-` 开头），切回主工作分支：
   ```bash
   git checkout <clawtMainWorkBranch>
   ```
7. 输出清理成功提示

---

### 5.6 sync 命令变更

#### 使用场景变更

在新架构下，sync 不再是为了解决 validate 冲突（因为不会冲突了），而是纯粹的「将主分支最新代码同步到目标 worktree」的操作，让目标 worktree 上的 Agent 能使用主分支的最新代码继续工作。

#### 新增逻辑：确保在主工作分支上

`handleSync` 在执行核心逻辑前，调用 `ensureOnMainWorkBranch()` 确保当前处于主工作分支上。sync 命令需要从主分支发起合并操作，因此必须保证当前分支状态正确。

#### 新增逻辑：重建验证分支

sync 将主分支合并到目标 worktree 后，目标分支的代码基点发生变化。为保持验证分支与目标分支基点一致，需要**重建验证分支**。

**`executeSyncForBranch` 流程变更（async 函数）：**

1. （不变）获取主分支名
2. （不变）检查目标 worktree 是否有未提交变更，有则自动保存
3. （不变）在目标 worktree 中合并主分支
4. （不变）冲突处理
5. （不变）清除 validate 快照
6. **（新增）重建验证分支**（`rebuildValidateBranch`，async 函数）：
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
7. （不变）输出成功提示

**输出格式变更：**

```
✓ 已将 main 的最新代码同步到 feat-login
  验证分支 clawt-validate-feat-login 已重建
```

#### validate 中自动 sync 的联动

当 validate 的 patch apply 失败（兜底场景）并触发自动 sync 时，sync 内部会自动重建验证分支，validate 流程结束后用户重新执行 validate 即可。

---

### 5.7 remove 命令变更

#### 新增逻辑：同步删除验证分支

当用户选择删除分支时，同步删除对应的验证分支。当用户选择保留分支时，验证分支也保留。

**流程变更：**

```bash
# 移除 worktree
git worktree remove -f <worktree路径>

# 如果用户选择了删除分支
git branch -D <branchName>
git branch -D clawt-validate-<branchName>  # 新增：同步删除验证分支

# 清理该分支对应的 validate 快照
```

#### 输出格式变更

列出即将移除的 worktree 时，需要体现验证分支：

```
即将移除以下 worktree 及本地分支：

  1. ~/.clawt/worktrees/main-project/feature-scheme-1  →  分支: feature-scheme-1, 验证分支: clawt-validate-feature-scheme-1
  2. ~/.clawt/worktrees/main-project/feature-scheme-2  →  分支: feature-scheme-2, 验证分支: clawt-validate-feature-scheme-2
```

确认文案调整：

```
是否同时删除对应的本地分支和验证分支？(y/N)
```

#### 额外逻辑：清理游离的验证分支

当主 worktree 当前在某个验证分支上，而该验证分支对应的 worktree 即将被删除时，需要先切回主工作分支：

```bash
# 如果当前在即将删除的验证分支上，先切回主分支
git checkout <clawtMainWorkBranch>

# 再执行删除
git branch -D clawt-validate-<branchName>
```

---

### 5.8 merge 命令变更

#### 新增逻辑：同步删除验证分支

merge 成功后清理 worktree 和分支时，同步删除验证分支。

**流程变更（步骤 10）：**

```bash
# 用户确认清理后
git worktree remove -f <worktree路径>
git branch -D <branchName>
git branch -D clawt-validate-<branchName>  # 新增：同步删除验证分支
git worktree prune
```

#### 额外逻辑：merge 前检测分支状态

merge 时如果主 worktree 当前在验证分支上，需要先切回主工作分支再执行 merge：

```bash
# 检测当前分支
current_branch=$(git rev-parse --abbrev-ref HEAD)

# 如果在验证分支上，先清理并切回主分支
if [[ "$current_branch" == clawt-validate-* ]]; then
  git reset --hard
  git clean -fd
  git checkout <clawtMainWorkBranch>
fi

# 执行 merge
git merge <branchName>
```

#### 验证分支的删除与目标分支同步

验证分支的删除时机与目标分支保持一致（见 [第 3 章生命周期表](#3-新增概念验证分支)）：

- 步骤 10 用户确认清理 worktree 和分支 → 同步删除验证分支
- 步骤 10 用户拒绝清理 → 验证分支也保留（用户后续可能还需要对该 worktree 做 validate）
- 步骤 11 清理 validate 快照 → 仅清理快照文件，不影响验证分支

---

### 5.9 reset 命令变更

#### 语义定义

reset 命令的语义是「清空当前分支的工作区和暂存区」，**不涉及分支切换**。无论当前处于主工作分支还是验证分支，reset 只执行 `git reset --hard` + `git clean -fd`，不会强制切回主工作分支。

> **设计原因**：reset 的职责是「重置工作区状态」，分支切换属于 validate --clean 和 remove 等命令的职责。将分支切换耦合到 reset 会违反单一职责原则。

**流程：**

1. 主 worktree 校验
2. 项目级配置校验（`requireProjectConfig()`，因 reset 不调用 `ensureOnMainWorkBranch`，需自行校验）
3. 检测工作区状态
4. 确认破坏性操作
5. 重置工作区和暂存区
6. 输出成功提示

---

## 6. 重构规则

以下规则适用于本次重构的所有实现工作：

1. **不兼容旧版本**：本次重构不考虑旧版本数据、旧版本创建的 worktree 或旧版本配置的兼容性。所有命令均假定验证分支和项目级配置已按新架构存在。用户需删除旧 worktree 后重新创建。
2. **项目级配置前置校验**：仅对 create、run、validate、sync、remove、merge、reset 这 7 个核心命令添加检测，执行时必须先检查项目级配置（`~/.clawt/projects/<projectName>/config.json`）是否存在且包含 `clawtMainWorkBranch`。如果不存在，直接报错退出并提示用户先执行 `clawt init`：
   ```
   ✗ 该项目尚未初始化，请先执行 clawt init -b<branchName>设置主工作分支
   ```
   其他命令（list、resume、config、status、alias、projects、completion）不受影响，无需添加该校验。
   > **实现细节**：`ensureOnMainWorkBranch()` 内部已通过 `getMainWorkBranch()` → `requireProjectConfig()` 完成了项目配置校验，因此调用了 `ensureOnMainWorkBranch` 的命令（create、run、validate、sync、remove、merge）**无需再显式调用 `requireProjectConfig()`**，避免重复校验。仅 reset 命令因不调用 `ensureOnMainWorkBranch`，需要自行调用 `requireProjectConfig()`。
3. **主分支名统一从项目级配置获取**：所有需要获取主分支名的场景（sync 中合并主分支、merge 中计算 merge-base、切回主分支等），统一使用项目级配置中的 `clawtMainWorkBranch`，不再通过 `getCurrentBranch(mainWorktreePath)` 动态获取。因为在新架构下，主 worktree 可能处于验证分支上，`getCurrentBranch` 会返回验证分支名而非真正的主工作分支名。
4. **测试文件全量更新**：本次重构涉及的所有命令（init、create、run、validate、sync、remove、merge、reset），其对应的测试文件必须同步更新，确保覆盖新增的验证分支逻辑、项目级配置逻辑和变更后的流程。

---

## 7. 全局目录结构变更

```
~/.clawt/
  ├── config.json                        # 全局配置（不变）
  ├── logs/                              # 日志目录（不变）
  ├── worktrees/<project>/<branch>/      # worktree 统一存放（不变）
  ├── validate-snapshots/<project>/      # validate 快照（不变）
  │     ├── <branch>.tree                # tree hash（不变）
  │     └── <branch>.head                # HEAD commit hash（不变）
  ├── projects/<project>/                # 【新增】项目级配置目录
  │     └── config.json                  # 项目级配置（含 clawtMainWorkBranch）
  └── update-check.json                  # 更新检查缓存（不变）
```

---

## 8. 全局配置变更

在 `~/.clawt/config.json` 中新增配置项：

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `warnBranchOnCreate` | `boolean` | `true` | create/run 时如果当前不在主工作分支上，是否红色提醒并确认切换。设为 `false` 则跳过提醒直接切换 |

**默认配置文件变更：**

```json
{
  "autoDeleteBranch": false,
  "claudeCodeCommand": "claude",
  "autoPullPush": false,
  "confirmDestructiveOps": true,
  "maxConcurrency": 0,
  "terminalApp": "auto",
  "aliases": {},
  "autoUpdate": true,
  "warnBranchOnCreate": true
}
```
