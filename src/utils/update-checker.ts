import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { request } from 'node:https';
import chalk from 'chalk';
import stringWidth from 'string-width';
import {
  UPDATE_CHECK_PATH,
  UPDATE_CHECK_INTERVAL_MS,
  NPM_REGISTRY_URL,
  NPM_REGISTRY_TIMEOUT_MS,
  PACKAGE_NAME,
} from '../constants/index.js';
import { UPDATE_MESSAGES, UPDATE_COMMANDS } from '../constants/messages/index.js';

/** 更新检查缓存结构 */
interface UpdateCache {
  /** 上次检查时间戳 */
  lastCheck: number;
  /** 最新版本号 */
  latestVersion: string;
  /** 检查时的本地版本号 */
  currentVersion: string;
}

/**
 * 读取更新检查缓存文件
 * @returns {UpdateCache | null} 缓存数据，文件不存在或解析失败返回 null
 */
function readUpdateCache(): UpdateCache | null {
  try {
    const raw = readFileSync(UPDATE_CHECK_PATH, 'utf-8');
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

/**
 * 写入更新检查缓存文件
 * @param {UpdateCache} cache - 缓存数据
 */
function writeUpdateCache(cache: UpdateCache): void {
  try {
    writeFileSync(UPDATE_CHECK_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // 写入失败时静默忽略，不影响 CLI 正常功能
  }
}

/**
 * 判断缓存是否过期（超过 24 小时或本地版本已变化）
 * @param {UpdateCache} cache - 缓存数据
 * @param {string} currentVersion - 当前本地版本号
 * @returns {boolean} 缓存是否已过期
 */
function isCacheExpired(cache: UpdateCache, currentVersion: string): boolean {
  if (cache.currentVersion !== currentVersion) {
    return true;
  }
  return Date.now() - cache.lastCheck > UPDATE_CHECK_INTERVAL_MS;
}

/**
 * 简易 semver 版本比较（不引入新依赖）
 * @param {string} latest - 最新版本号
 * @param {string} current - 当前版本号
 * @returns {boolean} latest 是否大于 current
 */
function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * 从 npm registry 获取最新版本号（5 秒超时）
 * @returns {Promise<string | null>} 最新版本号，请求失败返回 null
 */
function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = request(NPM_REGISTRY_URL, { timeout: NPM_REGISTRY_TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { version?: string };
          resolve(parsed.version ?? null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * 探测当前全局安装 clawt 所用的包管理器
 * 依次尝试 pnpm、yarn 的全局列表命令，匹配到则返回对应名称，否则默认 npm
 * @returns {string} 包管理器名称：'pnpm' | 'yarn' | 'npm'
 */
function detectPackageManager(): string {
  const checks = [
    { name: 'pnpm', command: `pnpm list -g --depth=0 ${PACKAGE_NAME}` },
    { name: 'yarn', command: `yarn global list --depth=0 2>/dev/null` },
  ];

  for (const { name, command } of checks) {
    try {
      const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (output.includes(PACKAGE_NAME)) {
        return name;
      }
    } catch {
      // 命令不存在或执行失败，跳过
    }
  }

  return 'npm';
}

/**
 * 绘制带边框的版本更新提示框
 * @param {string} currentVersion - 当前版本号
 * @param {string} latestVersion - 最新版本号
 */
function printUpdateNotification(currentVersion: string, latestVersion: string): void {
  const updateText = UPDATE_MESSAGES.UPDATE_AVAILABLE(
    chalk.red(currentVersion),
    chalk.green(latestVersion),
  );
  const pm = detectPackageManager();
  const updateCommand = (UPDATE_COMMANDS as Record<string, string>)[pm] || UPDATE_COMMANDS.npm;
  const commandText = UPDATE_MESSAGES.UPDATE_HINT(chalk.cyan(updateCommand));

  const updateTextWidth = stringWidth(updateText);
  const commandTextWidth = stringWidth(commandText);
  const innerWidth = Math.max(updateTextWidth, commandTextWidth) + 4;

  const padLine = (text: string): string => {
    const textWidth = stringWidth(text);
    const leftPad = Math.floor((innerWidth - textWidth) / 2);
    const rightPad = innerWidth - textWidth - leftPad;
    return `│${' '.repeat(leftPad)}${text}${' '.repeat(rightPad)}│`;
  };

  const top = `╭${'─'.repeat(innerWidth)}╮`;
  const bottom = `╰${'─'.repeat(innerWidth)}╯`;
  const emptyLine = `│${' '.repeat(innerWidth)}│`;

  console.log();
  console.log(top);
  console.log(emptyLine);
  console.log(padLine(updateText));
  console.log(padLine(commandText));
  console.log(emptyLine);
  console.log(bottom);
  console.log();
}

/**
 * 检查更新入口函数
 * 读取缓存 → 缓存有效且有新版本则打印提示 → 缓存过期则请求 registry 刷新
 * 所有异常静默处理，不影响 CLI 正常功能
 * @param {string} currentVersion - 当前本地版本号
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const cache = readUpdateCache();

    // 缓存有效：直接判断是否需要提示
    if (cache && !isCacheExpired(cache, currentVersion)) {
      if (isNewerVersion(cache.latestVersion, currentVersion)) {
        printUpdateNotification(currentVersion, cache.latestVersion);
      }
      return;
    }

    // 缓存过期或不存在：请求 registry
    const latestVersion = await fetchLatestVersion();
    if (!latestVersion) {
      return;
    }

    // 写入新缓存
    writeUpdateCache({
      lastCheck: Date.now(),
      latestVersion,
      currentVersion,
    });

    // 有新版本则打印提示
    if (isNewerVersion(latestVersion, currentVersion)) {
      printUpdateNotification(currentVersion, latestVersion);
    }
  } catch {
    // 任何异常静默忽略，不影响 CLI 正常功能
  }
}
