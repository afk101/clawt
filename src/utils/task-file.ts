import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { ClawtError } from '../errors/index.js';
import { MESSAGES } from '../constants/index.js';
import type { TaskFileEntry } from '../types/index.js';

/** 匹配任务块的正则：<!-- CLAWT-TASKS:START --> ... <!-- CLAWT-TASKS:END --> */
const TASK_BLOCK_REGEX = /<!-- CLAWT-TASKS:START -->([\s\S]*?)<!-- CLAWT-TASKS:END -->/g;

/** 匹配分支名行的正则：# branch: <name> */
const BRANCH_LINE_REGEX = /^#\s*branch:\s*(.+)$/;

/**
 * 解析任务文件内容，提取所有任务块
 * 每个块内 `# branch: <name>` 为分支名，其余行为任务描述
 * @param {string} content - 文件内容
 * @returns {TaskFileEntry[]} 解析出的任务列表
 */
export function parseTaskFile(content: string): TaskFileEntry[] {
  const entries: TaskFileEntry[] = [];
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  // 重置正则 lastIndex，避免模块级 /g 正则跨调用残留状态
  TASK_BLOCK_REGEX.lastIndex = 0;

  while ((match = TASK_BLOCK_REGEX.exec(content)) !== null) {
    blockIndex++;
    const blockContent = match[1].trim();
    const lines = blockContent.split('\n');

    let branch = '';
    const taskLines: string[] = [];

    for (const line of lines) {
      const branchMatch = line.trim().match(BRANCH_LINE_REGEX);
      if (branchMatch) {
        branch = branchMatch[1].trim();
      } else {
        taskLines.push(line);
      }
    }

    if (!branch) {
      throw new ClawtError(MESSAGES.TASK_FILE_MISSING_BRANCH(blockIndex));
    }

    const task = taskLines.join('\n').trim();
    if (!task) {
      throw new ClawtError(MESSAGES.TASK_FILE_MISSING_TASK(branch));
    }

    entries.push({ branch, task });
  }

  return entries;
}

/**
 * 读取并解析任务文件
 * 支持相对路径（基于 cwd）和绝对路径
 * @param {string} filePath - 文件路径
 * @returns {TaskFileEntry[]} 解析出的任务列表
 */
export function loadTaskFile(filePath: string): TaskFileEntry[] {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new ClawtError(MESSAGES.TASK_FILE_NOT_FOUND(absolutePath));
  }

  const content = readFileSync(absolutePath, 'utf-8');
  const entries = parseTaskFile(content);

  if (entries.length === 0) {
    throw new ClawtError(MESSAGES.TASK_FILE_EMPTY);
  }

  return entries;
}
