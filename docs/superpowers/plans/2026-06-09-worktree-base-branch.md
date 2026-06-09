# Worktree Base Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each clawt worktree's creation-time base branch in `status`, `status -i`, and `list`.

**Architecture:** Store per-worktree metadata under `~/.clawt/projects/<projectName>/worktrees/<branchName>.json` when worktrees are created. Enrich `WorktreeInfo` with `baseBranch` at the data layer so text, JSON, and interactive renderers share the same source.

**Tech Stack:** TypeScript, Commander, Vitest, Node `fs`/`path`, existing clawt utilities.

---

## File Structure

- Create: `src/utils/worktree-metadata.ts`
  - Single responsibility: generate metadata paths, save metadata, load metadata, remove metadata.
- Modify: `src/types/worktree.ts`
  - Add `baseBranch: string | null` to `WorktreeInfo`.
  - Add `WorktreeMetadata`.
- Modify: `src/types/status.ts`
  - Add `baseBranch: string | null` to `WorktreeDetailedStatus`.
- Modify: `src/utils/worktree.ts`
  - Capture current branch during creation, save metadata, read metadata when listing, remove metadata during cleanup.
- Modify: `src/commands/list.ts`
  - Include `baseBranch` in text and JSON output.
- Modify: `src/commands/status.ts`
  - Carry `baseBranch` into status data and render it in text output.
- Modify: `src/utils/interactive-panel-render.ts`
  - Render base branch line in `status -i`.
- Test: `tests/unit/utils/worktree-metadata.test.ts`
- Test: `tests/unit/utils/worktree.test.ts`
- Test: `tests/unit/commands/list.test.ts`
- Test: `tests/unit/commands/status.test.ts`
- Test: `tests/unit/utils/interactive-panel.test.ts`

### Task 1: Metadata Utility

**Files:**
- Create: `src/utils/worktree-metadata.ts`
- Modify: `src/types/worktree.ts`
- Test: `tests/unit/utils/worktree-metadata.test.ts`

