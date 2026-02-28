### 5.16 `clawt completion` 命令

为终端环境（bash/zsh）生成并安装 `clawt` 的命令、选项及参数的自动补全脚本。

#### 语法
```bash
clawt completion bash
clawt completion zsh
clawt completion install
```

#### 子命令说明

| 子命令    | 说明                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `bash`    | 输出适用于 bash 的补全脚本（用户可重定向到 `~/.bashrc`）                                |
| `zsh`     | 输出适用于 zsh 的补全脚本（用户可重定向到 `~/.zshrc`）                                  |
| `install` | 自动检测当前 shell 类型，将补全脚本追加到对应的配置文件中                                  |

#### `install` 子命令流程

1. 通过 `process.env.SHELL` 检测当前 shell 类型
2. 根据 shell 类型确定目标配置文件：
   - zsh → `~/.zshrc`（追加 `source <(clawt completion zsh)`）
   - bash → `~/.bashrc`（追加 `eval "$(clawt completion bash)"`）
3. 检查目标文件中是否已包含 `clawt completion`，已存在则跳过并提示
4. 追加成功后提示用户重启终端或 source 配置文件
5. 未知 shell 类型时输出警告，提示手动配置

#### 动态补全特性

补全脚本通过内部子命令 `_complete` 实现动态补全，不对外公开。补全引擎基于 Commander.js 的命令树结构遍历，支持以下场景：

| 场景                         | 补全行为                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `-b` / `--branch` 参数之后   | 动态列出当前项目所有 worktree 分支名（通过 `getProjectWorktrees`） |
| `-f` / `--file` 参数之后     | 动态列出匹配的文件和子目录（不限制文件类型，支持子目录递归浏览）    |
| `config set` / `config get` 之后 | 动态列出所有配置项键名（从 `CONFIG_DEFINITIONS` 获取）         |
| 输入以 `-` 开头              | 列出当前命令层级的可用选项（short/long）                       |
| 其他情况                     | 列出当前命令层级的可用子命令及别名                              |

**文件路径补全细节：**
- 支持子目录递归浏览（如 `tasks/` 后继续 Tab 可深入子目录）
- 目录候选项以 `/` 结尾，补全时不自动追加空格
- 不限制文件类型，列出所有非隐藏文件
- 跳过隐藏文件和目录（以 `.` 开头）

#### 实现说明

- 补全命令注册函数：`registerCompletionCommand()`（在 `src/commands/completion.ts`）
- 消息常量：`COMPLETION_MESSAGES`（在 `src/constants/messages/completion.ts`）
- 核心函数：`generateCompletions()` 解析当前输入上下文并输出候选项，`completeFilePath()` 处理文件路径补全
- shell 脚本生成：`getBashScript()`、`getZshScript()` 分别生成对应 shell 的补全脚本

---
