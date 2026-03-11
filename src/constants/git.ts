/** sync 自动保存的 commit message 前缀，用于检测 auto-save 提交 */
export const AUTO_SAVE_COMMIT_MESSAGE = 'chore: auto-save before sync';

/** execSync 最大缓冲区大小（200MB），防止大分支 diff 时触发 ENOBUFS 错误 */
export const EXEC_MAX_BUFFER = 200 * 1024 * 1024;
