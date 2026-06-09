import chalk from 'chalk';
import { MESSAGES } from '../constants/index.js';
import { createInterface } from 'node:readline';
import type { WorktreeStatus } from '../types/index.js';
import { isNonInteractive } from './interactive.js';
import { getCurrentLanguage } from './i18n.js';

/**
 * 输出成功信息
 * @param {string} message - 消息内容
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(message));
}

/**
 * 输出错误信息
 * @param {string} message - 消息内容
 */
export function printError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

/**
 * 输出警告信息
 * @param {string} message - 消息内容
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * 输出普通信息
 * @param {string} message - 消息内容
 */
export function printInfo(message: string): void {
  console.log(message);
}

/**
 * 输出提示信息（橙色）
 * @param {string} message - 消息内容
 */
export function printHint(message: string): void {
  console.log(chalk.hex('#FF8C00')(message));
}

/**
 * 输出分隔线
 */
export function printSeparator(): void {
  console.log(MESSAGES.SEPARATOR);
}

/**
 * 输出粗分隔线
 */
export function printDoubleSeparator(): void {
  console.log(MESSAGES.DOUBLE_SEPARATOR);
}

/**
 * 简易 yes/no 确认
 * 非交互模式下根据 nonInteractiveDefault 参数自动返回默认值
 * @param {string} question - 确认问题
 * @param {boolean} [nonInteractiveDefault=true] - 非交互模式下的默认返回值，true 表示自动确认，false 表示自动拒绝
 * @returns {Promise<boolean>} 用户是否确认
 */
