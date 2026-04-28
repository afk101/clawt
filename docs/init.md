### 5.19 初始化项目级配置

**命令：**

```bash
# 设置主工作分支（使用当前分支）
clawt init

# 设置主工作分支（指定分支名）
clawt init -b <branchName>

# 交互式查看和修改项目配置
clawt init show

# 以 JSON 格式输出项目配置
clawt init show --json
```

**参数：**

| 参数/子命令 | 必填 | 说明 |
| --- | --- | --- |
| `-b` | 否 | 指定主工作分支名。不传则使用当前分支 |
| `show` | 否 | 交互式查看和修改项目配置 |
| `show --json` | 否 | 以 JSON 格式输出项目配置（跳过交互式流程） |

**功能说明：**

初始化项目级配置，将指定分支记录为该项目的主工作分支（`clawtMainWorkBranch`）。该配置用于 `create` / `run` 时检测当前分支是否为主工作分支，并在偏离时提醒用户。`init show` 子命令提供交互式面板，可查看和修改所有项目配置项（如 `validateRunCommand`、`postCreate`、`claudeCodeCommand`）。项目级配置的完整说明见 [project-config.md](./project-config.md)。

**运行流程（设置模式）：**

1. **主 worktree 校验** (2.1)
2. **加载现有配置**：尝试读取 `~/.clawt/projects/<projectName>/config.json`（可能为 `null`）
3. **确定主工作分支名**：
   - 传了 `-b` → 使用指定的分支名
   - 未传 `-b` → 先验证 HEAD 存在，再使用当前分支名（`git rev-parse --abbrev-ref HEAD`）
4. **合并并写入项目级配置**：将 `clawtMainWorkBranch` 合并到现有配置并写入 `~/.clawt/projects/<projectName>/config.json`
   - 配置文件不存在 → 创建新配置
   - 配置文件已存在 → 合并现有配置，仅更新 `clawtMainWorkBranch` 字段（保留其他配置项不变）
5. **输出成功提示**：
   - 已有配置 → `✓ 已将主工作分支从 <旧分支> 更新为 <新分支>`
   - 无已有配置 → `✓ 项目初始化成功，主工作分支设置为: <分支名>`

**运行流程（show 模式）：**

1. **主 worktree 校验** (2.1)
2. **项目配置校验**（`requireProjectConfig`）：读取 `~/.clawt/projects/<projectName>/config.json`
   - 配置不存在 → 抛出错误 `项目尚未初始化，请先执行 clawt init 设置主工作分支`
   - 配置缺少 `clawtMainWorkBranch` 字段 → 抛出错误 `项目配置缺少主工作分支信息，请重新执行 clawt init 设置主工作分支`
   - 配置存在且合法 → 继续
2.5. **`--json` 模式判断**：如果指定了 `--json` 选项，直接以 JSON 格式输出当前项目配置，跳过交互式流程并返回
3. **交互式配置编辑**：调用 `interactiveConfigEditor`（`src/utils/config-strategy.ts`），基于 `PROJECT_CONFIG_DEFINITIONS` 构建配置项列表（详见 [project-config.md](./project-config.md)）
   - 列出所有项目配置项，显示名称、当前值和描述
   - 用户选择配置项后，根据值类型自动选择输入方式（与全局配置的交互式编辑逻辑一致）
4. **持久化修改**：将修改后的值合并到当前配置，经 `normalizeProjectConfig` 归一化处理后写入配置文件（可选字段的空字符串会被移除，等同于未设置）
5. **输出成功提示**：`✓ 项目配置 <key> 已设置为 <value>`

**输出格式：**

```
# 首次初始化
✓ 项目初始化成功，主工作分支设置为: main

# 更新已有配置
✓ 已将主工作分支从 develop 更新为 main

# show 交互式修改成功
✓ 项目配置 validateRunCommand 已设置为 npm test

# show --json 输出
{"clawtMainWorkBranch":"main","validateRunCommand":"npm test","postCreate":"npm install"}

# show 未初始化（抛出错误）
项目尚未初始化，请先执行 clawt init 设置主工作分支

# show 配置缺少主工作分支字段（抛出错误）
项目配置缺少主工作分支信息，请重新执行 clawt init 设置主工作分支
```

**重复执行：** 支持重复执行，后一次会合并到现有配置中更新 `clawtMainWorkBranch`，不影响其他配置项。

**实现要点：**

- `init show` 子命令从 JSON 展示改为交互式面板，调用 `interactiveConfigEditor`（`src/utils/config-strategy.ts`）实现通用交互式配置编辑
- 配置项定义来自 `PROJECT_CONFIG_DEFINITIONS`（`src/constants/project-config.ts`），详见 [项目级配置文档](./project-config.md)
- 消息常量：`MESSAGES.INIT_SELECT_PROMPT`（选择配置项提示语）、`MESSAGES.INIT_SET_SUCCESS`（修改成功提示），定义在 `src/constants/messages/init.ts`
- `handleInitShow` 使用 `normalizeProjectConfig` 对修改后的配置进行归一化处理：可选字段（如 `validateRunCommand`、`postCreate`、`claudeCodeCommand`）设为空字符串时自动移除该键，避免 JSON 文件中出现冗余的 `"field": ""` 条目

---
