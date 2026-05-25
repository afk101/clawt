# 发现与决策

## 需求
- Clawt 目前默认中文输出，需要支持英文，且默认语言改为英文
- 通过 `clawt config` 可以切换语言（zh-CN / en），仅全局配置（无项目级覆盖）
- README.md 和 README.zh-CN.md 顶部添加 GitHub 仓库地址 https://github.com/afk101/clawt

## 研究发现
- 项目已有完善的消息常量体系：`src/constants/messages/` 下 21 个文件集中管理约 186 个中文消息
- 散落在 utils/commands/constants 中的硬编码中文约 50+ 处，需要统一迁移到消息常量
- Commander `.description()` / `.option()` 的中文描述有约 40 处，影响 `--help` 输出
- config 系统已有完善的交互式配置编辑器（`interactiveConfigEditor`），新增 language 配置项成本低
- 现有配置结构：`CONFIG_DEFINITIONS` → 自动派生 `DEFAULT_CONFIG` + `CONFIG_DESCRIPTIONS`
- 已有 README.md（英文）和 README.zh-CN.md（中文）双语 README 结构
- AI prompt (`ai-prompts.ts`) 为中文，用户决定改为始终英文（不跟随语言切换）
- `ClawtConfig` 类型定义在 `src/types/config.ts`，`ConfigDefinitions` 类型支持 `allowedValues` 枚举
- `loadConfig()` 在 `src/utils/config.ts`，有缓存破坏机制（配置文件损坏时重建默认配置）

## 技术决策
| 决策 | 理由 |
|------|------|
| 采用函数式 i18n（方案 A） | 调用方改动最小，双语紧邻维护不易遗漏，与现有消息系统兼容 |
| 默认语言设为 en | 用户明确要求默认英文 |
| 语言配置项名 `language`，allowedValues: ['en', 'zh-CN'] | 与现有 config 模式一致（如 terminalApp），en 在前表示默认 |
| 仅全局配置（无项目级覆盖） | 用户选择最简单方案，与现有 config 模式一致 |
| 消息常量从直接导出改为 createMessages() 包装导出 | 调用方 MESSAGES.XXX 不变，只需把定义改为 i18n 映射 |
| AI 冲突解决 prompt 始终英文 | 英文 prompt 效果更佳，用户选择不跟随语言切换 |
| Commander description/option 集中管理 | 创建 cli-descriptions.ts 集中管理，各命令引用 CLI_DESCRIPTIONS |
| 散落中文先迁移到 messages 再 i18n | 先集中后国际化，降低遗漏风险 |
| 语言缓存机制（setCurrentLanguage/resetLanguageCache） | 避免每次读取消息都调用 loadConfig，config 变更后刷新缓存 |
| logger 日志不做国际化 | 日志仅开发者可见，保持中文即可 |
| 注释不做国际化 | 注释属于开发者文档，不影响用户输出 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 散落中文分布在 50+ 处，逐一迁移工作量大 | 先将散落中文迁移到 messages 常量文件，再统一做 i18n 替换 |
| Commander description 在注册时调用，无法延迟加载 | 集中管理 CLI 描述消息，注册时通过 createMessages 实时选择语言 |
| config description 字段需要跟随语言变化 | 改为根据语言返回的函数形式 |
| config set language 后需要立即生效 | config set/reset 成功后调用 resetLanguageCache() |

## 资源
- 消息常量目录: `src/constants/messages/`（21 个文件）
- 配置定义: `src/constants/config.ts`
- 配置类型: `src/types/config.ts`
- 配置策略: `src/utils/config-strategy.ts`
- 配置命令: `src/commands/config.ts`
- 配置加载: `src/utils/config.ts`
- 项目配置: `src/constants/project-config.ts`
- 进度常量: `src/constants/progress.ts`
- Prompt 常量: `src/constants/prompt.ts`
- AI Prompts: `src/constants/ai-prompts.ts`
- 任务模板: `src/constants/tasks-template.ts`
- 格式化工具: `src/utils/formatter.ts`
- 交互面板渲染: `src/utils/interactive-panel-render.ts`
- README: `README.md` + `README.zh-CN.md`

## 视觉 / 浏览器发现
- 无可视化内容

---
*每执行 2 次查看/浏览器/搜索操作后更新此文件*