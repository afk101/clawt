### 5.17 自动更新检查

CLI 在每次命令执行完毕后，根据配置项 `autoUpdate` 决定是否检查 npm registry 上的最新版本。当发现新版本时，以带边框的提示框在终端输出版本更新信息和升级命令。

#### 触发条件

- 配置项 `autoUpdate` 为 `true`（默认启用）
- 命令正常执行完毕后触发（在 `program.parseAsync()` 之后）

#### 检查流程

1. 读取缓存文件 `~/.clawt/update-check.json`
2. 判断缓存是否有效：
   - 缓存不存在或解析失败 → 视为过期
   - 缓存中的 `currentVersion` 与本地版本不一致 → 视为过期
   - 距离上次检查超过 24 小时 → 视为过期
3. **缓存有效**：直接使用缓存中的 `latestVersion` 与本地版本比较，有新版本则打印提示
4. **缓存过期**：向 npm registry 发起 HTTPS 请求获取最新版本号（5 秒超时），更新缓存文件后判断并打印提示

#### 缓存文件

**路径：** `~/.clawt/update-check.json`

**结构：**

```json
{
  "lastCheck": 1709000000000,
  "latestVersion": "2.18.0",
  "currentVersion": "2.17.1"
}
```

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `lastCheck` | `number` | 上次检查时间戳（毫秒） |
| `latestVersion` | `string` | 从 registry 获取的最新版本号 |
| `currentVersion` | `string` | 检查时的本地版本号 |

#### 版本比较

使用简易 semver 比较（不引入额外依赖），逐级比较 `major.minor.patch`：

- `latest > current` → 提示更新
- `latest <= current` → 不提示

#### 包管理器检测

更新提示中会显示与用户安装方式匹配的升级命令。检测逻辑依次尝试：

1. `pnpm list -g --depth=0 clawt` → 匹配则提示 `pnpm add -g clawt`
2. `yarn global list --depth=0` → 输出含 `clawt` 则提示 `yarn global add clawt`
3. 以上均未匹配 → 默认提示 `npm i -g clawt`

#### 提示框格式

当检测到新版本时，输出带 Unicode 圆角边框的居中提示框：

```
╭──────────────────────────────────────────────╮
│                                              │
│   clawt 有新版本可用: 2.17.1 → 2.18.0       │
│   执行 npm i -g clawt 进行更新               │
│                                              │
╰──────────────────────────────────────────────╯
```

版本号和命令使用 chalk 着色：当前版本红色、最新版本绿色、更新命令青色。

#### 容错设计

所有异常静默处理，不影响 CLI 正常功能：

- 网络请求失败或超时（5 秒） → 静默忽略
- registry 返回无效 JSON 或缺少 `version` 字段 → 静默忽略
- 缓存文件读写失败 → 静默忽略
- `checkForUpdates()` 入口函数的最外层 `try/catch` 确保任何未预期异常都不会中断 CLI

#### 常量定义

| 常量 | 值 | 位置 |
| ---- | -- | ---- |
| `UPDATE_CHECK_INTERVAL_MS` | `86400000`（24 小时） | `src/constants/update.ts` |
| `NPM_REGISTRY_URL` | `https://registry.npmjs.org/clawt/latest` | `src/constants/update.ts` |
| `NPM_REGISTRY_TIMEOUT_MS` | `5000` | `src/constants/update.ts` |
| `PACKAGE_NAME` | `clawt` | `src/constants/update.ts` |
| `UPDATE_CHECK_PATH` | `~/.clawt/update-check.json` | `src/constants/paths.ts` |

#### 实现说明

- 入口函数：`checkForUpdates()`（在 `src/utils/update-checker.ts`）
- 消息常量：`UPDATE_MESSAGES`、`UPDATE_COMMANDS`（在 `src/constants/messages/update.ts`）
- 入口调用点：`src/index.ts` 的 `main()` 异步函数中，`program.parseAsync()` 之后根据 `config.autoUpdate` 条件调用

---
