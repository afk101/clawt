import chalk from 'chalk';

/** 多选列表中全选选项的标识名称 */
export const SELECT_ALL_NAME = '__select_all__';

/** 多选列表中全选选项的显示文本 */
export const SELECT_ALL_LABEL = '[select-all]';

/** 组级全选选项的 name 前缀 */
export const GROUP_SELECT_ALL_PREFIX = '__group_select_all_';

/**
 * 生成组级全选选项的显示文本
 * @param {string} dateLabel - 日期标签
 * @returns {string} 格式化的组全选显示文本
 */
export const GROUP_SELECT_ALL_LABEL = (dateLabel: string): string => `[select-all: ${dateLabel}]`;

/**
 * 生成日期分组分隔线的显示文本
 * 日期部分高亮显示，两侧使用 === 分隔线增强视觉区分
 * @param {string} dateLabel - 日期标签
 * @param {string} relativeTime - 相对时间描述
 * @returns {string} 格式化的分隔线文本
 */
export const GROUP_SEPARATOR_LABEL = (dateLabel: string, relativeTime: string): string =>
  `════ ${chalk.bold.hex('#FF8C00')(dateLabel)}（${chalk.hex('#FF8C00')(relativeTime)}） ════`;

/** 无法获取创建日期时的默认分组名称 */
export const UNKNOWN_DATE_GROUP = '未知日期';

/** 未知日期分组的分隔线显示文本 */
export const UNKNOWN_DATE_SEPARATOR_LABEL = `════ ${chalk.bold.hex('#FF8C00')('未知日期')} ════`;

/** Claude Code 冲突解决指令性 prompt */
export const CONFLICT_RESOLVE_PROMPT = `你是一个 Git 合并冲突解决专家。当前仓库处于合并冲突状态。

## 任务

1. 通过 git status 和 git diff 等命令，自行查看当前仓库的冲突文件列表及冲突内容
2. 通过 git log 等命令，分析两个分支各自的变更意图
3. 直接编辑每个冲突文件，移除所有冲突标记（<<<<<<<、=======、>>>>>>>）
4. 保留双方有意义的变更，合理合并代码逻辑
5. 如果两个分支修改了同一段代码但意图不同，优先保证代码的正确性和完整性
6. 解决冲突后，确保代码语法正确、逻辑完整
7. 不要添加任何注释说明你做了什么修改，只需要修改文件内容

请直接开始。`;
