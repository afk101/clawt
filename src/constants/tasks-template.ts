/** 任务模板默认输出目录 */
export const TASK_TEMPLATE_OUTPUT_DIR = 'clawt/tasks';

/** 任务模板文件名前缀 */
export const TASK_TEMPLATE_FILENAME_PREFIX = 'clawt-tasks';

/** 任务模板文件内容 */
export const TASK_TEMPLATE_CONTENT = `# Clawt 任务文件
#
# 使用方法: clawt run -f tasks.md
# 格式说明: 标签外的文本会被忽略，每个任务用 START/END 标签包裹
#
# 规则:
#   1. 每个任务块用 <!-- CLAWT-TASKS:START --> 和 <!-- CLAWT-TASKS:END --> 包裹
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
