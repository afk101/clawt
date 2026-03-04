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

1. **主 worktree 校验** (2.1)
2. **项目级配置校验**：调用 `requireProjectConfig()` 检查项目是否已初始化
3. **获取分支信息**：
   - 通过 `getMainWorkBranch()` 获取主工作分支名
   - 通过 `getCurrentBranch()` 获取当前所在分支名
4. **判断是否需要切换**：
   - 当前分支 === 主工作分支 → 输出提示信息，无需切换
   - 当前分支 !== 主工作分支 → 调用 `ensureOnMainWorkBranch()` 执行切换
5. **输出结果**

**输出格式：**

```
# 已在主工作分支上
ℹ 已在主工作分支 main 上，无需切换

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
- 依赖 `validateMainWorktree`、`requireProjectConfig`、`ensureOnMainWorkBranch`、`getCurrentBranch`、`getMainWorkBranch` 等工具函数
- `requireProjectConfig()` 为显式调用，因为 home 命令不经过 `ensureOnMainWorkBranch()` 的隐式校验路径（仅在需要切换时才调用 `ensureOnMainWorkBranch()`）

---
