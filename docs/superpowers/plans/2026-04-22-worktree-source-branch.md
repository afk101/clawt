# Worktree 来源分支记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `clawt list`、`clawt status`、`clawt status -i` 中展示每个 worktree 的来源主分支名（如"来自 develop"），同时移除之前实现的 commit hash 基点展示功能。

**Architecture:** 在 worktree 创建时将来源主分支名写入 `~/.clawt/worktree-meta/<projectName>/<branchName>.json`，展示时同步读取；移除所有旧的 `WorktreeBaseInfo`/`getWorktreeBaseInfoAsync` 相关代码，用极简的 `sourceBranch: string | null` 字段替代。

**Tech Stack:** TypeScript, Node.js fs 模块, chalk, vitest

---

## 文件结构总览

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/constants/paths.ts` | 新增 `WORKTREE_META_DIR` 常量 |
| 修改 | `src/constants/messages/status.ts` | 删除 `STATUS_BASE_*`，新增 `STATUS_SOURCE_BRANCH` |
| 修改 | `src/constants/messages/interactive-panel.ts` | 删除 `PANEL_BASE_*`，新增 `PANEL_SOURCE_BRANCH` |
| 修改 | `src/constants/messages/index.ts` | 更新 PANEL_BASE_* 相关导入导出 |
| 新建 | `src/utils/worktree-meta.ts` | 5 个 meta 文件读写函数 |
| 修改 | `src/utils/index.ts` | 导出新增 meta 函数，删除 `getWorktreeBaseInfoAsync` |
| 修改 | `src/utils/git-branch.ts` | 删除 `truncateCommitMessage`、`getWorktreeBaseInfoAsync` |
| 修改 | `src/types/worktree.ts` | 删除 `WorktreeBaseInfo` 接口 |
| 修改 | `src/types/status.ts` | 删除 `baseInfo: WorktreeBaseInfo`，新增 `sourceBranch: string \| null` |
| 修改 | `src/types/index.ts` | 删除 `WorktreeBaseInfo` 导出 |
| 修改 | `src/utils/worktree.ts` | 在 `createWorktrees`/`createWorktreesByBranches` 写入 meta |
| 修改 | `src/commands/remove.ts` | 删除 worktree 时清理 meta |
| 修改 | `src/commands/status.ts` | 删除 `getWorktreeBaseInfoAsync` 调用，新增 `sourceBranch` 读取和渲染 |
| 修改 | `src/utils/interactive-panel-render.ts` | 删除 `buildBaseInfoLine`，新增来源分支行渲染 |
| 修改 | `src/commands/list.ts` | 删除 baseInfo 相关，新增来源分支读取和渲染 |
| 修改 | `tests/unit/commands/status.test.ts` | 更新 mock，新增 `sourceBranch` 验证 |
| 修改 | `tests/unit/commands/list.test.ts` | 更新 mock，新增"来自"行验证 |
| 新建 | `tests/unit/utils/worktree-meta.test.ts` | worktree-meta.ts 单元测试 |

---

## Task 1: 新增路径常量 WORKTREE_META_DIR

**Files:**
- Modify: `src/constants/paths.ts`

- [ ] **Step 1: 在 `src/constants/paths.ts` 末尾新增常量**

打开文件，在 `PROJECTS_CONFIG_DIR` 常量后追加：

```typescript
/** worktree 来源分支元数据目录 ~/.clawt/worktree-meta/ */
export const WORKTREE_META_DIR = join(CLAWT_HOME, 'worktree-meta');
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | tail -5
```

Expected: 编译成功，无报错

- [ ] **Step 3: Commit**

```bash
git add src/constants/paths.ts
git commit -m "feat: add WORKTREE_META_DIR path constant"
```

---

## Task 2: 新建 worktree-meta.ts 工具模块

**Files:**
- Create: `src/utils/worktree-meta.ts`
- Create: `tests/unit/utils/worktree-meta.test.ts`

- [ ] **Step 1: 写 worktree-meta.ts 失败测试**

新建 `tests/unit/utils/worktree-meta.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// 模拟 WORKTREE_META_DIR 指向临时目录
const TEST_META_DIR = join(tmpdir(), `clawt-meta-test-${Date.now()}`);

vi.mock('../../../src/constants/paths.js', () => ({
  WORKTREE_META_DIR: TEST_META_DIR,
}));

import {
  getWorktreeMetaPath,
  writeWorktreeMeta,
  readWorktreeSourceBranch,
  removeWorktreeMeta,
  removeProjectWorktreeMeta,
} from '../../../src/utils/worktree-meta.js';

beforeEach(() => {
  mkdirSync(TEST_META_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_META_DIR, { recursive: true, force: true });
});

describe('getWorktreeMetaPath', () => {
  it('返回正确的 meta 文件路径', () => {
    const result = getWorktreeMetaPath('my-project', 'feature-login');
    expect(result).toBe(join(TEST_META_DIR, 'my-project', 'feature-login.json'));
  });
});

describe('writeWorktreeMeta', () => {
  it('写入 meta 文件，内容为 { sourceBranch }', () => {
    writeWorktreeMeta('my-project', 'feature-login', 'develop');
    const filePath = join(TEST_META_DIR, 'my-project', 'feature-login.json');
    expect(existsSync(filePath)).toBe(true);
    const content = JSON.parse(require('node:fs').readFileSync(filePath, 'utf-8'));
    expect(content).toEqual({ sourceBranch: 'develop' });
  });

  it('目录不存在时自动创建', () => {
    writeWorktreeMeta('new-project', 'feature-x', 'main');
    expect(existsSync(join(TEST_META_DIR, 'new-project', 'feature-x.json'))).toBe(true);
  });
});

