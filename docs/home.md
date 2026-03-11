### 5.20 切换回主工作分支

**命令：**

```bash
clawt home
```

**参数：**

无参数。

**功能说明：**

快速切换回项目的主工作分支。当用户在主 worktree 中处于验证分支或其他分支时，可通过 `clawt home` 一键切换回 `clawtMainWorkBranch` 所记录的主工作分支。

**运行流程：**

1. **场景判断**：根据当前所在位置区分三种场景：
   - **场景 1：不在 git 仓库中** → 输出错误提示 `请在主 worktree 的根目录下执行 clawt`，退出
   - **场景 2：在子 worktree 中** → 输出提示信息，引导用户先 `cd` 到主 worktree 路径
   - **场景 3：在主 worktree 中** → 执行前置校验后切换到主工作分支
2. **前置校验**（仅场景 3）：调用 `runPreChecks` 执行统一前置校验：
   - `requireHead`：校验 HEAD 是否存在（仓库至少有一次 commit）
   - `requireProjectConfig`：校验项目配置文件是否存在且合法
   - `requireMainBranchExists`：校验配置中的主工作分支在 git 仓库中是否存在
3. **获取分支信息**（仅场景 3）：
   - 通过 `getMainWorkBranch()` 获取主工作分支名
   - 通过 `getCurrentBranch()` 获取当前所在分支名
4. **判断是否需要切换**：
   - 当前分支 === 主工作分支 → 输出提示信息，无需切换
   - 当前分支 !== 主工作分支 → 调用 `ensureOnMainWorkBranch()` 执行切换
5. **输出结果**

**输出格式：**

```
# 不在 git 仓库中
✗ 请在主 worktree 的根目录下执行 clawt

# 在子 worktree 中
💡 当前在子 worktree 中，请先切换到主 worktree：
  cd <主 worktree 路径>

# 已在主工作分支上
已在主工作分支 main 上，无需切换

# 切换成功
✓ 已从 clawt-validate-feat-login 切换到主工作分支 main
```

**消息常量：**

定义在 `src/constants/messages/home.ts`：

| 常量 | 说明 |
| --- | --- |
| `HOME_ALREADY_ON_MAIN(branch)` | 已在主工作分支上，无需切换 |
| `HOME_SWITCH_SUCCESS(from, to)` | 切换成功提示，显示原分支和目标分支 |
| `HOME_NOT_IN_MAIN_WORKTREE(mainPath)` | 在子 worktree 中，提示 cd 到主 worktree 路径 |

**实现要点：**

- 命令注册函数 `registerHomeCommand` 位于 `src/commands/home.ts`
- 不在 git 仓库中或在子 worktree 中的场景不需要 `runPreChecks`，直接在命令处理函数中判断并输出
- 前置校验通过 `runPreChecks` 统一调用，传入 `requireHead`、`requireProjectConfig`、`requireMainBranchExists` 三项校验（仅场景 3）
- 主逻辑依赖 `ensureOnMainWorkBranch`、`getCurrentBranch`、`getMainWorkBranch`、`isMainWorktree`、`isInsideGitRepo`、`getMainWorktreePath` 等工具函数
- `ensureOnMainWorkBranch()` 仅在需要切换时才调用（当前分支不等于主工作分支时）

---
