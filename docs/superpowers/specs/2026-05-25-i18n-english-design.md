# Clawt 国际化（i18n）设计文档

## 概述

将 Clawt CLI 的用户可见输出从硬编码中文改为支持英文/中文双语，默认语言设为英文。通过 `clawt config set language <en|zh-CN>` 切换语言。

## 需求

1. 新增全局配置项 `language`，allowedValues: `['en', 'zh-CN']`，默认值 `'en'`
2. 所有用户可见输出跟随 `language` 配置切换语言
3. AI 冲突解决 prompt 始终使用英文（不跟随语言切换）
4. README.md 和 README.zh-CN.md 顶部添加 GitHub 仓库地址
5. logger 日志和源码注释不做国际化

## 架构

### i18n 核心模块 — `src/utils/i18n.ts`

**职责：** 提供语言获取和消息创建工具函数。

**API：**

```typescript
/** 支持的语言类型 */
type Language = 'en' | 'zh-CN';

/** 获取当前语言配置 */
function getCurrentLanguage(): Language

/** 创建国际化消息对象（非函数消息） */
function createMessages<T extends Record<string, { en: unknown; 'zh-CN': unknown }>>(
  i18nMap: T
): { [K in keyof T]: T[K][Language] }
```

**实现策略：**
- `getCurrentLanguage()` 调用 `loadConfig()` 读取 `language` 字段，读不到则返回 `'en'`
- `createMessages()` 遍历 i18nMap，对每个 key 返回当前语言对应的值
  - 纯字符串消息：直接返回对应语言字符串
  - 函数消息：返回对应语言的函数（调用方式不变）
- 消息常量文件改为先定义 i18n 映射对象，再用 `createMessages()` 包装导出

### 消息常量改造模式

**改造前：**
```typescript
export const COMMON_MESSAGES = {
  NOT_MAIN_WORKTREE: '请在主 worktree 的根目录下执行 clawt',
  BRANCH_EXISTS: (name: string) => `分支 ${name} 已存在，无法创建`,
};
```

**改造后：**
```typescript
const COMMON_MESSAGES_I18N = {
  NOT_MAIN_WORKTREE: {
    en: 'Please run clawt in the root directory of the main worktree',
    'zh-CN': '请在主 worktree 的根目录下执行 clawt',
  },
  BRANCH_EXISTS: {
    en: (name: string) => `Branch ${name} already exists, cannot create`,
    'zh-CN': (name: string) => `分支 ${name} 已存在，无法创建`,
  },
};

export const COMMON_MESSAGES = createMessages(COMMON_MESSAGES_I18N);
```

**调用方完全无改动：** `MESSAGES.BRANCH_EXISTS('feat')` 自动返回当前语言的文本。

### 散落硬编码中文处理

先将散落在 utils/commands/constants 中的硬编码中文迁移到对应的 messages 常量文件，再统一做 i18n 化。迁移映射：

| 散落位置 | 迁移目标 |
|---------|---------|
| `utils/config-strategy.ts` | `messages/config.ts` |
| `utils/dry-run.ts` | `messages/run.ts` |
| `utils/prompt.ts` | `messages/merge.ts` |
| `utils/ui-prompts.ts` | `messages/common.ts` |
| `utils/validate-branch.ts` | `messages/validate.ts` |
| `utils/terminal.ts` | `messages/resume.ts` |
| `utils/claude.ts` | `messages/resume.ts` |
| `utils/task-executor.ts` | `messages/run.ts` |
| `utils/formatter.ts` | `messages/common.ts` |
| `utils/worktree-matcher.ts` | `messages/common.ts` |
| `utils/alias.ts` | `messages/alias.ts` |
| `utils/interactive-panel-render.ts` | `messages/interactive-panel.ts` |
| `utils/validate-runner.ts` | `messages/validate.ts` |

### 非 messages 常量 i18n 化

| 文件 | i18n 内容 |
|------|----------|
| `constants/progress.ts` | `TASK_STATUS_LABELS`（排队中/运行中/完成/失败）、`TEXT_ACTIVITY_PREFIX`（思考中） |
| `constants/prompt.ts` | `UNKNOWN_DATE_GROUP`（未知日期）、`UNKNOWN_DATE_SEPARATOR_LABEL` |
| `constants/config.ts` | `description` 字段（配置项描述） |
| `constants/project-config.ts` | `description` 字段 |
| `constants/tasks-template.ts` | `TASK_TEMPLATE_CONTENT`（任务模板内容） |
| `constants/ai-prompts.ts` | 改为始终英文 |

### Commander description/option 国际化

- 创建 `src/constants/messages/cli-descriptions.ts`，集中管理所有 `.description()` 和 `.option()` 的文本
- 各命令注册函数和 `src/index.ts` 中引用该文件
- Commander 在命令注册时同步读取当前语言文本

### 配置系统扩展

**类型扩展 — `src/types/config.ts`：**
```typescript
export interface ClawtConfig {
  // ... 现有字段
  /** 界面语言：en（英文）、zh-CN（中文） */
  language: 'en' | 'zh-CN';
}
```

**配置定义扩展 — `src/constants/config.ts`：**
```typescript
language: {
  defaultValue: 'en',
  description: '界面语言：en（英文）、zh-CN（中文）',
  allowedValues: ['en', 'zh-CN'] as const,
},
```

交互式配置编辑器自动支持枚举 Select 选择，无需额外代码。

### README 更新

在 `README.md` 和 `README.zh-CN.md` 的标题下方添加：
```markdown
> **Repository:** [https://github.com/afk101/clawt](https://github.com/afk101/clawt)
```

## 不做国际化的部分

- `logger.info/debug/warn` 日志消息 — 仅开发者可见
- 源码中文注释 — 属于开发者文档
- `ai-prompts.ts` — 改为始终英文（不跟随语言切换）
- `src/index.ts` 中的 `未知错误` — 改为 `Unknown error`（错误处理本身应该用英文）

## 验收标准

1. `clawt config set language en` → 所有 CLI 输出为英文
2. `clawt config set language zh-CN` → 所有 CLI 输出为中文
3. `clawt config get language` → 返回当前语言设置
4. `clawt config` 交互式面板中可选择 language 配置项
5. 默认安装后 language 为 `en`
6. AI 冲突解决 prompt 始终为英文
7. 现有测试全部通过
8. README.md 和 README.zh-CN.md 顶部包含 GitHub 仓库地址
9. `clawt --help` 输出跟随语言设置
