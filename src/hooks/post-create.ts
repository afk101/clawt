import { existsSync, accessSync, chmodSync, constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { logger } from '../logger/index.js';
import { MESSAGES } from '../constants/index.js';
import { loadProjectConfig } from '../utils/project-config.js';
import { getMainWorktreePath } from '../utils/git.js';
import { printInfo, printSuccess, printWarning } from '../utils/formatter.js';
import type { WorktreeInfo, ResolvedHook, PostCreateHookResult } from '../types/index.js';

/** 项目仓库中的 postCreate 脚本相对路径 */
const POST_CREATE_SCRIPT_RELATIVE_PATH = '.clawt/postCreate.sh';

/**
 * 检测文件是否具有可执行权限
 * @param {string} filePath - 文件绝对路径
 * @returns {boolean} 是否可执行
 */
function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 自动为脚本文件添加可执行权限
 * chmod 失败时仅打印警告，不阻塞流程（后续执行阶段会自然报错）
 * @param {string} filePath - 脚本文件绝对路径
 */
function autoFixExecutablePermission(filePath: string): void {
  try {
    chmodSync(filePath, 0o755);
    printInfo(MESSAGES.POST_CREATE_SCRIPT_AUTO_CHMOD(filePath));
  } catch {
    printWarning(MESSAGES.POST_CREATE_SCRIPT_NOT_EXECUTABLE(filePath));
  }
}

/**
 * 将 postCreate 配置值规范化为单条命令
 * 空字符串视为无配置
 * @param {string | undefined} value - postCreate 配置值
 * @returns {string | null} 规范化后的命令，无有效配置时返回 null
 */
function normalizeCommand(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * 按优先级解析 postCreate hook 来源和命令
 * 优先级：项目配置 postCreate > 项目仓库 .clawt/postCreate.sh
 * @returns {ResolvedHook | null} 解析到的 hook 配置，无配置时返回 null
 */
export function resolvePostCreateHook(): ResolvedHook | null {
  // 优先级 1：项目配置中的 postCreate
  const config = loadProjectConfig();
  if (config?.postCreate) {
    const command = normalizeCommand(config.postCreate);
    if (command) {
      return { command, source: 'projectConfig' };
    }
  }

  // 优先级 2：项目仓库中的 .clawt/postCreate.sh
  const mainWorktreePath = getMainWorktreePath();
  const scriptPath = join(mainWorktreePath, POST_CREATE_SCRIPT_RELATIVE_PATH);

  if (existsSync(scriptPath)) {
    if (!isExecutable(scriptPath)) {
      autoFixExecutablePermission(scriptPath);
    }
    return { command: scriptPath, source: 'postCreateScript' };
  }

  return null;
}

/**
 * 获取 hook 来源的中文描述
 * @param {ResolvedHook} hook - 解析到的 hook 配置
 * @returns {string} 来源描述文本
 */
function getSourceLabel(hook: ResolvedHook): string {
  return hook.source === 'projectConfig' ? '项目配置 (postCreate)' : '.clawt/postCreate.sh';
}

/**
 * 异步执行单个 worktree 的 postCreate hook
 * 通过 spawn 异步启动子进程，stdio 设为 'ignore' 静默执行
 * @param {WorktreeInfo} worktree - worktree 信息
 * @param {ResolvedHook} hook - 解析到的 hook 配置
 * @returns {Promise<PostCreateHookResult>} 单个 worktree 的执行结果
 */
function executeOneHook(worktree: WorktreeInfo, hook: ResolvedHook): Promise<PostCreateHookResult> {
  return new Promise((resolve) => {
    const result: PostCreateHookResult = {
      worktreePath: worktree.path,
      branch: worktree.branch,
      success: true,
      source: hook.source,
    };

    try {
      const child = spawn(hook.command, {
        cwd: worktree.path,
        stdio: 'ignore',
        shell: true,
      });

      child.on('error', (err) => {
        result.success = false;
        result.error = err.message;
        logger.error(`postCreate hook 异常: ${hook.command} @ ${worktree.path}: ${result.error}`);
        resolve(result);
      });

      child.on('close', (code) => {
        if (code !== null && code !== 0) {
          result.success = false;
          result.error = `命令退出码: ${code}`;
          logger.error(`postCreate hook 失败: ${hook.command} (退出码: ${code}) @ ${worktree.path}`);
        } else {
          logger.info(`postCreate hook 成功: ${hook.command} @ ${worktree.path}`);
        }
        resolve(result);
      });
    } catch (err) {
      result.success = false;
      result.error = err instanceof Error ? err.message : String(err);
      logger.error(`postCreate hook 启动失败: ${hook.command} @ ${worktree.path}: ${result.error}`);
      resolve(result);
    }
  });
}

/**
 * 对一批 worktree 异步并行执行 postCreate hook
 * 所有 worktree 同时启动，通过 Promise.all 等待全部完成
 * 失败仅写日志，不影响主流程
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {ResolvedHook} hook - 解析到的 hook 配置
 * @returns {Promise<PostCreateHookResult[]>} 每个 worktree 的执行结果
 */
export function executePostCreateHooks(
  worktrees: WorktreeInfo[],
  hook: ResolvedHook,
): Promise<PostCreateHookResult[]> {
  const promises = worktrees.map((worktree) => executeOneHook(worktree, hook));
  return Promise.all(promises);
}

/**
 * postCreate hook 完整入口（fire-and-forget）
 * 根据 skip 标志和配置解析结果决定是否执行 hook
 * 异步后台执行，不阻塞主流程
 * @param {WorktreeInfo[]} worktrees - worktree 列表
 * @param {boolean} skip - 是否跳过 postCreate hook（--no-post-create 标志）
 */
export function runPostCreateHooks(
  worktrees: WorktreeInfo[],
  skip: boolean,
): void {
  // --no-post-create 直接跳过
  if (skip) {
    printInfo(MESSAGES.HOOK_SKIPPED);
    return;
  }

  // 解析 hook 配置
  const hook = resolvePostCreateHook();
  if (!hook) {
    printInfo(MESSAGES.HOOK_NOT_CONFIGURED);
    return;
  }

  // 输出 hook 来源
  printInfo(MESSAGES.HOOK_SOURCE_INFO(getSourceLabel(hook)));
  printInfo('');

  // 提示用户 hook 正在后台执行
  printInfo(MESSAGES.HOOK_BACKGROUND_START(worktrees.length, hook.command));

  // fire-and-forget：后台异步并行执行，不 await
  executePostCreateHooks(worktrees, hook).then((results) => {
    // 汇总日志
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    logger.info(`postCreate hook 汇总: ${succeeded} 成功, ${failed} 失败`);
  }).catch((err) => {
    // 兜底：不应到达此分支，但确保不影响主流程
    logger.error(`postCreate hook 执行异常: ${err instanceof Error ? err.message : String(err)}`);
  });
}