describe('readWorktreeSourceBranch', () => {
  it('读取已写入的来源分支名', () => {
    writeWorktreeMeta('my-project', 'feature-login', 'develop');
    const result = readWorktreeSourceBranch('my-project', 'feature-login');
    expect(result).toBe('develop');
  });

  it('文件不存在时返回 null', () => {
    const result = readWorktreeSourceBranch('my-project', 'no-such-branch');
    expect(result).toBeNull();
  });
});

describe('removeWorktreeMeta', () => {
  it('删除已存在的 meta 文件', () => {
    writeWorktreeMeta('my-project', 'feature-login', 'develop');
    removeWorktreeMeta('my-project', 'feature-login');
    expect(existsSync(join(TEST_META_DIR, 'my-project', 'feature-login.json'))).toBe(false);
  });

  it('文件不存在时不抛异常', () => {
    expect(() => removeWorktreeMeta('my-project', 'no-such-branch')).not.toThrow();
  });
});

describe('removeProjectWorktreeMeta', () => {
  it('删除整个项目的 meta 目录', () => {
    writeWorktreeMeta('my-project', 'feature-a', 'main');
    writeWorktreeMeta('my-project', 'feature-b', 'develop');
    removeProjectWorktreeMeta('my-project');
    expect(existsSync(join(TEST_META_DIR, 'my-project'))).toBe(false);
  });

  it('目录不存在时不抛异常', () => {
    expect(() => removeProjectWorktreeMeta('no-such-project')).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm test tests/unit/utils/worktree-meta.test.ts 2>&1 | tail -20
```

Expected: 测试失败，报 `Cannot find module '../../../src/utils/worktree-meta.js'`

- [ ] **Step 3: 创建 `src/utils/worktree-meta.ts` 实现**

新建文件，内容如下：

```typescript
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { WORKTREE_META_DIR } from '../constants/paths.js';

/**
 * 获取 worktree meta 文件的绝对路径
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string} meta 文件绝对路径
 */
export function getWorktreeMetaPath(projectName: string, branchName: string): string {
  return join(WORKTREE_META_DIR, projectName, `${branchName}.json`);
}

/**
 * 写入 worktree 来源分支 meta 文件
 * 若目录不存在则自动创建
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名（目标 worktree 的分支）
 * @param {string} sourceBranch - 来源主分支名
 */
export function writeWorktreeMeta(projectName: string, branchName: string, sourceBranch: string): void {
  const filePath = getWorktreeMetaPath(projectName, branchName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ sourceBranch }), 'utf-8');
}

/**
 * 读取 worktree 来源分支名
 * 文件不存在（老 worktree）时返回 null
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 * @returns {string | null} 来源分支名，文件不存在时返回 null
 */
export function readWorktreeSourceBranch(projectName: string, branchName: string): string | null {
  const filePath = getWorktreeMetaPath(projectName, branchName);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8')) as { sourceBranch?: string };
    return content.sourceBranch ?? null;
  } catch {
    return null;
  }
}

/**
 * 删除单个 worktree 的 meta 文件
 * 文件不存在时静默跳过
 * @param {string} projectName - 项目名
 * @param {string} branchName - 分支名
 */
export function removeWorktreeMeta(projectName: string, branchName: string): void {
  const filePath = getWorktreeMetaPath(projectName, branchName);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * 删除整个项目的 worktree meta 目录
 * 目录不存在时静默跳过
 * @param {string} projectName - 项目名
 */
export function removeProjectWorktreeMeta(projectName: string): void {
  const projectDir = join(WORKTREE_META_DIR, projectName);
  if (existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm test tests/unit/utils/worktree-meta.test.ts 2>&1 | tail -20
```

Expected: 所有测试通过

- [ ] **Step 5: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | tail -5
```

Expected: 编译成功

- [ ] **Step 6: Commit**

```bash
git add src/utils/worktree-meta.ts tests/unit/utils/worktree-meta.test.ts
git commit -m "feat: add worktree-meta utility module"
```

---

## Task 3: 导出 worktree-meta 函数，并从 utils/index.ts 移除旧导出

**Files:**
- Modify: `src/utils/index.ts`

- [ ] **Step 1: 在 `src/utils/index.ts` 末尾追加导出**

在文件最后（`export { resolvePostCreateHook ... }` 行之后）添加：

```typescript
export { getWorktreeMetaPath, writeWorktreeMeta, readWorktreeSourceBranch, removeWorktreeMeta, removeProjectWorktreeMeta } from './worktree-meta.js';
```

同时，在同文件的 `git.js` 导出行中**删除** `getWorktreeBaseInfoAsync`。

现有行：
```typescript
  throwIfGitIndexLockError,
  getWorktreeBaseInfoAsync,
} from './git.js';
```

改为：
```typescript
  throwIfGitIndexLockError,
} from './git.js';
```

- [ ] **Step 2: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | tail -10
```

Expected: 编译报错（因为 status.ts / list.ts 还在使用 `getWorktreeBaseInfoAsync`），这是预期中的暂时状态，记录报错，继续后续任务

- [ ] **Step 3: Commit**

```bash
git add src/utils/index.ts
git commit -m "refactor: update utils/index.ts exports for worktree-meta"
```

---

## Task 4: 清理旧的类型定义

**Files:**
- Modify: `src/types/worktree.ts`
- Modify: `src/types/status.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: 删除 `src/types/worktree.ts` 中的 `WorktreeBaseInfo` 接口**

打开 `src/types/worktree.ts`，删除整个 `WorktreeBaseInfo` 接口（第 1-16 行）：

```typescript
/** Worktree 的创建基点信息，来源于验证分支（clawt-validate-<branch>）的 HEAD commit */
export interface WorktreeBaseInfo {
  /** 验证分支是否存在 */
  validateBranchExists: boolean;
  /** 创建时主分支的 HEAD commit 短 hash（7位），验证分支不存在时为 null */
  baseCommitHash: string | null;
  /** 创建时主分支 HEAD commit 的单行 message（截断到40字符），验证分支不存在时为 null */
  baseCommitMessage: string | null;
  /**
   * 主分支在创建基点之后新增的 commit 数
   * - null：主分支已不存在，无法计算
   * - 0：主分支未推进，创建基点即最新
   * - N > 0：主分支已推进 N 个提交，建议执行 clawt sync
   */
  mainBranchAhead: number | null;
}
```

- [ ] **Step 2: 修改 `src/types/status.ts`**

删除顶部的 import：
```typescript
import type { WorktreeBaseInfo } from './worktree.js';
```

并将 `WorktreeDetailedStatus` 中的字段：
```typescript
  /** Worktree 的创建基点信息（来源于验证分支的 HEAD commit） */
  baseInfo: WorktreeBaseInfo;
```
替换为：
```typescript
  /** 创建 worktree 时的来源主分支名（无 meta 文件时为 null） */
  sourceBranch: string | null;
```

- [ ] **Step 3: 删除 `src/types/index.ts` 中的 `WorktreeBaseInfo` 导出**

将：
```typescript
export type { WorktreeInfo, WorktreeStatus, WorktreeBaseInfo } from './worktree.js';
```
改为：
```typescript
export type { WorktreeInfo, WorktreeStatus } from './worktree.js';
```

- [ ] **Step 4: 编译（预期有更多报错，继续处理）**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/types/worktree.ts src/types/status.ts src/types/index.ts
git commit -m "refactor: replace WorktreeBaseInfo with sourceBranch field"
```

---

## Task 5: 清理旧的消息常量，新增来源分支常量

**Files:**
- Modify: `src/constants/messages/status.ts`
- Modify: `src/constants/messages/interactive-panel.ts`
- Modify: `src/constants/messages/index.ts`

- [ ] **Step 1: 修改 `src/constants/messages/status.ts`**

删除 `STATUS_MESSAGES` 中以下 4 个常量：
```typescript
  /** 创建基点信息（验证分支存在时，显示 commit hash 和 message） */
  STATUS_BASE_COMMIT: (hash: string, message: string) => `基于 ${hash} · "${message}"`,
  /** 创建基点未知（验证分支不存在） */
  STATUS_BASE_UNKNOWN: '基于 (基点未知)',
  /** 主分支已推进提示（list 命令用，简短版） */
  STATUS_BASE_MAIN_AHEAD: (count: number) => `↑ 主分支已推进 ${count} 个提交`,
  /** 主分支已推进提示（status 详情视图用，含操作建议） */
  STATUS_BASE_MAIN_AHEAD_WITH_HINT: (count: number) => `↑ 主分支已推进 ${count} 个提交，可执行 clawt sync`,
```

在 `STATUS_CONFIGURED_BRANCH_MISMATCH` 之后，`} as const` 之前，新增：
```typescript
  /** 来源主分支标签 */
  STATUS_SOURCE_BRANCH: (branchName: string) => `来自 ${branchName}`,
```

- [ ] **Step 2: 修改 `src/constants/messages/interactive-panel.ts`**

删除文件末尾的以下 3 个导出（第 103-121 行）：
```typescript
/**
 * 交互面板：创建基点信息（验证分支存在时）
 * @param {string} hash - commit 短 hash
 * @param {string} message - commit message（已截断）
 * @returns {string} 格式化的基点信息
 */
export const PANEL_BASE_COMMIT = (hash: string, message: string): string =>
  chalk.gray(`基于 ${hash} · "${message}"`);

/** 交互面板：创建基点未知（验证分支不存在） */
export const PANEL_BASE_UNKNOWN = chalk.gray('基于 (基点未知)');

/**
 * 交互面板：主分支已推进提示（简短版，节省行宽）
 * @param {number} count - 推进的 commit 数
 * @returns {string} 格式化的推进提示
 */
export const PANEL_BASE_MAIN_AHEAD = (count: number): string => chalk.yellow(`↑ 推进 ${count} 个`);
```

并在末尾新增：
```typescript
/**
 * 交互面板：来源主分支标签
 * @param {string} branchName - 来源主分支名
 * @returns {string} 格式化的来源分支文本
 */
export const PANEL_SOURCE_BRANCH = (branchName: string): string =>
  chalk.gray(`来自 ${branchName}`);
```

- [ ] **Step 3: 修改 `src/constants/messages/index.ts`**

将顶部从 `interactive-panel.js` 的导入行：
```typescript
import { PANEL_FOOTER_SHORTCUTS, PANEL_FOOTER_COUNTDOWN, PANEL_OVERFLOW_DOWN_HINT, PANEL_OVERFLOW_UP_HINT, PANEL_SNAPSHOT_SUMMARY, PANEL_NO_WORKTREES as PANEL_NO_WORKTREES_MSG, PANEL_PRESS_ENTER_TO_RETURN, PANEL_NOT_TTY, PANEL_TITLE, PANEL_CONFIGURED_BRANCH, PANEL_CONFIGURED_BRANCH_DELETED, PANEL_CONFIGURED_BRANCH_MISMATCH, PANEL_NOT_INITIALIZED, PANEL_UNKNOWN_DATE, PANEL_SYNCED_WITH_MAIN, PANEL_COMMITS_AHEAD, PANEL_COMMITS_BEHIND, PANEL_BASE_COMMIT, PANEL_BASE_UNKNOWN, PANEL_BASE_MAIN_AHEAD } from './interactive-panel.js';
```
改为（删除 `PANEL_BASE_COMMIT`、`PANEL_BASE_UNKNOWN`、`PANEL_BASE_MAIN_AHEAD`，新增 `PANEL_SOURCE_BRANCH`）：
```typescript
import { PANEL_FOOTER_SHORTCUTS, PANEL_FOOTER_COUNTDOWN, PANEL_OVERFLOW_DOWN_HINT, PANEL_OVERFLOW_UP_HINT, PANEL_SNAPSHOT_SUMMARY, PANEL_NO_WORKTREES as PANEL_NO_WORKTREES_MSG, PANEL_PRESS_ENTER_TO_RETURN, PANEL_NOT_TTY, PANEL_TITLE, PANEL_CONFIGURED_BRANCH, PANEL_CONFIGURED_BRANCH_DELETED, PANEL_CONFIGURED_BRANCH_MISMATCH, PANEL_NOT_INITIALIZED, PANEL_UNKNOWN_DATE, PANEL_SYNCED_WITH_MAIN, PANEL_COMMITS_AHEAD, PANEL_COMMITS_BEHIND, PANEL_SOURCE_BRANCH } from './interactive-panel.js';
```

并将对应的 export 行：
```typescript
export { PANEL_FOOTER_SHORTCUTS, PANEL_FOOTER_COUNTDOWN, PANEL_OVERFLOW_DOWN_HINT, PANEL_OVERFLOW_UP_HINT, PANEL_SNAPSHOT_SUMMARY, PANEL_NO_WORKTREES_MSG, PANEL_PRESS_ENTER_TO_RETURN, PANEL_NOT_TTY, PANEL_TITLE, PANEL_CONFIGURED_BRANCH, PANEL_CONFIGURED_BRANCH_DELETED, PANEL_CONFIGURED_BRANCH_MISMATCH, PANEL_NOT_INITIALIZED, PANEL_UNKNOWN_DATE, PANEL_SYNCED_WITH_MAIN, PANEL_COMMITS_AHEAD, PANEL_COMMITS_BEHIND, PANEL_BASE_COMMIT, PANEL_BASE_UNKNOWN, PANEL_BASE_MAIN_AHEAD };
```
改为：
```typescript
export { PANEL_FOOTER_SHORTCUTS, PANEL_FOOTER_COUNTDOWN, PANEL_OVERFLOW_DOWN_HINT, PANEL_OVERFLOW_UP_HINT, PANEL_SNAPSHOT_SUMMARY, PANEL_NO_WORKTREES_MSG, PANEL_PRESS_ENTER_TO_RETURN, PANEL_NOT_TTY, PANEL_TITLE, PANEL_CONFIGURED_BRANCH, PANEL_CONFIGURED_BRANCH_DELETED, PANEL_CONFIGURED_BRANCH_MISMATCH, PANEL_NOT_INITIALIZED, PANEL_UNKNOWN_DATE, PANEL_SYNCED_WITH_MAIN, PANEL_COMMITS_AHEAD, PANEL_COMMITS_BEHIND, PANEL_SOURCE_BRANCH };
```

- [ ] **Step 4: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/constants/messages/status.ts src/constants/messages/interactive-panel.ts src/constants/messages/index.ts
git commit -m "refactor: replace STATUS_BASE_*/PANEL_BASE_* with STATUS_SOURCE_BRANCH/PANEL_SOURCE_BRANCH"
```

---

## Task 6: 清理 git-branch.ts 中的旧函数

**Files:**
- Modify: `src/utils/git-branch.ts`

- [ ] **Step 1: 删除 `truncateCommitMessage` 函数**

删除以下代码块（约第 165-176 行）：
```typescript
/**
 * 将 commit message 截断到指定长度
 * @param {string} message - 原始 commit message
 * @param {number} maxLength - 最大字符数
 * @returns {string} 截断后的 message
 */
function truncateCommitMessage(message: string, maxLength: number = 40): string {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.slice(0, maxLength)}…`;
}
```

- [ ] **Step 2: 删除 `getWorktreeBaseInfoAsync` 函数**

删除以下整个函数（约第 178-236 行）：
```typescript
/**
 * 异步获取 worktree 的创建基点信息
 * ...（完整 JSDoc）
 */
export async function getWorktreeBaseInfoAsync(
  worktreeBranch: string,
  mainBranch: string,
  cwd?: string,
): Promise<WorktreeBaseInfo> {
  // ... 函数体
}
```

- [ ] **Step 3: 删除文件顶部的 `WorktreeBaseInfo` import**

将：
```typescript
import type { WorktreeBaseInfo } from '../types/index.js';
```
整行删除（若该行只有此 import 则整行删除；若有其他 import 则仅删除 `WorktreeBaseInfo` 部分）。

- [ ] **Step 4: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/git-branch.ts
git commit -m "refactor: remove getWorktreeBaseInfoAsync and truncateCommitMessage"
```

---

## Task 7: 在 worktree 创建时写入 meta，删除时清理 meta

**Files:**
- Modify: `src/utils/worktree.ts`
- Modify: `src/commands/remove.ts`

- [ ] **Step 1: 修改 `src/utils/worktree.ts`**

在文件顶部的 import 区域，新增：
```typescript
import { writeWorktreeMeta } from './worktree-meta.js';
import { getMainWorkBranch } from './project-config.js';
```

在 `createWorktrees` 函数的串行创建循环中（`createValidateBranch(name)` 之后），新增写入 meta：
```typescript
for (const name of branchNames) {
  const worktreePath = join(projectDir, name);
  gitCreateWorktree(name, worktreePath);
  createValidateBranch(name);
  writeWorktreeMeta(projectName, name, getMainWorkBranch());  // 新增
  results.push({ path: worktreePath, branch: name });
  logger.info(`worktree 创建完成: ${worktreePath} (分支: ${name})`);
}
```

注意：`createWorktrees` 中已有 `getProjectName()` 调用，可复用其结果；`projectName` 需要在循环前获取（当前函数体内已有 `getProjectWorktreeDir()` → `getProjectName()` 调用，但未存储变量）。需要在函数开头获取：

```typescript
export function createWorktrees(branchName: string, count: number): WorktreeInfo[] {
  // 1. 分支名清理
  const sanitized = sanitizeBranchName(branchName);

  // 2. 生成分支名列表
  const branchNames = generateBranchNames(sanitized, count);

  // 3. 校验所有分支是否都不存在（在创建任何 worktree 之前）
  validateBranchesNotExist(branchNames);

  // 4. 确保项目 worktree 目录存在
  const projectDir = getProjectWorktreeDir();
  ensureDir(projectDir);

  // 获取项目名和主工作分支（用于写入 meta）
  const projectName = getProjectName();
  const sourceBranch = getMainWorkBranch();

  // 5. 串行创建 worktree 及对应验证分支
  const results: WorktreeInfo[] = [];
  for (const name of branchNames) {
    const worktreePath = join(projectDir, name);
    gitCreateWorktree(name, worktreePath);
    createValidateBranch(name);
    writeWorktreeMeta(projectName, name, sourceBranch);  // 新增
    results.push({ path: worktreePath, branch: name });
    logger.info(`worktree 创建完成: ${worktreePath} (分支: ${name})`);
  }

  return results;
}
```

对 `createWorktreesByBranches` 做相同处理：

```typescript
export function createWorktreesByBranches(branchNames: string[]): WorktreeInfo[] {
  // 1. 校验所有分支是否都不存在
  validateBranchesNotExist(branchNames);

  // 2. 确保项目 worktree 目录存在
  const projectDir = getProjectWorktreeDir();
  ensureDir(projectDir);

  // 获取项目名和主工作分支（用于写入 meta）
  const projectName = getProjectName();
  const sourceBranch = getMainWorkBranch();

  // 3. 串行创建 worktree 及对应验证分支
  const results: WorktreeInfo[] = [];
  for (const name of branchNames) {
    const worktreePath = join(projectDir, name);
    gitCreateWorktree(name, worktreePath);
    createValidateBranch(name);
    writeWorktreeMeta(projectName, name, sourceBranch);  // 新增
    results.push({ path: worktreePath, branch: name });
    logger.info(`worktree 创建完成: ${worktreePath} (分支: ${name})`);
  }

  return results;
}
```

- [ ] **Step 2: 修改 `src/commands/remove.ts`**

在文件顶部的 import 中，新增 `removeWorktreeMeta` 和 `removeProjectWorktreeMeta`：
```typescript
import {
  // ...现有导入...
  removeWorktreeMeta,
  removeProjectWorktreeMeta,
} from '../utils/index.js';
```

在移除循环中（`removeSnapshot(projectName, wt.branch)` 之后）新增：
```typescript
      removeSnapshot(projectName, wt.branch);
      removeWorktreeMeta(projectName, wt.branch);  // 新增
      printSuccess(MESSAGES.WORKTREE_REMOVED(wt.path));
```

在 `--all` 清理块中（`removeProjectSnapshots(projectName)` 之后）新增：
```typescript
  if (options.all) {
    removeProjectSnapshots(projectName);
    removeProjectWorktreeMeta(projectName);  // 新增
  }
```

- [ ] **Step 3: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/worktree.ts src/commands/remove.ts
git commit -m "feat: write/remove worktree-meta on create/remove"
```

---

## Task 8: 更新 status 命令 — 集成 sourceBranch

**Files:**
- Modify: `src/commands/status.ts`

- [ ] **Step 1: 修改 `src/commands/status.ts`**

**8a. 删除 import 中的 `getWorktreeBaseInfoAsync`**

将顶部 import 中的 `getWorktreeBaseInfoAsync` 删除，并新增 `readWorktreeSourceBranch`：
```typescript
import {
  // ...现有导入...
  readWorktreeSourceBranch,
} from '../utils/index.js';
```

同时删除 `loadProjectConfig` 导入（若只被 `getWorktreeBaseInfoAsync` 调用），以及 `checkBranchExists` 导入（若只被 `getWorktreeBaseInfoAsync` 调用）。

⚠️ 检查：`loadProjectConfig` 在 `collectStatus()` 中还被用于获取 `configuredMainBranch`，不能删除。`checkBranchExists` 在 `collectStatus()` 中还被用于 `configuredBranchExists`，不能删除。只删除 `getWorktreeBaseInfoAsync`。

**8b. 修改 `collectWorktreeDetailedStatusAsync` 函数签名**

删除 `mainBranch: string` 参数，因为不再需要传递主分支给 `getWorktreeBaseInfoAsync`。

将函数签名从：
```typescript
async function collectWorktreeDetailedStatusAsync(worktree: WorktreeInfo, projectName: string, mainBranch: string): Promise<WorktreeDetailedStatus>
```
改为：
```typescript
async function collectWorktreeDetailedStatusAsync(worktree: WorktreeInfo, projectName: string): Promise<WorktreeDetailedStatus>
```

**8c. 修改 `collectStatus()` 中的调用**

将：
```typescript
  const worktreeStatuses = await Promise.all(
    worktrees.map((wt) => collectWorktreeDetailedStatusAsync(wt, projectName, configuredMainBranch ?? '')),
  );
```
改为：
```typescript
  const worktreeStatuses = await Promise.all(
    worktrees.map((wt) => collectWorktreeDetailedStatusAsync(wt, projectName)),
  );
```

**8d. 修改 `collectWorktreeDetailedStatusAsync` 函数体**

删除 Promise.all 中的 `getWorktreeBaseInfoAsync` 调用，改为同步调用 `readWorktreeSourceBranch`：
```typescript
async function collectWorktreeDetailedStatusAsync(worktree: WorktreeInfo, projectName: string): Promise<WorktreeDetailedStatus> {
  // 3 个异步任务并行执行：提交差异、工作区状态、diff 统计
  const [divergence, porcelain, diffStat] = await Promise.all([
    countCommitDivergenceAsync(worktree.branch),
    detectStatusPorcelainAsync(worktree.path),
    countDiffStatAsync(worktree.path),
  ]);

  const changeStatus = detectChangeStatusFromPorcelain(porcelain, divergence.commitsAhead);
  const createdAt = getWorktreeCreatedTime(worktree.path);
  // 同步读取来源分支（文件 I/O 轻量，无需并行）
  const sourceBranch = readWorktreeSourceBranch(projectName, worktree.branch);

  return {
    path: worktree.path,
    branch: worktree.branch,
    changeStatus,
    commitsAhead: divergence.commitsAhead,
    commitsBehind: divergence.commitsBehind,
    snapshotTime: resolveSnapshotTime(projectName, worktree.branch),
    insertions: diffStat.insertions,
    deletions: diffStat.deletions,
    createdAt,
    sourceBranch,
  };
}
```

**8e. 删除 `printBaseInfoLine` 函数，改为在 `printWorktreeItem` 中直接渲染来源分支行**

删除整个 `printBaseInfoLine` 函数（约第 393-412 行）。

在 `printWorktreeItem` 中，将调用 `printBaseInfoLine(wt)` 的那行替换为：
```typescript
  // 来源主分支（无 meta 文件时静默跳过）
  if (wt.sourceBranch) {
    printInfo(`    ${chalk.gray(MESSAGES.STATUS_SOURCE_BRANCH(wt.sourceBranch))}`);
  }
```

- [ ] **Step 2: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: 编译成功或仅剩 interactive-panel-render.ts 相关报错

- [ ] **Step 3: Commit**

```bash
git add src/commands/status.ts
git commit -m "feat: integrate sourceBranch into status command"
```

---

## Task 9: 更新 interactive-panel-render.ts — 来源分支渲染

**Files:**
- Modify: `src/utils/interactive-panel-render.ts`

- [ ] **Step 1: 更新 import**

将顶部从 `constants/messages/index.js` 的导入行中，删除 `PANEL_BASE_COMMIT`、`PANEL_BASE_UNKNOWN`、`PANEL_BASE_MAIN_AHEAD`，新增 `PANEL_SOURCE_BRANCH`：

```typescript
import {
  PANEL_FOOTER_SHORTCUTS,
  PANEL_FOOTER_COUNTDOWN,
  PANEL_OVERFLOW_DOWN_HINT,
  PANEL_OVERFLOW_UP_HINT,
  PANEL_SNAPSHOT_SUMMARY,
  PANEL_NO_WORKTREES_MSG,
  PANEL_TITLE,
  PANEL_CONFIGURED_BRANCH,
  PANEL_CONFIGURED_BRANCH_DELETED,
  PANEL_CONFIGURED_BRANCH_MISMATCH,
  PANEL_NOT_INITIALIZED,
  PANEL_UNKNOWN_DATE,
  PANEL_SYNCED_WITH_MAIN,
  PANEL_COMMITS_AHEAD,
  PANEL_COMMITS_BEHIND,
  PANEL_SOURCE_BRANCH,
} from '../constants/messages/index.js';
```

- [ ] **Step 2: 删除 `buildBaseInfoLine` 函数（约第 378-397 行）**

删除整个函数：
```typescript
/**
 * 构建单个 worktree 的创建基点信息行（面板简短版）
 * ...
 */
function buildBaseInfoLine(wt: WorktreeDetailedStatus, indent: string): string | null {
  const { baseInfo } = wt;
  // ...
}
```

- [ ] **Step 3: 修改 `renderWorktreeBlock` 中的来源分支渲染**

找到 `renderWorktreeBlock` 函数中调用 `buildBaseInfoLine` 的部分：
```typescript
  // 创建基点信息（来源于验证分支 HEAD commit，简短版）
  const baseInfoLine = buildBaseInfoLine(wt, indent);
  if (baseInfoLine) {
    lines.push(baseInfoLine);
  }
```

替换为：
```typescript
  // 来源主分支（无 meta 文件时静默跳过）
  if (wt.sourceBranch) {
    lines.push(`${indent}${PANEL_SOURCE_BRANCH(wt.sourceBranch)}`);
  }
```

- [ ] **Step 4: 编译验证**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | grep -E "error TS" | head -10
```

Expected: 编译成功或仅剩 list.ts 相关报错

- [ ] **Step 5: Commit**

```bash
git add src/utils/interactive-panel-render.ts
git commit -m "feat: integrate sourceBranch into interactive panel render"
```

---

## Task 10: 更新 list 命令 — 来源分支渲染

**Files:**
- Modify: `src/commands/list.ts`

- [ ] **Step 1: 修改 `src/commands/list.ts`**

**10a. 更新 import**

将顶部 import 中删除 `WorktreeBaseInfo` 类型导入（若存在）、`loadProjectConfig`、`getWorktreeBaseInfoAsync`，并新增 `readWorktreeSourceBranch`：

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { logger } from '../logger/index.js';
import type { ListOptions } from '../types/index.js';
import {
  runPreChecks,
  getProjectName,
  getProjectWorktrees,
  getWorktreeStatus,
  formatWorktreeStatus,
  isWorktreeIdle,
  printInfo,
  readWorktreeSourceBranch,
} from '../utils/index.js';
```

**10b. 修改 `printListAsText` 函数**

删除 `loadProjectConfig`/`getWorktreeBaseInfoAsync` 相关代码：
```typescript
  // 删除这两行：
  const mainBranch = loadProjectConfig()?.clawtMainWorkBranch ?? '';
  const baseInfoList = await Promise.all(
    worktrees.map((wt) => getWorktreeBaseInfoAsync(wt.branch, mainBranch)),
  );
```

在 for 循环中，删除 `const baseInfo = baseInfoList[i]` 这行，并替换 `printListBaseInfoLine(baseInfo)` 为：
```typescript
    // 来源主分支（无 meta 文件时静默跳过）
    const sourceBranch = readWorktreeSourceBranch(projectName, wt.branch);
    if (sourceBranch) {
      printInfo(`    ${chalk.gray(MESSAGES.STATUS_SOURCE_BRANCH(sourceBranch))}`);
    }
```

注意：`printListAsText` 参数中有 `projectName`，需要确认它已被传入。查看现有代码，`printListAsText(projectName, worktrees)` 签名已有 `projectName` 参数，直接使用即可。

**10c. 删除 `printListBaseInfoLine` 函数**

删除整个函数（约第 119-139 行）：
```typescript
/**
 * 输出 list 命令中单个 worktree 的创建基点信息行
 * ...
 */
function printListBaseInfoLine(baseInfo: WorktreeBaseInfo): void {
  // ...
}
```

- [ ] **Step 2: 全量编译**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | tail -10
```

Expected: 编译成功，无报错

- [ ] **Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: integrate sourceBranch into list command"
```

---

## Task 11: 更新测试文件

**Files:**
- Modify: `tests/unit/commands/status.test.ts`
- Modify: `tests/unit/commands/list.test.ts`

- [ ] **Step 1: 修改 `tests/unit/commands/status.test.ts`**

**11a. 从 MESSAGES mock 中删除 `STATUS_BASE_*` 常量，新增 `STATUS_SOURCE_BRANCH`**

在 `vi.mock('../../../src/constants/index.js', ...)` 中的 `MESSAGES` 对象：

删除：
```typescript
      STATUS_BASE_COMMIT: (hash: string, message: string) => `基于 ${hash} · "${message}"`,
      STATUS_BASE_UNKNOWN: '基于 (基点未知)',
      STATUS_BASE_MAIN_AHEAD: (count: number) => `↑ 主分支已推进 ${count} 个提交`,
      STATUS_BASE_MAIN_AHEAD_WITH_HINT: (count: number) => `↑ 主分支已推进 ${count} 个提交，可执行 clawt sync`,
```

新增：
```typescript
      STATUS_SOURCE_BRANCH: (branchName: string) => `来自 ${branchName}`,
```

**11b. 从 utils mock 中删除 `getWorktreeBaseInfoAsync`，新增 `readWorktreeSourceBranch`**

在 `vi.mock('../../../src/utils/index.js', ...)` 中：

删除：
```typescript
  loadProjectConfig: vi.fn().mockReturnValue(null),
  checkBranchExists: vi.fn().mockReturnValue(true),
  // 新增：返回默认的"基点未知"状态，避免测试依赖真实 git 命令
  getWorktreeBaseInfoAsync: vi.fn().mockResolvedValue({
    validateBranchExists: false,
    baseCommitHash: null,
    baseCommitMessage: null,
    mainBranchAhead: null,
  }),
```

新增（保留 `loadProjectConfig` 和 `checkBranchExists`，仅删除 `getWorktreeBaseInfoAsync`，新增 `readWorktreeSourceBranch`）：
```typescript
  loadProjectConfig: vi.fn().mockReturnValue(null),
  checkBranchExists: vi.fn().mockReturnValue(true),
  readWorktreeSourceBranch: vi.fn().mockReturnValue(null),
```

**11c. 新增测试用例：验证 `sourceBranch` 字段出现在 JSON 输出中**

在 `describe('handleStatus', () => {` 末尾新增：

```typescript
  it('sourceBranch 字段包含在 JSON 输出中', async () => {
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    // mock readWorktreeSourceBranch 返回 'develop'
    const { readWorktreeSourceBranch } = await import('../../../src/utils/index.js');
    vi.mocked(readWorktreeSourceBranch).mockReturnValue('develop');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerStatusCommand(program);
    await program.parseAsync(['status', '--json'], { from: 'user' });

    const jsonCall = consoleSpy.mock.calls.find((call) => {
      try { JSON.parse(call[0]); return true; } catch { return false; }
    });
    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.worktrees[0].sourceBranch).toBe('develop');
  });
```

- [ ] **Step 2: 修改 `tests/unit/commands/list.test.ts`**

**12a. 从 MESSAGES mock 中删除 `STATUS_BASE_*` 常量，新增 `STATUS_SOURCE_BRANCH`**

在 `vi.mock('../../../src/constants/index.js', ...)` 中的 `MESSAGES` 对象：

删除：
```typescript
      STATUS_BASE_COMMIT: (hash: string, message: string) => `基于 ${hash} · "${message}"`,
      STATUS_BASE_UNKNOWN: '基于 (基点未知)',
      STATUS_BASE_MAIN_AHEAD: (count: number) => `↑ 主分支已推进 ${count} 个提交`,
```

新增：
```typescript
      STATUS_SOURCE_BRANCH: (branchName: string) => `来自 ${branchName}`,
```

**12b. 从 utils mock 中删除 `loadProjectConfig`、`getWorktreeBaseInfoAsync`，新增 `readWorktreeSourceBranch`**

将：
```typescript
  // 新增：提供默认 mock，返回基点未知的默认值
  loadProjectConfig: vi.fn().mockReturnValue(null),
  getWorktreeBaseInfoAsync: vi.fn().mockResolvedValue({
    validateBranchExists: false,
    baseCommitHash: null,
    baseCommitMessage: null,
    mainBranchAhead: null,
  }),
```
改为：
```typescript
  readWorktreeSourceBranch: vi.fn().mockReturnValue(null),
```

**12c. 新增测试用例：验证文本输出包含"来自"行**

在 `describe('handleList', () => {` 末尾新增：

```typescript
  it('来源分支非空时文本输出包含"来自"行', async () => {
    mockedGetProjectName.mockReturnValue('test-project');
    mockedGetProjectWorktrees.mockReturnValue([
      { path: '/path/feature', branch: 'feature' },
    ]);
    mockedGetWorktreeStatus.mockReturnValue({
      commitCount: 0, insertions: 0, deletions: 0, hasDirtyFiles: false,
    });
    const { readWorktreeSourceBranch } = await import('../../../src/utils/index.js');
    vi.mocked(readWorktreeSourceBranch).mockReturnValue('develop');

    const program = new Command();
    program.exitOverride();
    registerListCommand(program);
    await program.parseAsync(['list'], { from: 'user' });

    const printedLines = mockedPrintInfo.mock.calls.map((call) => call[0] as string);
    const sourceBranchLine = printedLines.find((line) => line.includes('来自'));
    expect(sourceBranchLine).toBeDefined();
  });
```

- [ ] **Step 3: 运行全量测试**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm test 2>&1 | tail -30
```

Expected: 所有测试通过（已知 pre-existing 失败项：`shell.test.ts` timeout、`conflict-resolver.test.ts` 0 tests、`git-lock.test.ts` timing 问题，这些与本次修改无关）

- [ ] **Step 4: 最终全量编译**

```bash
cd /Users/qihoo/Documents/A_Own/clawt && pnpm build 2>&1 | tail -5
```

Expected: 编译成功

- [ ] **Step 5: Commit**

```bash
git add tests/unit/commands/status.test.ts tests/unit/commands/list.test.ts
git commit -m "test: update mocks and add sourceBranch assertions"
```

---

## Self-Review

对照规范文件 `docs/superpowers/specs/2026-04-22-worktree-source-branch-design.md` 检查：

| 规范要求 | 对应任务 | 状态 |
|---------|---------|------|
| `WORKTREE_META_DIR` 常量 | Task 1 | ✓ |
| `worktree-meta.ts` 5 个函数 | Task 2 | ✓ |
| 导出新函数，删除旧导出 | Task 3 | ✓ |
| 删除 `WorktreeBaseInfo` | Task 4 | ✓ |
| `sourceBranch: string \| null` 字段 | Task 4 | ✓ |
| 消息常量更新 | Task 5 | ✓ |
| 删除 git-branch.ts 中旧函数 | Task 6 | ✓ |
| createWorktrees/createWorktreesByBranches 写入 meta | Task 7 | ✓ |
| remove 命令清理 meta | Task 7 | ✓ |
| status 命令集成 sourceBranch | Task 8 | ✓ |
| status -i 面板集成 | Task 9 | ✓ |
| list 命令集成 | Task 10 | ✓ |
| 测试更新 | Task 11 | ✓ |
| worktree-meta.ts 单元测试 | Task 2 | ✓ |
| pnpm build + pnpm test 通过 | Task 11 Step 3-4 | ✓ |

**类型一致性检查：**
- `WorktreeDetailedStatus.sourceBranch: string | null`（Task 4 定义）
- `collectWorktreeDetailedStatusAsync` 返回 `sourceBranch`（Task 8 使用）✓
- `renderWorktreeBlock` 使用 `wt.sourceBranch`（Task 9 使用）✓
- `printWorktreeItem` 使用 `wt.sourceBranch`（Task 8 使用）✓
- `readWorktreeSourceBranch` 签名：`(projectName, branchName) => string | null`（Task 2 定义）
- Task 8/10 均传入 `projectName` + `wt.branch`（与 Task 2 签名一致）✓
