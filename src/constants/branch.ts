/**
 * 分支名中的非法字符正则
 * 包含：/ \ . 空格 ~ : * ? [ ] ^
 * 以及连续的 ..（目录遍历）
 */
export const INVALID_BRANCH_CHARS = /[\/\\.\s~:*?[\]^]+/g;

/** 验证分支名前缀 */
export const VALIDATE_BRANCH_PREFIX = 'clawt-validate-';
