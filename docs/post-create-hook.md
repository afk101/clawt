### postCreate Hook 机制

#### 概述

postCreate hook 是在 worktree 创建完成后自动执行的钩子命令，可用于执行任意初始化操作（如安装依赖、生成配置文件、编译资源等）。`create` 和 `run` 命令在创建 worktree 之后，会尝试解析并执行 postCreate hook。

hook 以 **fire-and-forget** 模式后台异步并行执行，不阻塞主流程（不 await）。执行结果仅写入日志，不影响后续 Claude Code 的启动或系统提示。

#### 配置方式

支持两种配置方式，按优先级从高到低：

| 优先级 | 配置方式 | 来源标识 | 说明 |
| --- | --- | --- | --- |
| 1 | 项目配置 `postCreate` 字段 | `projectConfig` | 通过 `clawt init show` 交互式设置，或直接编辑 `~/.clawt/projects/<projectName>/config.json` |
| 2 | 项目仓库 `.clawt/postCreate.sh` 脚本 | `postCreateScript` | 在项目根目录下创建 `.clawt/postCreate.sh` 脚本文件 |

**配置方式 1 — 项目配置：**

```bash
# 通过 init show 交互式设置
clawt init show
# 选择 postCreate 配置项，输入命令（如 npm install）

# 或直接编辑配置文件
# ~/.clawt/projects/<projectName>/config.json
{
  "clawtMainWorkBranch": "main",
  "postCreate": "npm install"
}
```

**配置方式 2 — postCreate.sh 脚本：**

```bash
# 在项目根目录创建脚本
mkdir -p .clawt
cat > .clawt/postCreate.sh << 'EOF'
#!/bin/bash
npm install
EOF
chmod +x .clawt/postCreate.sh
```

> **自动权限修复**：如果检测到 `.clawt/postCreate.sh` 文件存在但不可执行，会自动尝试 `chmod +x` 添加执行权限。自动 chmod 失败时会打印警告，提示用户手动添加权限。

#### 命令行选项

`create` 和 `run` 命令均支持 `--post-create` / `--no-post-create` 选项：

```bash
# 默认行为：自动执行 postCreate hook（如果已配置）
clawt create -b feat
clawt run -b feat

# 跳过 postCreate hook
clawt create -b feat --no-post-create
clawt run -b feat --no-post-create
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--post-create` | `true` | 执行 postCreate hook（默认开启） |
| `--no-post-create` | — | 跳过 postCreate hook |

#### 执行流程

```
创建 worktree 完成
       ↓
  --no-post-create？ ── 是 ──→ 跳过，打印提示，直接返回
       ↓ 否
  解析 hook 配置
       ↓
  有配置？ ── 否 ──→ 打印"未配置"，直接返回
       ↓ 是
  打印 hook 来源 + 后台执行提示
       ↓
  fire-and-forget：异步并行启动所有 worktree 的 hook
  （spawn + shell: true + stdio: 'ignore'，不阻塞主流程）
       ↓
  主流程继续执行（输出日志、启动 Claude Code 等）
       ↓
  后台 hook 完成后写入日志汇总（成功数 + 失败数）
```

#### 解析优先级（resolvePostCreateHook）

解析函数 `resolvePostCreateHook()`（位于 `src/hooks/post-create.ts`）按以下优先级查找 hook 配置：

1. **项目配置**：读取 `loadProjectConfig()` 的 `postCreate` 字段，非空则使用
2. **postCreate.sh 脚本**：检查主 worktree 路径下的 `.clawt/postCreate.sh` 是否存在

两者都不存在时返回 `null`，表示无 hook 配置。

#### 执行细节

- **执行方式**：通过 `spawn(hook.command, { cwd: worktree.path, stdio: 'ignore', shell: true })` 在每个 worktree 目录下异步并行执行（`Promise.all`）
- **失败处理**：单个 worktree 的 hook 执行失败（非零退出码或异常）仅写入日志，不阻塞其他 worktree 和后续流程
- **结果汇总**：后台执行完毕后通过 `.then()` 回调写入日志汇总（成功数 + 失败数）
- **返回值**：`runPostCreateHooks()` 返回 `void`——以 fire-and-forget 模式后台执行，不等待结果

#### 系统提示

Claude Code 启动时统一使用 `APPEND_SYSTEM_PROMPT` 常量（定义在 `src/constants/config.ts`）作为 `--append-system-prompt` 参数值，内容为通用的 worktree 目录提示，不因 hook 执行结果而变化。

#### 相关类型定义

类型定义位于 `src/types/postCreateHook.ts`：

| 类型 | 说明 |
| --- | --- |
| `PostCreateHookSource` | hook 来源枚举类型：`'projectConfig'` \| `'postCreateScript'` |
| `PostCreateHookResult` | 单个 worktree 的 hook 执行结果，包含 `worktreePath`、`branch`、`success`、`source`、`error?` |
| `ResolvedHook` | hook 解析结果，包含 `command`（待执行命令）和 `source`（来源） |

#### 提示消息

消息常量定义在 `src/constants/messages/post-create.ts`：

| 消息 | 说明 |
| --- | --- |
| `HOOK_SKIPPED` | `--no-post-create` 跳过时的提示 |
| `HOOK_NOT_CONFIGURED` | 未配置 hook 时的提示 |
| `HOOK_SOURCE_INFO(source)` | hook 来源信息 |
| `HOOK_EXECUTING(branch, command)` | hook 开始执行提示 |
| `HOOK_SUCCESS(branch)` | hook 执行成功提示 |
| `HOOK_FAILED(branch, error)` | hook 执行失败警告 |
| `HOOK_SUMMARY(succeeded, failed)` | hook 执行汇总 |
| `HOOK_BACKGROUND_START(count, command)` | hook 后台执行中提示（worktree 数量和命令） |
| `POST_CREATE_SCRIPT_AUTO_CHMOD(path)` | postCreate.sh 自动添加执行权限提示 |
| `POST_CREATE_SCRIPT_NOT_EXECUTABLE(path)` | postCreate.sh 不可执行且自动 chmod 失败时的降级提示 |

#### 实现要点

- hook 解析和执行逻辑位于 `src/hooks/post-create.ts`，通过 `src/hooks/index.ts` 导出
- 入口函数 `runPostCreateHooks` 由 `src/utils/index.ts` 统一导出
- `create` 命令在 `createWorktrees()` 之后调用 `runPostCreateHooks(worktrees, !options.postCreate)`（fire-and-forget，不 await）
- `run` 命令在 `createWorktrees()` / `createWorktreesByBranches()` 之后调用 `runPostCreateHooks(worktrees, !options.postCreate)`（fire-and-forget，不 await）
- hook 内部通过 `executePostCreateHooks()` 并行启动所有 worktree 的子进程，`.then()` 回调写入日志汇总

---