- [ ] **Step 1: Write failing metadata path and save/load tests**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...actual,
    PROJECTS_CONFIG_DIR: '/tmp/clawt-projects',
  };
});

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  getWorktreeMetadataPath,
  loadWorktreeMetadata,
  saveWorktreeMetadata,
} from '../../../src/utils/worktree-metadata.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('worktree metadata', () => {
  it('生成项目 worktree 元数据路径', () => {
    expect(getWorktreeMetadataPath('demo', 'feature')).toBe('/tmp/clawt-projects/demo/worktrees/feature.json');
  });

  it('保存并读取来源分支元数据', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'feature',
      baseBranch: 'test',
      createdAt: '2026-06-09T10:30:00.000Z',
    }));

    saveWorktreeMetadata('demo', {
      branch: 'feature',
      baseBranch: 'test',
      createdAt: '2026-06-09T10:30:00.000Z',
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/clawt-projects/demo/worktrees/feature.json',
      expect.stringContaining('"baseBranch": "test"'),
      'utf-8',
    );
    expect(loadWorktreeMetadata('demo', 'feature')?.baseBranch).toBe('test');
  });

  it('元数据不存在时返回 null', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(loadWorktreeMetadata('demo', 'missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/utils/worktree-metadata.test.ts`
Expected: FAIL with module not found for `src/utils/worktree-metadata.js`.

- [ ] **Step 3: Add types and metadata utility**

```ts
/** worktree 来源分支元数据 */
export interface WorktreeMetadata {
  /** worktree 分支名 */
  branch: string;
  /** 创建 worktree 时所在的真实当前分支 */
  baseBranch: string;
  /** 元数据创建时间 */
  createdAt: string;
}
```

Implement `getWorktreeMetadataPath(projectName, branchName)`, `saveWorktreeMetadata(projectName, metadata)`, `loadWorktreeMetadata(projectName, branchName)`, and `removeWorktreeMetadata(projectName, branchName)` with Chinese JSDoc comments. Use `safeStringify()` for writes and `ensureDir()` for directory creation.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/utils/worktree-metadata.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/worktree-metadata.ts src/types/worktree.ts tests/unit/utils/worktree-metadata.test.ts
git commit -m "feat: add worktree metadata storage"
```

### Task 2: Save And Load Base Branch In Worktree Data

**Files:**
- Modify: `src/utils/worktree.ts`
- Modify: `src/utils/index.ts`
- Test: `tests/unit/utils/worktree.test.ts`

- [ ] **Step 1: Write failing worktree data tests**

Add tests asserting:

```ts
it('创建 worktree 时记录当前分支为来源分支', () => {
  mockedGetCurrentBranch.mockReturnValue('test');
  const result = createWorktrees('feature', 1);
  expect(result[0].baseBranch).toBe('test');
  expect(saveWorktreeMetadata).toHaveBeenCalledWith('my-project', {
    branch: 'feature',
    baseBranch: 'test',
    createdAt: expect.any(String),
  });
});

it('获取 worktree 时读取来源分支', () => {
  mockedLoadWorktreeMetadata.mockReturnValue({
    branch: 'feature',
    baseBranch: 'test',
    createdAt: '2026-06-09T10:30:00.000Z',
  });
  const result = getProjectWorktrees();
  expect(result[0].baseBranch).toBe('test');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/utils/worktree.test.ts`
Expected: FAIL because `baseBranch` is not returned and metadata functions are not called.

- [ ] **Step 3: Implement worktree metadata integration**

In `createWorktrees()` and `createWorktreesByBranches()`:

```ts
const projectName = getProjectName();
const baseBranch = getCurrentBranch();
```

After each successful worktree creation, call `saveWorktreeMetadata(projectName, { branch: name, baseBranch, createdAt: new Date().toISOString() })` and return `{ path, branch, baseBranch }`.

In `getProjectWorktrees()`, call `loadWorktreeMetadata(projectName, entry.name)` and return `baseBranch: metadata?.baseBranch ?? null`.

In `cleanupWorktrees()`, call `removeWorktreeMetadata(projectName, wt.branch)` inside the existing per-worktree cleanup `try` block after validate branch deletion.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/utils/worktree.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/worktree.ts src/utils/index.ts tests/unit/utils/worktree.test.ts
git commit -m "feat: track worktree base branches"
```

### Task 3: Show Base Branch In List

**Files:**
- Modify: `src/commands/list.ts`
- Test: `tests/unit/commands/list.test.ts`

- [ ] **Step 1: Write failing list output tests**

Add JSON assertion:

```ts
expect(parsed.worktrees[0].baseBranch).toBe('test');
```

Add text assertion:

```ts
expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('<- test'));
```

Add missing metadata assertion:

```ts
expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('未记录'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/commands/list.test.ts`
Expected: FAIL because `baseBranch` is not printed or serialized.

- [ ] **Step 3: Implement list JSON and text display**

In JSON output include:

```ts
baseBranch: wt.baseBranch,
```

In text output build one display helper:

```ts
/**
 * 格式化来源分支展示文本
 * @param {string | null} baseBranch - 来源分支
 * @returns {string} 来源分支展示文本
 */
function formatBaseBranchInline(baseBranch: string | null): string {
  const fallback = getCurrentLanguage() === 'en' ? 'Not recorded' : '未记录';
  return `<- ${baseBranch ?? fallback}`;
}
```

Use it in the first worktree line after `[${wt.branch}]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/commands/list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/list.ts tests/unit/commands/list.test.ts
git commit -m "feat: show base branch in list"
```

### Task 4: Show Base Branch In Status And Interactive Panel

**Files:**
- Modify: `src/types/status.ts`
- Modify: `src/commands/status.ts`
- Modify: `src/utils/interactive-panel-render.ts`
- Test: `tests/unit/commands/status.test.ts`
- Test: `tests/unit/utils/interactive-panel.test.ts`

- [ ] **Step 1: Write failing status tests**

Add JSON assertion:

```ts
expect(parsed.worktrees[0].baseBranch).toBe('test');
```

Add text assertion:

```ts
expect(mockedPrintInfo).toHaveBeenCalledWith(expect.stringContaining('来源分支: test'));
```

Add interactive renderer assertion:

```ts
const lines = renderWorktreeBlock({
  path: '/path/feature',
  branch: 'feature',
  baseBranch: 'test',
  changeStatus: 'clean',
  commitsAhead: 0,
  commitsBehind: 0,
  snapshotTime: null,
  insertions: 0,
  deletions: 0,
  createdAt: null,
}, false);
expect(lines.join('\n')).toContain('来源分支: test');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/commands/status.test.ts tests/unit/utils/interactive-panel.test.ts`
Expected: FAIL because status detail and renderer do not include `baseBranch`.

- [ ] **Step 3: Carry and render baseBranch**

In `collectWorktreeDetailedStatusAsync()`, add:

```ts
baseBranch: worktree.baseBranch,
```

In `printWorktreeItem()`, render:

```ts
printInfo(`    ${chalk.gray(formatBaseBranchLine(wt.baseBranch))}`);
```

In `renderWorktreeBlock()`, add the same line near the top after branch status or after diff line. Keep helper logic focused and documented with Chinese JSDoc.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/commands/status.test.ts tests/unit/utils/interactive-panel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/status.ts src/commands/status.ts src/utils/interactive-panel-render.ts tests/unit/commands/status.test.ts tests/unit/utils/interactive-panel.test.ts
git commit -m "feat: show base branch in status"
```

### Task 5: Documentation And Full Verification

**Files:**
- Modify: `docs/create.md`
- Modify: `docs/list.md`
- Modify: `docs/status.md`

- [ ] **Step 1: Update command docs**

Document:

```md
创建 worktree 时，clawt 会记录创建瞬间所在的真实当前分支为来源分支，并保存到 `~/.clawt/projects/<projectName>/worktrees/<branchName>.json`。
```

Update `list` and `status` JSON examples to include `"baseBranch": "test"` and explain `null` means not recorded.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run tests/unit/utils/worktree-metadata.test.ts tests/unit/utils/worktree.test.ts tests/unit/commands/list.test.ts tests/unit/commands/status.test.ts tests/unit/utils/interactive-panel.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Run type check or build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/create.md docs/list.md docs/status.md
git commit -m "docs: document worktree base branch metadata"
```
