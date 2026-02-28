### 5.19 初始化项目级配置

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

初始化项目级配置，将指定分支记录为该项目的主工作分支（`clawtMainWorkBranch`）。该配置用于 `create` / `run` 时检测当前分支是否为主工作分支，并在偏离时提醒用户。详见 [2.6 项目级配置](#26-项目级配置)。

**运行流程（设置模式）：**

1. **主 worktree 校验** (2.1)
2. **确定主工作分支名**：
   - 传了 `-b` → 使用指定的分支名
   - 未传 `-b` → 使用当前分支名（`git rev-parse --abbrev-ref HEAD`）
3. **写入项目级配置**：将 `clawtMainWorkBranch` 写入 `~/.clawt/projects/<projectName>/config.json`
   - 配置文件不存在 → 创建
   - 配置文件已存在 → 覆盖整个配置文件内容
4. **输出成功提示**

**运行流程（show 模式）：**

1. **主 worktree 校验** (2.1)
2. **读取项目级配置**：读取 `~/.clawt/projects/<projectName>/config.json`
   - 配置不存在 → 抛出错误 `项目尚未初始化，请先执行 clawt init 设置主工作分支`
   - 配置存在 → 以 JSON 格式输出配置内容

**输出格式：**

```
# 首次初始化
✓ 项目初始化成功，主工作分支设置为: main

# 更新已有配置
✓ 已将主工作分支从 develop 更新为 main

# show 查看配置（JSON 格式输出）
{
  "clawtMainWorkBranch": "main"
}

# show 未初始化（抛出错误）
项目尚未初始化，请先执行 clawt init 设置主工作分支
```

**重复执行：** 支持重复执行，后一次覆盖前一次的配置。

---
