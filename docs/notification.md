### 5.3 任务完成通知机制

**触发条件：** 通过 `clawt run` 启动了多个 Claude Code 任务后自动进入通知模式。

**机制说明：**

Claude Code CLI 以 `--output-format stream-json --verbose` 运行时，stdout 会持续输出 JSON 行（每行一个事件），包括 `system`、`assistant`（含 `tool_use` 和 `text`）、`user`（含 `tool_result`）等类型。任务结束时输出 `type: "result"` 事件：

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 182809,
  "duration_api_ms": 0,
  "num_turns": 1,
  "result": "xxx",
  "stop_reason": "stop_sequence",
  "session_id": "e771e449-b695-48e7-8006-bbf3f0dd3e98",
  "total_cost_usd": 0,
  "usage": { ... }
}
```

**流式事件解析（`src/utils/stream-parser.ts`）：**

由于 stdout 的 `data` 事件可能在行中间切割，使用 `createLineBuffer()` 行缓冲器拼接完整行后，通过 `parseStreamLine()` 解析为 `StreamEvent` 对象，再由 `parseStreamEvent()` 提取活动信息（`ParsedActivity`）：

- **`tool_use` 类型**：提取工具名和文件路径/命令参数，格式如 `Read index.ts`、`Bash ls -la`
- **`text` 类型**：提取文本片段，格式如 `思考中: 让我分析一下`
- **`result` 类型**：构造 `ClaudeCodeResult` 对象，提取耗时、费用、结果文本等

活动描述文本最大长度为 `ACTIVITY_TEXT_MAX_LENGTH`（30 字符），超出后截断并追加省略号。结果预览文本最大长度为 `RESULT_PREVIEW_MAX_LENGTH`（40 字符）。

**事件监听与通知流程：**

1. 为每个 Claude Code 子进程维护状态（运行中 / 已完成 / 已失败）
2. 监听每个子进程的 `close` 事件（基于 Node.js `ChildProcess` 的事件驱动机制）
3. 在流式传输过程中实时解析每一行事件，当遇到 `type=result` 时保存到 `finalResult`；子进程触发 `close` 事件时，flush 行缓冲器并组装最终结果
4. 在主 worktree 的 clawt 终端实时输出通知。TTY 环境下使用进度面板，进度面板每个任务行第二列显示 worktree 路径（终端可点击跳转），运行中显示实时活动描述，完成/失败后显示结果预览。任务行格式示例：

```
[1/3] /path/to/worktree  ⠹ 运行中 1m23s  Read index.ts
[2/3] /path/to/worktree  ✓ 完成   2m05s  $0.08  任务已成功完成
[3/3] /path/to/worktree  ◦ 排队中
```

5. 先完成的先通知，**不需要**失败重试机制
6. 当所有任务完成后，输出汇总信息：

```
════════════════════════════════════════
全部任务已完成 (3/3)
  成功: 2
  失败: 1
  总耗时: 245.3s
  总花费: $0.15
════════════════════════════════════════
```

#### 进度面板渲染机制

进度面板由 `ProgressRenderer`（`src/utils/progress.ts`）负责渲染，渲染函数拆分到 `src/utils/progress-render.ts`。

**TTY 模式渲染策略（备选屏幕缓冲区）：**

- **进入备选屏幕**：`start()` 时通过 `ALT_SCREEN_ENTER`（`\x1B[?1049h`）进入终端备选屏幕缓冲区，隔离进度面板与主屏幕内容
- **禁用行换行**：通过 `LINE_WRAP_DISABLE`（`\x1B[?7l`）防止超长行自动折行，配合按终端宽度截断保证每行只占一行
- **每帧渲染**：使用 `CLEAR_SCREEN` + `CURSOR_HOME` 清屏后完全重绘，无需计算 `CURSOR_UP` 回退量，不受终端 reflow 影响
- **防闪烁**：每帧渲染使用 Synchronized Output（`SYNC_OUTPUT_START` / `SYNC_OUTPUT_END`），终端缓冲全部输出后一次性刷新
- **行宽截断**：通过 `truncateToTerminalWidth()`（`src/utils/progress-render.ts`）将含 ANSI 转义码的字符串截断到终端可见列数，使用 `string-width` 库正确计算中文/emoji 宽度
- **终端 resize 响应**：监听 `process.stdout` 的 `resize` 事件，窗口宽度变化时立即触发重绘
- **退出时恢复**：`stop()` 时恢复行换行、显示光标、退出备选屏幕，然后在主屏幕上重新输出最终面板状态（备选屏幕内容不保留）
- **异常退出兜底**：注册 `process.on('exit')` 处理器，确保即使异常退出也能恢复终端状态

**任务行格式：**

```
[1/3] /path/to/worktree  ⠹ 运行中 1m23s  Read index.ts
[2/3] /path/to/worktree  ✓ 完成   2m05s  $0.08  任务已成功完成
[3/3] /path/to/worktree  ◦ 排队中
```

- 第二列为 worktree 路径（`path.padEnd(maxPathWidth)` 对齐）
- 运行中状态：末尾显示实时活动描述文本（如工具名+文件名、思考中+文本片段）
- 完成/失败状态：末尾显示结果预览文本（从 `ClaudeCodeResult.result` 提取，最大 40 字符）

**非 TTY 降级模式：**

- 启动时输出 `[1/3] branch 启动 path`
- 完成时输出 `[1/3] branch ✓ 完成 duration cost detail`（`detail` 优先使用结果预览，无则回退到路径）
- 失败时输出 `[1/3] branch ✗ 失败 duration detail`

---
