/** sync 自动保存的 commit message 前缀，用于检测 auto-save 提交 */
export const AUTO_SAVE_COMMIT_MESSAGE_PREFIX = 'clawt: auto-save before merging';

/** execSync 最大缓冲区大小（200MB），防止大分支 diff 时触发 ENOBUFS 错误 */
export const EXEC_MAX_BUFFER = 200 * 1024 * 1024;

/**
 * Git index.lock 错误重试配置
 * 当检测到 index.lock 错误时自动重试，避免因短暂竞争导致用户操作失败
 */
export const GIT_INDEX_LOCK_RETRY = {
  /** 重试次数（用户反馈"重试一下就可以了"，单次重试足够） */
  MAX_RETRIES: 1,
  /** 重试延迟毫秒数（让锁文件有时间被释放） */
  DELAY_MS: 1000,
} as const;
