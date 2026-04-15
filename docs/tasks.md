### 5.22 任务文件管理

**命令：**

```bash
# 生成任务模板文件（默认输出到 .clawt/tasks/ 目录）
clawt tasks init

# 指定输出路径
clawt tasks init [path]
```

**子命令：**

| 子命令 | 说明 |
| ------ | ---- |
| `tasks init [path]` | 生成任务模板文件 |

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `[path]` | 否 | 输出文件路径。不传时默认输出到 `.clawt/tasks/clawt-tasks-<时间戳>.md` |

**功能说明：**

`tasks init` 子命令用于快速生成任务模板文件，方便用户创建 `clawt run -f` 所需的任务文件格式。模板文件包含格式说明注释和示例任务块。

**运行流程：**

1. **确定输出路径**：
   - 传了 `[path]` → 使用指定路径
   - 未传 → 默认输出到 `.clawt/tasks/clawt-tasks-<时间戳>.md`（由 `generateTaskFilename` 生成唯一文件名）
2. **路径转换**：将路径转为绝对路径（`path.resolve`）
3. **文件存在性校验**：如果目标文件已存在，抛出错误退出
4. **创建父目录**：确保输出路径的父目录存在（`ensureDir`）
5. **写入模板内容**：将 `TASK_TEMPLATE_CONTENT` 写入目标文件
6. **输出成功提示**：提示文件已创建，并给出使用提示（如 `clawt run -f <path>`）

**模板文件内容：**

```markdown
# Clawt 任务文件
#
# 使用方法: clawt run -f tasks.md
# 格式说明: 标签外的文本会被忽略，每个任务用 START/END 标签包裹
#
# 规则:
#   1. 每个任务块用 <START> 和 <END> 标签包裹（实际标签见下方示例）
#   2. 块内 # branch: <分支名> 声明分支名（使用 -b 参数时可省略）
#   3. 块内其余行为任务描述（支持多行）

<!-- CLAWT-TASKS:START -->
# branch: feat-example-1
在这里写第一个任务的描述
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch: feat-example-2
在这里写第二个任务的描述
支持多行描述
<!-- CLAWT-TASKS:END -->
```

**实现要点：**

- 命令注册函数 `registerTasksCommand` 位于 `src/commands/tasks.ts`
- 模板内容和常量定义在 `src/constants/tasks-template.ts`：
  - `TASK_TEMPLATE_OUTPUT_DIR`（`.clawt/tasks`）：默认输出目录
  - `TASK_TEMPLATE_FILENAME_PREFIX`（`clawt-tasks`）：文件名前缀
  - `TASK_TEMPLATE_CONTENT`：模板文件内容
- 消息常量定义在 `src/constants/messages/tasks.ts`

---
