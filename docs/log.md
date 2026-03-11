### 5.9 日志系统

**日志目录：** `~/.clawt/logs/`

**日志文件命名：** `clawt-YYYY-MM-DD.log`（按日期滚动）

**日志级别：**

| 级别    | 说明               | 使用场景                               |
| ------- | ------------------ | -------------------------------------- |
| `debug` | 调试信息           | Git 命令执行详情、变量值等               |
| `info`  | 一般信息           | 操作开始/完成、创建/移除 worktree 等     |
| `warn`  | 警告信息           | 分支名被转换、非致命异常等              |
| `error` | 错误信息           | 命令执行失败、校验不通过等               |

**实现方案：** 使用 `winston` + `winston-daily-rotate-file` 库。

**日志格式：**

```
[2025-02-06 14:30:22] [INFO ] 创建 worktree: ~/.clawt/worktrees/main-project/feature-scheme-1
[2025-02-06 14:30:22] [DEBUG] 执行命令: git worktree add -b feature-scheme-1 ~/.clawt/worktrees/main-project/feature-scheme-1
[2025-02-06 14:30:23] [WARN ] 分支名已转换: feature/a.b → feature-a-b
[2025-02-06 14:30:25] [ERROR] 分支 feature-scheme-1 已存在，无法创建
```

**保留策略：**

- 日志文件保留 30 天
- 单个日志文件最大 10MB

#### `--debug` 控制台调试输出

通过全局选项 `--debug` 可将调试日志实时输出到终端，方便排查问题。

**实现机制：**

- 在 Commander.js 的 `preAction` 钩子中检测 `--debug` 选项，按需调用 `enableConsoleTransport()` 函数
- `enableConsoleTransport()` 动态向 winston 实例添加 `Console` transport（level 为 `debug`），该函数幂等，多次调用不会重复添加 transport
- 相关常量定义在 `src/constants/logger.ts`：
  - `DEBUG_TIMESTAMP_FORMAT`：时间戳格式（`HH:mm:ss.SSS`，精简，不含日期）

**控制台日志格式：**

```
HH:mm:ss.SSS LEVEL 消息内容
```

**日志级别颜色映射：**

| 级别    | 颜色   |
| ------- | ------ |
| `error` | 红色   |
| `warn`  | 黄色   |
| `info`  | 青色   |
| `debug` | 灰色   |

**使用示例：**

```bash
clawt run -b feature-login --debug
clawt validate -b feature-scheme --debug
```

> **注意：** `--debug` 选项不影响文件日志（file transport），文件日志始终按原有策略写入。控制台输出仅在传入 `--debug` 时启用。

---