export function confirmAction(question: string, nonInteractiveDefault: boolean = true): Promise<boolean> {
  // 非交互模式下返回调用方声明的默认值
  if (isNonInteractive()) {
    return Promise.resolve(nonInteractiveDefault);
  }
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * 破坏性操作确认：先输出带高亮危险指令的警告，再等待用户确认
 * @param {string} dangerousCommand - 即将执行的危险指令（会用红色加粗高亮）
 * @param {string} description - 操作后果描述
 * @returns {Promise<boolean>} 用户是否确认
 */
export function confirmDestructiveAction(dangerousCommand: string, description: string): Promise<boolean> {
  const lang = getCurrentLanguage();
  const continuePrompt = lang === 'en' ? 'Continue?' : '是否继续？';
  const warningPrefix = lang === 'en' ? `About to execute ${chalk.red.bold(dangerousCommand)}, ` : `即将执行 ${chalk.red.bold(dangerousCommand)}，`;
  printWarning(`${warningPrefix}${description}`);
  return confirmAction(continuePrompt);
}

/**
 * 判断 worktree 是否处于空闲状态（0 个提交、无变更、无未提交修改）
 * @param {WorktreeStatus} status - worktree 变更统计信息
 * @returns {boolean} 是否空闲
 */
export function isWorktreeIdle(status: WorktreeStatus): boolean {
  return status.commitCount === 0
    && status.insertions === 0
    && status.deletions === 0
    && !status.hasDirtyFiles;
}

/**
 * 将 WorktreeStatus 格式化为带颜色的字符串
 * @param {WorktreeStatus} status - worktree 变更统计信息
 * @returns {string} 格式化后的状态字符串
 */
export function formatWorktreeStatus(status: WorktreeStatus): string {
  const lang = getCurrentLanguage();
  const parts: string[] = [];

  // 提交数（黄色）
  const commitLabel = lang === 'en' ? `${status.commitCount} commit${status.commitCount !== 1 ? 's' : ''}` : `${status.commitCount} 个提交`;
  parts.push(chalk.yellow(commitLabel));

  // 变更统计
  if (status.insertions === 0 && status.deletions === 0) {
    parts.push(lang === 'en' ? 'No changes' : '无变更');
  } else {
    const diffParts: string[] = [];
    diffParts.push(chalk.green(`+${status.insertions}`));
    diffParts.push(chalk.red(`-${status.deletions}`));
    parts.push(diffParts.join(' '));
  }

  // 未提交修改提示（灰色）
  if (status.hasDirtyFiles) {
    parts.push(chalk.gray(lang === 'en' ? '(uncommitted changes)' : '(未提交修改)'));
  }

  return parts.join('   ');
}

/**
 * 将毫秒时长格式化为人类可读字符串
 * 小于 60s 显示秒数，大于等于 60s 显示 分m秒s
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时长字符串
 */
export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

/**
 * 将 ISO 8601 日期字符串格式化为中文相对时间描述
 * 例如: "3 天前"、"2 小时前"、"刚刚"
 * @param {string} isoDateString - ISO 8601 格式的日期字符串
 * @returns {string | null} 中文相对时间描述，无效日期时返回 null
 */
export function formatRelativeTime(isoDateString: string): string | null {
  const lang = getCurrentLanguage();
  const date = new Date(isoDateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // 无效日期返回 null
  if (isNaN(diffMs)) {
    return null;
  }

  // 未来时间或不到 1 分钟
  if (diffMs < 0 || diffMs < 60 * 1000) {
    return lang === 'en' ? 'just now' : '刚刚';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return lang === 'en' ? `${diffMinutes} min ago` : `${diffMinutes} 分钟前`;
  }
  if (diffDays < 1) {
    return lang === 'en' ? `${diffHours} hr ago` : `${diffHours} 小时前`;
  }
  if (diffDays < 30) {
    return lang === 'en' ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` : `${diffDays} 天前`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''} ago` : `${months} 个月前`;
  }
  const years = Math.floor(diffDays / 365);
  return lang === 'en' ? `${years} year${years > 1 ? 's' : ''} ago` : `${years} 年前`;
}

/**
 * 将字节数格式化为带单位的磁盘大小字符串
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串，如 "1.5 GB"、"256.0 MB"、"10.2 KB"
 */
export function formatDiskSize(bytes: number): string {
  /** 1 KB 的字节数 */
  const KB = 1024;
  /** 1 MB 的字节数 */
  const MB = KB * 1024;
  /** 1 GB 的字节数 */
  const GB = MB * 1024;

  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(1)} GB`;
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  if (bytes >= KB) {
    return `${(bytes / KB).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

/**
 * 将 Date 对象格式化为本机时区的 ISO 8601 字符串
 * 输出格式: YYYY-MM-DDTHH:mm:ss.sss+HH:MM
 * @param {Date} date - 日期对象
 * @returns {string} 本机时区的 ISO 8601 格式字符串
 */
export function formatLocalISOString(date: Date): string {
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(date.getTime() - tzOffsetMs);
  const iso = localDate.toISOString().slice(0, -1);

  // 拼接时区偏移量
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(totalMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const minutes = String(absMinutes % 60).padStart(2, '0');

  return `${iso}${sign}${hours}:${minutes}`;
}

/**
 * 格式化来源分支展示行（用于 status 文本输出和交互面板）
 * @param {string | null | undefined} baseBranch - 来源分支
 * @returns {string} 格式化的来源分支文本，如 "来源分支: test" 或 "来源分支: 未记录"
 */
export function formatBaseBranchLine(baseBranch: string | null | undefined): string {
  const lang = getCurrentLanguage();
  const label = lang === 'en' ? 'Base branch' : '来源分支';
  const fallback = lang === 'en' ? 'Not recorded' : '未记录';
  return `${label}: ${baseBranch ?? fallback}`;
}

/**
 * 格式化来源分支内联展示（用于 list 文本输出）
 * @param {string | null | undefined} baseBranch - 来源分支
 * @returns {string} 格式化的来源分支内联文本，如 "<- test" 或 "<- 未记录"
 */
export function formatBaseBranchInline(baseBranch: string | null | undefined): string {
  const fallback = getCurrentLanguage() === 'en' ? 'Not recorded' : '未记录';
  return `<- ${baseBranch ?? fallback}`;
}

/**
 * 生成任务模板文件名，格式：clawt-tasks-YYYY-MM-DD-HH-mm-ss.md
 * @param {string} prefix - 文件名前缀
 * @returns {string} 带时间戳的文件名
 */
export function generateTaskFilename(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
  return `${prefix}-${timestamp}.md`;
}
