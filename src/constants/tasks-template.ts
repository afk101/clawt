import { getCurrentLanguage } from '../utils/i18n.js';

/** 任务模板默认输出目录 */
export const TASK_TEMPLATE_OUTPUT_DIR = '.clawt/tasks';

/** 任务模板文件名前缀 */
export const TASK_TEMPLATE_FILENAME_PREFIX = 'clawt-tasks';

/**
 * 获取任务模板文件内容（根据语言返回）
 * @returns {string} 任务模板内容
 */
export function getTaskTemplateContent(): string {
  const lang = getCurrentLanguage();
  if (lang === 'en') {
    return `# Clawt Task File
#
# Usage: clawt run -f tasks.md
# Format: Text outside tags is ignored, each task is wrapped in START/END tags
#
# Rules:
#   1. Each task block is wrapped with <START> and <END> tags (see example below)
#   2. Use # branch: <branch-name> inside the block to declare branch name (can be omitted with -b)
#   3. Other lines inside the block are the task description (supports multi-line)

<!-- CLAWT-TASKS:START -->
# branch: feat-example-1
Write your first task description here
<!-- CLAWT-TASKS:END -->

<!-- CLAWT-TASKS:START -->
# branch: feat-example-2
Write your second task description here
Multi-line descriptions are supported
<!-- CLAWT-TASKS:END -->
`;
  }
  return `# Clawt 任务文件
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
`;
}

/** 兼容旧代码：保留静态常量（默认中文） */
export const TASK_TEMPLATE_CONTENT = `# Clawt 任务文件
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
`;