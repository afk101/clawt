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

1. **前置校验**：调用 `runPreChecks` 执行统一前置校验：
   - `requireMainWorktree`：校验当前目录是否在主 worktree 根目录 (2.1)
   - `requireHead`：校验 HEAD 是否存在（仓库至少有一次 commit）
   - `requireProjectConfig`：校验项目配置文件是否存在且合法
   - `requireMainBranchExists`：校验配置中的主工作分支在 git 仓库中是否存在
2. **获取分支信息**：
   - 通过 `getMainWorkBranch()` 获取主工作分支名
   - 通过 `getCurrentBranch()` 获取当前所在分支名
3. **判断是否需要切换**：
   - 当前分支 === 主工作分支 → 输出提示信息，无需切换
   - 当前分支 !== 主工作分支 → 调用 `ensureOnMainWorkBranch()` 执行切换
4. **输出结果**

**输出格式：**

```
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

**实现要点：**

- 命令注册函数 `registerHomeCommand` 位于 `src/commands/home.ts`
- 前置校验通过 `runPreChecks` 统一调用，传入 `requireMainWorktree`、`requireHead`、`requireProjectConfig`、`requireMainBranchExists` 四项校验
- 主逻辑依赖 `ensureOnMainWorkBranch`、`getCurrentBranch`、`getMainWorkBranch`、`guardMainWorkBranchExists` 等工具函数
- `ensureOnMainWorkBranch()` 仅在需要切换时才调用（当前分支不等于主工作分支时）

---
