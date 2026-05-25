import { createMessages } from '../../utils/i18n.js';

/** cover-validate 命令专属提示消息（双语映射） */
const COVER_VALIDATE_MESSAGES_I18N = {
  /** 当前不在验证分支上 */
  COVER_VALIDATE_NOT_ON_VALIDATE_BRANCH: {
    en: 'Current branch is not a validate branch (must start with clawt-validate-)\n  Please run clawt validate first to switch to a validate branch',
    'zh-CN': '当前分支不是验证分支（需以 clawt-validate- 开头）\n  请先通过 clawt validate 切换到验证分支',
  },
  /** 无增量修改 */
  COVER_VALIDATE_NO_CHANGES: {
    en: 'No incremental changes on validate branch relative to snapshot, nothing to cover',
    'zh-CN': '验证分支上没有相对于快照的增量修改，无需覆盖',
  },
  /** 目标 worktree 不存在 */
  COVER_VALIDATE_TARGET_NOT_FOUND: {
    en: (branch: string) =>
      `Worktree for branch ${branch} not found. Please confirm the worktree has not been removed`,
    'zh-CN': (branch: string) =>
      `未找到分支 ${branch} 对应的 worktree，请确认该 worktree 尚未被移除`,
  },
  /** 无快照，提示先执行 validate */
  COVER_VALIDATE_NO_SNAPSHOT: {
    en: (branch: string) =>
      `No validate snapshot found for branch ${branch}\n  Please run clawt validate -b ${branch} to create a snapshot`,
    'zh-CN': (branch: string) =>
      `未找到分支 ${branch} 的 validate 快照\n  请先执行 clawt validate -b ${branch} 创建快照`,
  },
  /** 覆盖失败（tree checkout/clean 失败） */
  COVER_VALIDATE_COVER_FAILED: {
    en: (branch: string) =>
      `Failed to cover changes to worktree ${branch}: tree checkout or cleanup error\n  Please check the target worktree status and retry`,
    'zh-CN': (branch: string) =>
      `覆盖变更到 worktree ${branch} 失败：tree checkout 或清理操作出错\n  请检查目标 worktree 状态后重试`,
  },
  /** 工作区和暂存区无修改，可能为误操作 */
  COVER_VALIDATE_WORKING_DIR_CLEAN: {
    en: 'Working tree and staging area on current validate branch have no changes, possibly a mistaken operation',
    'zh-CN': '当前验证分支的工作区和暂存区没有任何修改，可能为误操作',
  },
  /** 覆盖成功 */
  COVER_VALIDATE_SUCCESS: {
    en: (branch: string) =>
      `✓ Changes on validate branch covered to worktree => ${branch}`,
    'zh-CN': (branch: string) =>
      `✓ 已将验证分支上的修改覆盖到 worktree => ${branch}`,
  },
};

export const COVER_VALIDATE_MESSAGES = createMessages(COVER_VALIDATE_MESSAGES_I18N);
