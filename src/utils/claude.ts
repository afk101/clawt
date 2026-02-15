import { spawnSync } from 'node:child_process';
import { ClawtError } from '../errors/index.js';
import { APPEND_SYSTEM_PROMPT } from '../constants/index.js';
import { getConfigValue } from './config.js';
import { printInfo, printWarning } from './formatter.js';
import type { WorktreeInfo } from '../types/index.js';

/**
 * 在指定 worktree 中启动 Claude Code CLI 交互式界面
 * 使用 spawnSync + inherit stdio，让用户直接与 Claude Code 交互
 * @param {WorktreeInfo} worktree - worktree 信息
 */
export function launchInteractiveClaude(worktree: WorktreeInfo): void {
  const commandStr = getConfigValue('claudeCodeCommand');
  const parts = commandStr.split(/\s+/).filter(Boolean);
  const cmd = parts[0];
  const args = [
    ...parts.slice(1),
    '--append-system-prompt',
    APPEND_SYSTEM_PROMPT,
  ];

  printInfo(`正在 worktree 中启动 Claude Code 交互式界面...`);
  printInfo(`  分支: ${worktree.branch}`);
  printInfo(`  路径: ${worktree.path}`);
  printInfo(`  指令: ${commandStr}`);
  printInfo('');

  const result = spawnSync(cmd, args, {
    cwd: worktree.path,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new ClawtError(`启动 Claude Code 失败: ${result.error.message}`);
  }

  if (result.status !== null && result.status !== 0) {
    printWarning(`Claude Code 退出码: ${result.status}`);
  }
}
