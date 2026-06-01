# validate 被忽略文件冲突检测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 validate 的 patch apply 之前检测被 `.gitignore` 忽略的残留文件（幽灵文件），输出清晰的错误提示和清理命令，替代当前误导性的 "diverged too far" 信息。

**Architecture:** 在 `migrateChangesViaPatch` 中，`git apply` 之前新增检测步骤：通过 `git diff --name-only` 获取 patch 文件列表 → `git check-ignore` 筛选被忽略的文件 → `fs.existsSync` 确认物理存在 → 有冲突则输出提示并返回失败。

**Tech Stack:** TypeScript, Node.js, Git CLI (`git check-ignore`, `git diff --name-only`), Vitest

---

### Task 1: 新增 `gitCheckIgnored` 函数

**Files:**
- Modify: `src/utils/git-core.ts`
- Test: `tests/unit/utils/git-core.test.ts`（新建）

- [ ] **Step 1: 编写 `gitCheckIgnored` 的失败测试**

```typescript
// tests/unit/utils/git-core.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gitCheckIgnored } from '../../../src/utils/git-core.js';

// mock execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
const mockExecSync = vi.mocked(execSync);

describe('gitCheckIgnored', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空数组输入时返回空数组', () => {
    const result = gitCheckIgnored([]);
    expect(result).toEqual([]);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('全部被忽略时返回全部路径', () => {
    mockExecSync.mockReturnValue('docs/superpowers/a.md\ndocs/superpowers/b.md\n');
    const result = gitCheckIgnored(['docs/superpowers/a.md', 'docs/superpowers/b.md']);
    expect(result).toEqual(['docs/superpowers/a.md', 'docs/superpowers/b.md']);
  });

  it('全部不被忽略时返回空数组', () => {
    // git check-ignore 无匹配时退出码为 1，execSync 抛出异常
    mockExecSync.mockImplementation(() => { throw new Error('exit code 1'); });
    const result = gitCheckIgnored(['src/index.ts']);
    expect(result).toEqual([]);
  });

  it('混合场景时仅返回被忽略的路径', () => {
    mockExecSync.mockReturnValue('docs/superpowers/a.md\n');
    const result = gitCheckIgnored(['docs/superpowers/a.md', 'src/index.ts']);
    expect(result).toEqual(['docs/superpowers/a.md']);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/utils/git-core.test.ts`
Expected: FAIL — `gitCheckIgnored` 未定义

- [ ] **Step 3: 实现 `gitCheckIgnored`**

在 `src/utils/git-core.ts` 中新增：

