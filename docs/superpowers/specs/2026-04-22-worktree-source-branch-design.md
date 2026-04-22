# Worktree 来源分支记录 — 设计规范

**日期：** 2026-04-22  
**背景：** 用户同时维护多条主线（如 `main` 和 `develop`），不同批次的 worktree 分别从不同主线创建，需要在 `clawt list` / `clawt status` / `clawt status -i` 中展示每个 worktree 的来源分支，便于区分和管理。

---

## 一、存储层

### 路径规范

```
~/.clawt/worktree-meta/<projectName>/<branchName>.json
```

与现有 `validate-snapshots/` 平行，顶级目录按功能命名，子目录按项目分组，风格一致。

### 文件内容

```json
{ "sourceBranch": "develop" }
```

仅记录来源分支名，结构极简。

### 新增路径常量

**文件：** `src/constants/paths.ts`

```typescript
export const WORKTREE_META_DIR = join(CLAWT_HOME, 'worktree-meta');
```

同步在 `src/constants/index.ts` 中导出。

### 新增工具模块

**文件：** `src/utils/worktree-meta.ts`（新建）

| 函数 | 签名 | 说明 |
|------|------|------|
| `getWorktreeMetaPath` | `(projectName, branchName) => string` | 返回 meta 文件绝对路径 |
| `writeWorktreeMeta` | `(projectName, branchName, sourceBranch) => void` | 写入 meta 文件（确保目录存在） |
| `readWorktreeSourceBranch` | `(projectName, branchName) => string \| null` | 读取来源分支名，文件不存在返回 null |
| `removeWorktreeMeta` | `(projectName, branchName) => void` | 删除单个 meta 文件（不存在则跳过） |
| `removeProjectWorktreeMeta` | `(projectName) => void` | 删除整个项目的 meta 目录 |

在 `src/utils/index.ts` 中统一导出上述函数。

---

## 二、写入时机与清理

### 写入

在 `src/utils/worktree.ts` 的 `createWorktrees` 和 `createWorktreesByBranches` 中，每个 worktree 创建成功后立即写入 meta：

```typescript
// 伪代码
gitCreateWorktree(name, worktreePath);
createValidateBranch(name);
writeWorktreeMeta(projectName, name, clawtMainWorkBranch);  // 新增
```

`clawtMainWorkBranch` 通过 `getMainWorkBranch()` 获取（已有函数），`projectName` 通过 `getProjectName()` 获取（`createWorktrees` 内部已有调用）。

### 清理

在 `src/commands/remove.ts` 的清理循环中，追加 `removeWorktreeMeta`：

```typescript
removeWorktreeByPath(wt.path);
deleteBranch(wt.branch);
deleteValidateBranch(wt.branch);
removeSnapshot(projectName, wt.branch);
removeWorktreeMeta(projectName, wt.branch);  // 新增
```

`remove --all` 清理完所有 worktree 后，额外调用 `removeProjectWorktreeMeta(projectName)` 清理整个项目目录。

---

## 三、移除上一轮代码

以下内容全部移除（上一轮实现的 commit hash 展示功能）：

| 位置 | 内容 |
|------|------|
| `src/types/worktree.ts` | `WorktreeBaseInfo` 接口 |
| `src/types/status.ts` | `baseInfo: WorktreeBaseInfo` 字段 |
| `src/types/index.ts` | `WorktreeBaseInfo` 导出 |
| `src/utils/git-branch.ts` | `truncateCommitMessage`、`getWorktreeBaseInfoAsync` 函数 |
| `src/utils/index.ts` | `getWorktreeBaseInfoAsync` 导出 |
| `src/constants/messages/status.ts` | `STATUS_BASE_*` 系列常量 |
| `src/constants/messages/interactive-panel.ts` | `PANEL_BASE_*` 系列常量 |
| `src/constants/messages/index.ts` | 对应导出 |
| `src/commands/status.ts` | `printBaseInfoLine` 函数、`collectWorktreeDetailedStatusAsync` 的 `mainBranch` 参数及 `baseInfo` 收集 |
| `src/utils/interactive-panel-render.ts` | `buildBaseInfoLine` 函数及其调用 |
| `src/commands/list.ts` | `printListBaseInfoLine` 函数、`loadProjectConfig` 导入、`getWorktreeBaseInfoAsync` 调用 |
| `tests/unit/commands/status.test.ts` | `getWorktreeBaseInfoAsync` mock 及 `STATUS_BASE_*` mock |
| `tests/unit/commands/list.test.ts` | `getWorktreeBaseInfoAsync`、`loadProjectConfig` mock 及 `STATUS_BASE_*` mock |

---

## 四、展示

### 数据收集

**`clawt status` / `clawt status -i`：**

在 `collectWorktreeDetailedStatusAsync`（`src/commands/status.ts`）中新增字段：

```typescript
interface WorktreeDetailedStatus {
  // ...现有字段...
  sourceBranch: string | null;  // 新增
}
```

收集时调用 `readWorktreeSourceBranch(projectName, worktree.branch)`（同步，无需加入 Promise.all）。

**`clawt list`：**

在 `printListAsText` 中，遍历 worktree 时同步调用 `readWorktreeSourceBranch`，无需并行。

### 消息常量

在 `src/constants/messages/status.ts` 的 `STATUS_MESSAGES` 中新增：

```typescript
STATUS_SOURCE_BRANCH: (branchName: string) => `来自 ${branchName}`,
```

在 `src/constants/messages/interactive-panel.ts` 中新增：

```typescript
export const PANEL_SOURCE_BRANCH = (branchName: string): string =>
  chalk.gray(`来自 ${branchName}`);
```

### 渲染位置

各视图统一：在"与主分支同步 / 落后 N 个提交"行**之后**、"创建于"行**之前**插入来源分支行。

**`clawt list` 示例：**

```
  ~/.clawt/worktrees/my-project/feature-login   [feature-login]
    3 个提交   +120 -30   (未提交修改)
    来自 develop
```

**`clawt status` 示例：**

```
  ● feature-login   [已提交]
    +120 -30
    3 个本地提交
    与主分支同步
    来自 develop
    创建于 3 天前
    上次验证: 2 小时前
```

**无 meta 文件（老 worktree）：** 静默跳过，不显示来源分支行。

**颜色：** `chalk.gray`，次要信息。

---

## 五、全局目录结构更新

`spec.md` 的全局目录结构章节需新增 `worktree-meta/` 目录说明：

```
~/.clawt/
├── config.json
├── logs/
├── validate-snapshots/
│   └── <project-name>/
│       └── <branchName>.tree / .head / .staged
├── worktree-meta/                           # 新增
│   └── <project-name>/
│       └── <branchName>.json               # { "sourceBranch": "develop" }
├── projects/<project-name>/
│   └── config.json
└── worktrees/
    └── <project-name>/
        └── <branchName>/
```

---

## 六、测试

- `src/utils/worktree-meta.ts` 新增单元测试：写入、读取、删除、文件不存在时返回 null
- `tests/unit/commands/status.test.ts`：mock `readWorktreeSourceBranch`，验证 `sourceBranch` 字段出现在 JSON 输出中
- `tests/unit/commands/list.test.ts`：mock `readWorktreeSourceBranch`，验证文本输出包含"来自"行
- `pnpm build` + `pnpm test` 全量通过
