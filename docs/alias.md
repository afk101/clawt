### 5.15 命令别名管理

**命令：**

```bash
# 列出所有命令别名
clawt alias
clawt alias list

# 设置命令别名
clawt alias set <alias> <command>

# 移除命令别名
clawt alias remove <alias>
```

**子命令：**

| 子命令 | 说明 |
| ------ | ---- |
| `clawt alias` / `clawt alias list` | 列出所有已配置的命令别名 |
| `clawt alias set <alias> <command>` | 设置命令别名，将 `<alias>` 映射到 `<command>` |
| `clawt alias remove <alias>` | 移除指定的命令别名 |

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `<alias>` | 是（set / remove） | 别名名称 |
| `<command>` | 是（set） | 目标内置命令名 |

**约束规则：**

1. **别名不能覆盖内置命令名**：别名不能与已注册的内置命令同名（`list`、`create`、`remove`、`run`、`resume`、`validate`、`merge`、`config`、`sync`、`reset`、`status`、`alias`）。如果用户尝试设置与内置命令同名的别名，报错退出
2. **目标必须是内置命令**：别名的目标（`<command>`）必须是已注册的内置命令名。如果指定了不存在的目标命令，报错退出
3. **参数透传**：通过别名调用时，所有选项和参数会完全透传给目标命令，行为与直接调用目标命令完全一致

**持久化：**

别名配置存储在 `~/.clawt/config.json` 的 `aliases` 字段中（类型 `Record<string, string>`，默认 `{}`）。

**运行流程：**

#### `alias list`（默认）

1. 读取配置文件中的 `aliases` 字段
2. 如果没有配置任何别名，输出提示 `当前没有配置任何命令别名`
3. 如果有别名，逐行输出所有别名映射

**输出格式：**

```
命令别名列表：

  l → list
  r → run
  v → validate
```

#### `alias set <alias> <command>`

1. **校验别名不与内置命令冲突**：检查 `<alias>` 是否为内置命令名，是则报错退出
2. **校验目标命令存在**：检查 `<command>` 是否为已注册的内置命令名，不是则报错退出
3. 将别名写入配置文件的 `aliases` 字段（如果别名已存在，覆盖旧值）
4. 输出成功提示

**输出格式：**

```
✓ 已设置别名: l → list
```

#### `alias remove <alias>`

1. 读取配置文件中的 `aliases` 字段
2. 检查指定的别名是否存在，不存在则报错退出
3. 从 `aliases` 中删除该别名并写入配置文件
4. 输出成功提示

**输出格式：**

```
✓ 已移除别名: l
```

**别名使用示例：**

```bash
# 设置别名
clawt alias set l list
clawt alias set r run
clawt alias set v validate

# 使用别名（等同于对应的完整命令）
clawt l          # 等同于 clawt list
clawt r task.md  # 等同于 clawt run task.md

# 查看所有别名
clawt alias list

# 移除别名
clawt alias remove l
```

---