```typescript
/**
 * 批量检测文件是否被 .gitignore 忽略
 * 使用 git check-ignore 命令，退出码 1 表示无匹配（非错误）
 * @param {string[]} paths - 要检测的文件路径列表
 * @param {string} [cwd] - 工作目录
 * @returns {string[]} 被忽略的文件路径列表
 */
export function gitCheckIgnored(paths: string[], cwd?: string): string[] {
  if (paths.length === 0) return [];

  try {
    const output = execSync(`git check-ignore ${paths.map(p => `"${p}"`).join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // git check-ignore 退出码 1 表示无匹配文件，属于正常情况
    return [];
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/utils/git-core.test.ts`
Expected: PASS

- [ ] **Step 5: 在 `src/utils/index.ts` 中导出**

在 `src/utils/index.ts` 的 git-core 导出块中添加 `gitCheckIgnored`：

```typescript
// 在现有的 git-core 导出列表中添加 gitCheckIgnored
```

具体位置：在 `export { ... } from './git.js'` 块中添加 `gitCheckIgnored`（因为 `git.ts` 通过 `export * from './git-core.js'` 重导出）。

- [ ] **Step 6: 提交**

```bash
git add src/utils/git-core.ts src/utils/index.ts tests/unit/utils/git-core.test.ts
git commit -m "feat: add gitCheckIgnored for batch gitignore detection"
```

---

### Task 2: 新增 `detectIgnoredFilesInPatch` 函数

**Files:**
- Modify: `src/utils/validate-core.ts`
- Test: `tests/unit/utils/validate-core.test.ts`（新建）

- [ ] **Step 1: 编写 `detectIgnoredFilesInPatch` 的失败测试**

```typescript
// tests/unit/utils/validate-core.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/git-core.js', async () => {
  const actual = await vi.importActual('../../../src/utils/git-core.js');
  return { ...actual, gitCheckIgnored: vi.fn(), execSync: vi.fn() };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

import { detectIgnoredFilesInPatch } from '../../../src/utils/validate-core.js';
import { gitCheckIgnored } from '../../../src/utils/git-core.js';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const mockGitCheckIgnored = vi.mocked(gitCheckIgnored);
const mockExistsSync = vi.mocked(existsSync);
const mockExecSync = vi.mocked(execSync);

describe('detectIgnoredFilesInPatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无幽灵文件时返回空数组', () => {
    mockExecSync.mockReturnValue('src/a.ts\nsrc/b.ts\n');
    mockGitCheckIgnored.mockReturnValue([]);
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual([]);
  });

  it('检测到幽灵文件时返回文件列表', () => {
    mockExecSync.mockReturnValue('docs/superpowers/a.md\nsrc/b.ts\n');
    mockGitCheckIgnored.mockReturnValue(['docs/superpowers/a.md']);
    mockExistsSync.mockImplementation((p: string) => p === '/main/docs/superpowers/a.md');
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual(['docs/superpowers/a.md']);
  });

  it('被忽略但物理不存在的文件不包含在结果中', () => {
    mockExecSync.mockReturnValue('docs/superpowers/a.md\n');
    mockGitCheckIgnored.mockReturnValue(['docs/superpowers/a.md']);
    mockExistsSync.mockReturnValue(false);
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual([]);
  });

  it('git diff --name-only 失败时返回空数组（降级）', () => {
    mockExecSync.mockImplementation(() => { throw new Error('fatal'); });
    const result = detectIgnoredFilesInPatch('feature', '/main');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/utils/validate-core.test.ts`
Expected: FAIL — `detectIgnoredFilesInPatch` 未定义

- [ ] **Step 3: 实现 `detectIgnoredFilesInPatch`**

在 `src/utils/validate-core.ts` 中新增：

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { EXEC_MAX_BUFFER } from '../constants/index.js';

/**
 * 检测 patch 中被 .gitignore 忽略且物理存在于主 worktree 的文件（幽灵文件）
 * 这些文件会导致 git apply 失败（"已经存在于工作区中"）
 * @param {string} branchName - 目标分支名
 * @param {string} mainWorktreePath - 主 worktree 路径
 * @returns {string[]} 幽灵文件的相对路径列表
 */
export function detectIgnoredFilesInPatch(branchName: string, mainWorktreePath: string): string[] {
  let patchFiles: string[];
  try {
    const output = execSync(`git diff --name-only HEAD...${branchName}`, {
      cwd: mainWorktreePath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: EXEC_MAX_BUFFER,
    });
    patchFiles = output.trim().split('\n').filter(Boolean);
  } catch {
    // diff 失败时跳过检测，降级为当前行为（让 apply 自行报错）
    return [];
  }

  if (patchFiles.length === 0) return [];

  const ignoredFiles = gitCheckIgnored(patchFiles, mainWorktreePath);
  if (ignoredFiles.length === 0) return [];

  // 仅保留物理存在的文件（幽灵文件）
  return ignoredFiles.filter(file => existsSync(join(mainWorktreePath, file)));
}
```

注意：需要在文件顶部的 import 中添加 `gitCheckIgnored`（从 `./index.js` 导入）和 `EXEC_MAX_BUFFER`（从 `../constants/index.js` 导入）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/utils/validate-core.test.ts`
Expected: PASS

- [ ] **Step 5: 在 `src/utils/index.ts` 中导出**

在 `src/utils/index.ts` 的 validate-core 导出行中添加 `detectIgnoredFilesInPatch`：

```typescript
export { migrateChangesViaPatch, computeCurrentTreeHash, saveCurrentSnapshotTree, loadOldSnapshotToStage, switchToValidateBranch, detectIgnoredFilesInPatch } from './validate-core.js';
```

- [ ] **Step 6: 提交**

```bash
git add src/utils/validate-core.ts src/utils/index.ts tests/unit/utils/validate-core.test.ts
git commit -m "feat: add detectIgnoredFilesInPatch for ghost file detection"
```

---

### Task 3: 新增消息常量 `VALIDATE_IGNORED_FILES_CONFLICT`

**Files:**
- Modify: `src/constants/messages/validate.ts`

- [ ] **Step 1: 添加双语消息常量**

在 `src/constants/messages/validate.ts` 的 `VALIDATE_MESSAGES_I18N` 对象中，在 `VALIDATE_PATCH_APPLY_FAILED` 之后添加：

```typescript
  /** validate 检测到被 .gitignore 忽略的残留文件冲突 */
  VALIDATE_IGNORED_FILES_CONFLICT: {
    en: (files: string[], cleanCommands: string[]) => {
      const maxDisplay = 10;
      const displayed = files.slice(0, maxDisplay).map(f => `  - ${f}`).join('\n');
      const more = files.length > maxDisplay ? `\n  ...(${files.length} files total)` : '';
      const cmds = cleanCommands.map(c => `  ${c}`).join('\n');
      return `Ignored files left in main worktree are blocking patch apply:\n${displayed}${more}\n\nPlease clean up manually and retry:\n${cmds}`;
    },
    'zh-CN': (files: string[], cleanCommands: string[]) => {
      const maxDisplay = 10;
      const displayed = files.slice(0, maxDisplay).map(f => `  - ${f}`).join('\n');
      const more = files.length > maxDisplay ? `\n  ...（共 ${files.length} 个文件）` : '';
      const cmds = cleanCommands.map(c => `  ${c}`).join('\n');
      return `检测到被 .gitignore 忽略的文件残留在主 worktree 中，导致变更无法应用：\n${displayed}${more}\n\n请手动清理后重试：\n${cmds}`;
    },
  },
```

- [ ] **Step 2: 提交**

```bash
git add src/constants/messages/validate.ts
git commit -m "feat: add VALIDATE_IGNORED_FILES_CONFLICT message constant"
```

---

### Task 4: 修改 `migrateChangesViaPatch` 集成检测逻辑

**Files:**
- Modify: `src/utils/validate-core.ts`

- [ ] **Step 1: 修改 `migrateChangesViaPatch`**

在 `migrateChangesViaPatch` 函数中，`gitApplyFromStdin` 调用之前，添加幽灵文件检测逻辑：

```typescript
export function migrateChangesViaPatch(targetWorktreePath: string, mainWorktreePath: string, branchName: string, hasUncommitted: boolean): { success: boolean } {
  let didTempCommit = false;

  try {
    // 如果有未提交修改，先做临时 commit 以便 diff 能捕获全部变更
    if (hasUncommitted) {
      gitAddAll(targetWorktreePath);
      gitCommit('clawt:temp-commit-for-validate', targetWorktreePath);
      didTempCommit = true;
    }

    // 在主 worktree 执行三点 diff，获取目标分支自分叉点以来的全量变更
    const patch = gitDiffBinaryAgainstBranch(branchName, mainWorktreePath);

    // 检测被 .gitignore 忽略的残留文件（幽灵文件），在 apply 之前拦截
    const ignoredFiles = detectIgnoredFilesInPatch(branchName, mainWorktreePath);
    if (ignoredFiles.length > 0) {
      const cleanCommands = buildCleanCommands(ignoredFiles);
      logger.warn(`检测到 ${ignoredFiles.length} 个被忽略的残留文件冲突`);
      printWarning(MESSAGES.VALIDATE_IGNORED_FILES_CONFLICT(ignoredFiles, cleanCommands));
      return { success: false };
    }

    // 应用 patch 到主 worktree 工作目录
    if (patch.length > 0) {
      try {
        gitApplyFromStdin(patch, mainWorktreePath);
      } catch (error) {
        logger.warn(`patch apply 失败: ${error}`);
        printWarning(MESSAGES.VALIDATE_PATCH_APPLY_FAILED(branchName));
        return { success: false };
      }
    }

    return { success: true };
  } finally {
    // ...（finally 块保持不变）
  }
}
```

- [ ] **Step 2: 实现 `buildCleanCommands` 辅助函数**

在 `src/utils/validate-core.ts` 中新增（不导出，仅内部使用）：

```typescript
/**
 * 根据冲突文件列表生成 git clean 清理命令
 * 按直接父目录去重，生成针对性的清理命令
 * @param {string[]} files - 冲突文件的相对路径列表
 * @returns {string[]} 清理命令列表
 */
function buildCleanCommands(files: string[]): string[] {
  const dirs = new Set<string>();
  for (const file of files) {
    const lastSlash = file.lastIndexOf('/');
    const dir = lastSlash > 0 ? file.substring(0, lastSlash) : '.';
    dirs.add(dir);
  }
  return Array.from(dirs).map(dir => `git clean -fdx ${dir}/`);
}
```

- [ ] **Step 3: 确保 import 完整**

在 `src/utils/validate-core.ts` 顶部确认以下 import 存在：
- `MESSAGES` 从 `'../constants/index.js'`（已有）
- `printWarning` 从 `'./index.js'`（已有）
- `detectIgnoredFilesInPatch` 在同文件中定义，无需额外 import
- `buildCleanCommands` 在同文件中定义，无需额外 import

- [ ] **Step 4: 运行全部测试确认无回归**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/validate-core.ts
git commit -m "feat: integrate ghost file detection into migrateChangesViaPatch"
```

---

### Task 5: 集成验证

- [ ] **Step 1: 构建项目确认无编译错误**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 2: 运行全部测试**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 3: 提交全部变更（如有遗漏）**

```bash
git add -A
git commit -m "feat: detect ignored ghost files before patch apply in validate"
```
