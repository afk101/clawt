### 5.10 交互式查看和修改全局配置

**命令：**

```bash
# 交互式修改配置（等同于 config set 无参数）
clawt config

# 修改配置项（无参数进入交互式，有参数直接设置）
clawt config set [key] [value]

# 获取单个配置项的值
clawt config get <key>

# 将配置恢复为默认值
clawt config reset
```

#### 交互式修改配置（`config` / `config set`）

直接执行 `clawt config` 或 `clawt config set`（不带参数）进入交互式配置修改模式。

**运行流程：**

1. 读取全局配置文件 `~/.clawt/config.json`
2. 列出所有配置项供用户选择（`Enquirer.Select`），每项显示：
   - 配置项名称
   - 当前值（布尔值绿色/黄色，字符串和数字青色）
   - 配置项描述（暗淡色 dim）
   - 对象类型配置项（如 `aliases`）标灰不可选，提示用户通过专用命令管理
3. 用户选择某个配置项后，根据值类型自动选择提示策略：
   - **boolean 类型** → `Select`（true / false）
   - **number 类型** → `Input`（带数字校验）
   - **string 类型 + 有 `allowedValues`** → `Select`（枚举列表）
   - **string 类型 + 无 `allowedValues`** → `Input`（自由输入）
4. 将修改后的配置持久化到配置文件
5. 输出成功提示：`✓ <key> 已设置为 <value>`

#### 直接设置配置项（`config set <key> <value>`）

当带参数执行 `clawt config set <key> <value>` 时，直接修改指定配置项。

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `key` | 否 | 配置项名称（不传则进入交互式模式） |
| `value` | 否 | 配置值（传了 `key` 时必填） |

**运行流程：**

1. 校验 `key` 是否为有效的配置项名称（基于 `DEFAULT_CONFIG` 的键列表），无效则输出错误及可用配置项列表
2. 校验 `value` 是否缺失，缺失则提示：`缺少配置值，用法: clawt config set <key> <value>`
3. 根据目标配置项的类型解析并校验值：
   - **boolean** → 仅接受 `true` 或 `false`
   - **number** → `Number()` 解析，`NaN` 报错
   - **string + 有 `allowedValues`** → 校验值是否在枚举列表中
   - **string + 无 `allowedValues`** → 无额外校验
4. 加载配置、修改目标项、持久化
5. 输出成功提示：`✓ <key> 已设置为 <value>`

#### 获取单个配置项（`config get <key>`）

**参数：**

| 参数 | 必填 | 说明 |
| ---- | ---- | ---- |
| `key` | 是 | 配置项名称 |

**运行流程：**

1. 校验 `key` 是否为有效的配置项名称，无效则输出错误及可用配置项列表
2. 读取配置文件，获取目标配置项的值
3. 输出：`<key> = <value>`

#### 恢复默认配置（`config reset`）

**运行流程：**

1. 始终提示确认（显示即将执行的操作和后果：当前配置将被覆盖为默认值），不受 `confirmDestructiveOps` 配置控制。用户取消则退出
2. 将默认配置写入 `~/.clawt/config.json`（覆盖现有配置文件）
3. 输出成功提示：`✓ 配置已恢复为默认值`

**实现要点：**

- 配置项类型定义：`ConfigItemDefinition` 新增可选字段 `allowedValues`（`readonly string[]`），仅对 string 类型有效，用于枚举值校验和交互式 Select 提示
- 值解析与提示策略：`src/utils/config-strategy.ts` 中的 `parseConfigValue()`（CLI 字符串解析）和 `promptConfigValue()`（交互式提示），基于类型和 `allowedValues` 自动分发
- 交互式配置编辑：`handleInteractiveConfigSet` 调用通用的 `interactiveConfigEditor`（`src/utils/config-strategy.ts`），传入 `CONFIG_DEFINITIONS` 和 `disabledKeys`（对象类型配置项禁用映射），不再在 config 命令中直接构建选择列表和调用 `promptConfigValue`
- `saveConfig(config)`：`src/utils/config.ts` 中的通用配置写入函数，将完整配置对象持久化到文件
- `formatConfigValue(value)`：支持 boolean（绿色/黄色）和 string/number（青色）的格式化显示。`undefined` / `null` 值显示为暗淡色的 `(未设置)`
- 对象类型配置项（如 `aliases`）的显示逻辑在 `interactiveConfigEditor` 的列表构建中处理：通过 `JSON.stringify` 以暗淡色显示值，并标记为不可选（disabled），提示用户通过 `clawt alias` 命令管理

---
