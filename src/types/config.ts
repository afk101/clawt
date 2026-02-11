/** clawt 全局配置 */
export interface ClawtConfig {
  /** 移除 worktree 时是否自动删除对应本地分支 */
  autoDeleteBranch: boolean;
  /** Claude Code CLI 启动指令（不传 --tasks 时在 worktree 中直接打开交互式界面） */
  claudeCodeCommand: string;
  /** merge 成功后是否自动执行 git pull 和 git push */
  autoPullPush: boolean;
}
