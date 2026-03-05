### 5.13 重置主 Worktree 工作区和暂存区

**命令：**

```bash
clawt reset
```

**无参数。**

**使用场景：**

当用户通过 `clawt validate` 将分支变更迁移到主 worktree 后，希望快速清除工作区和暂存区的所有修改，恢复到干净状态。与 `clawt validate --clean` 的区别在于：`reset` 仅重置工作区和暂存区，**不删除** validate 快照文件，也**不切换分支**，适用于只想清空变更而保留快照以便后续增量 validate 的场景。

> **设计原因**：reset 的职责是「重置工作区状态」，分支切换属于 validate --clean 和 remove 等命令的职责。将分支切换耦合到 reset 会违反单一职责原则。

**运行流程：**

1. **前置校验**（`runPreChecks`）：
   - `requireMainWorktree`：主 worktree 校验 (2.1)
   - `requireHead`：HEAD 存在校验
   - `requireProjectConfig`：项目级配置校验
2. **检测工作区状态**：通过 `git status --porcelain` 检测主 worktree 是否有未提交的更改
   - **工作区干净** → 输出提示 `主 worktree 工作区和暂存区已是干净状态，无需重置`，退出
   - **工作区不干净** → 继续
3. **确认破坏性操作**：如果配置项 `confirmDestructiveOps` 为 `true`，提示确认（显示即将执行的危险指令 `git reset --hard + git clean -fd` 和操作后果 `丢弃所有未提交的更改`），用户取消则输出 `已取消操作` 并退出
4. **重置工作区和暂存区**：
   ```bash
   git reset --hard HEAD
   git clean -fd
   ```
5. **输出成功提示**：
   ```
   ✓ 主 worktree 工作区和暂存区已重置
   ```

---
