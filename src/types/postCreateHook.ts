/** postCreate hook 的来源 */
export type PostCreateHookSource = 'projectConfig' | 'postCreateScript';

/** 单个 worktree 的 hook 执行结果 */
export interface PostCreateHookResult {
  /** worktree 绝对路径 */
  worktreePath: string;
  /** 分支名 */
  branch: string;
  /** 是否执行成功 */
  success: boolean;
  /** hook 来源 */
  source: PostCreateHookSource;
  /** 失败时的错误信息 */
  error?: string;
}

/** hook 解析结果 */
export interface ResolvedHook {
  /** 待执行的命令 */
  command: string;
  /** hook 来源 */
  source: PostCreateHookSource;
}
