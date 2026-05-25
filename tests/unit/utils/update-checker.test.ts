import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ClientRequest } from 'node:http';
import { EventEmitter } from 'node:events';

// mock node:fs
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
}));

// mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// mock node:https
vi.mock('node:https', () => ({
  request: vi.fn(),
}));

// mock chalk（测试环境已通过 FORCE_COLOR=0 禁用颜色，但仍需确保不产生转义码）
// 使用 Proxy 实现链式调用，支持 chalk.bold.hex('#color')('text') 等任意嵌套
vi.mock('chalk', () => {
  /**
   * 创建可链式调用的 chalk Proxy
   * - 属性访问（如 .bold、.red）返回新 Proxy
   * - 函数调用返回新 Proxy，但记录最后传入的字符串参数
   * - toString / Symbol.toPrimitive 返回最后记录的字符串，支持模板字符串插值
   * @param {string} [value] - 内部记录的字符串值
   * @returns {unknown} 链式 Proxy 对象
   */
  const createChainProxy = (value = ''): unknown => {
    const fn = (..._args: unknown[]) => {};
    return new Proxy(fn, {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        if (prop === Symbol.toPrimitive || prop === 'toString') return () => value;
        if (prop === 'length') return 0;
        return createChainProxy(value);
      },
      apply: (_target, _thisArg, args) => {
        // 记录最后传入的字符串参数作为输出值
        const newValue = typeof args[0] === 'string' ? args[0] : value;
        return createChainProxy(newValue);
      },
    });
  };
  return { default: createChainProxy(), __esModule: true };
});

// mock string-width（纯 ASCII 场景下直接返回字符串长度即可）
vi.mock('string-width', () => ({
  default: (s: string) => s.length,
}));

// mock 常量路径
vi.mock('../../../src/constants/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/constants/index.js')>();
  return {
    ...original,
    UPDATE_CHECK_PATH: '/tmp/test-update-check.json',
  };
});

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { request } from 'node:https';
import { checkForUpdates } from '../../../src/utils/update-checker.js';

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExecSync = vi.mocked(execSync);
const mockedRequest = vi.mocked(request);

/**
 * 创建一个模拟的 https 响应，返回指定的 JSON 数据
 * @param {string} body - 响应体内容
 * @returns {{ req: EventEmitter, res: EventEmitter }} 模拟的请求和响应对象
 */
function createMockHttpResponse(body: string): { req: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }; res: EventEmitter } {
  const req = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    destroy: vi.fn(),
  });
  const res = new EventEmitter();

  mockedRequest.mockImplementation((_url: unknown, _opts: unknown, cb?: (res: IncomingMessage) => void) => {
    // 在下一个微任务中触发回调，模拟异步行为
    queueMicrotask(() => {
      cb?.(res as unknown as IncomingMessage);
      res.emit('data', Buffer.from(body));
      res.emit('end');
    });
    return req as unknown as ClientRequest;
  });

  return { req, res };
}

/**
 * 创建一个会触发错误的模拟 https 请求
 * @returns {{ req: EventEmitter }} 模拟的请求对象
 */
function createMockHttpError(): { req: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> } } {
  const req = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    destroy: vi.fn(),
  });

  mockedRequest.mockImplementation(() => {
    queueMicrotask(() => {
      req.emit('error', new Error('network error'));
    });
    return req as unknown as ClientRequest;
  });

  return { req };
}

/**
 * 创建一个会触发超时的模拟 https 请求
 * @returns {{ req: EventEmitter }} 模拟的请求对象
 */
function createMockHttpTimeout(): { req: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> } } {
  const req = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    destroy: vi.fn(),
  });

  mockedRequest.mockImplementation(() => {
    queueMicrotask(() => {
      req.emit('timeout');
    });
    return req as unknown as ClientRequest;
  });

  return { req };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ========== 缓存读取与过期判断 ==========

describe('checkForUpdates - 缓存逻辑', () => {
  it('缓存不存在时请求 registry', async () => {
    // 缓存文件不存在
    mockedReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    createMockHttpResponse(JSON.stringify({ version: '2.17.1' }));
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    await checkForUpdates('2.17.1');

    expect(mockedRequest).toHaveBeenCalled();
  });

  it('缓存有效且无新版本时不打印提示', async () => {
    const cache = {
      lastCheck: Date.now(),
      latestVersion: '2.17.1',
      currentVersion: '2.17.1',
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));

    await checkForUpdates('2.17.1');

    // 不应请求 registry
    expect(mockedRequest).not.toHaveBeenCalled();
    // 不应打印任何内容（无新版本）
    expect(console.log).not.toHaveBeenCalled();
  });

  it('缓存有效且有新版本时打印提示', async () => {
    const cache = {
      lastCheck: Date.now(),
      latestVersion: '2.18.0',
      currentVersion: '2.17.1',
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    await checkForUpdates('2.17.1');

    // 不应请求 registry（缓存有效）
    expect(mockedRequest).not.toHaveBeenCalled();
    // 应打印更新提示
    expect(console.log).toHaveBeenCalled();
    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(allOutput).toContain('2.18.0');
    expect(allOutput).toContain('2.17.1');
  });

  it('缓存过期（超过 24h）时请求 registry', async () => {
    const cache = {
      lastCheck: Date.now() - 25 * 60 * 60 * 1000, // 25 小时前
      latestVersion: '2.17.1',
      currentVersion: '2.17.1',
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));
    createMockHttpResponse(JSON.stringify({ version: '2.17.1' }));
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    await checkForUpdates('2.17.1');

    expect(mockedRequest).toHaveBeenCalled();
  });

  it('本地版本变化时视为缓存过期', async () => {
    const cache = {
      lastCheck: Date.now(), // 时间未过期
      latestVersion: '2.18.0',
      currentVersion: '2.16.0', // 与当前版本 2.17.1 不一致
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));
    createMockHttpResponse(JSON.stringify({ version: '2.18.0' }));
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    await checkForUpdates('2.17.1');

    // 即使时间未过期，版本不一致也应重新请求
    expect(mockedRequest).toHaveBeenCalled();
  });

  it('缓存文件损坏时请求 registry', async () => {
    mockedReadFileSync.mockReturnValue('invalid json {{{');
    createMockHttpResponse(JSON.stringify({ version: '2.17.1' }));
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    await checkForUpdates('2.17.1');

    expect(mockedRequest).toHaveBeenCalled();
  });
});

// ========== 网络请求逻辑 ==========

describe('checkForUpdates - 网络请求', () => {
  beforeEach(() => {
    // 确保缓存不存在，强制走网络请求
    mockedReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });
  });

  it('请求成功且有新版本时写入缓存并打印提示', async () => {
    createMockHttpResponse(JSON.stringify({ version: '2.18.0' }));

    await checkForUpdates('2.17.1');

    // 应写入缓存
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      '/tmp/test-update-check.json',
      expect.stringContaining('"latestVersion": "2.18.0"'),
      'utf-8',
    );
    // 应打印提示
    expect(console.log).toHaveBeenCalled();
    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(allOutput).toContain('2.18.0');
  });

  it('请求成功但版本相同时写入缓存但不打印提示', async () => {
    createMockHttpResponse(JSON.stringify({ version: '2.17.1' }));

    await checkForUpdates('2.17.1');

    // 应写入缓存
    expect(mockedWriteFileSync).toHaveBeenCalled();
    // 不应打印提示（版本相同）
    expect(console.log).not.toHaveBeenCalled();
  });

  it('网络请求失败时静默忽略', async () => {
    createMockHttpError();

    await checkForUpdates('2.17.1');

    // 不应写入缓存
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
    // 不应打印提示
    expect(console.log).not.toHaveBeenCalled();
  });

  it('网络请求超时时静默忽略并销毁连接', async () => {
    const { req } = createMockHttpTimeout();

    await checkForUpdates('2.17.1');

    expect(req.destroy).toHaveBeenCalled();
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('registry 返回无效 JSON 时静默忽略', async () => {
    createMockHttpResponse('not valid json');

    await checkForUpdates('2.17.1');

    expect(mockedWriteFileSync).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('registry 返回的 JSON 中无 version 字段时静默忽略', async () => {
    createMockHttpResponse(JSON.stringify({ name: 'clawt' }));

    await checkForUpdates('2.17.1');

    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});

// ========== 版本比较逻辑 ==========

describe('checkForUpdates - 版本比较', () => {
  beforeEach(() => {
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });
  });

  it('major 版本更高时提示更新', async () => {
    const cache = { lastCheck: Date.now(), latestVersion: '3.0.0', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));

    await checkForUpdates('2.17.1');

    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(allOutput).toContain('3.0.0');
  });

  it('minor 版本更高时提示更新', async () => {
    const cache = { lastCheck: Date.now(), latestVersion: '2.18.0', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));

    await checkForUpdates('2.17.1');

    expect(console.log).toHaveBeenCalled();
  });

  it('patch 版本更高时提示更新', async () => {
    const cache = { lastCheck: Date.now(), latestVersion: '2.17.2', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));

    await checkForUpdates('2.17.1');

    expect(console.log).toHaveBeenCalled();
  });

  it('版本相同时不提示', async () => {
    const cache = { lastCheck: Date.now(), latestVersion: '2.17.1', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));

    await checkForUpdates('2.17.1');

    expect(console.log).not.toHaveBeenCalled();
  });

  it('本地版本更高时不提示', async () => {
    const cache = { lastCheck: Date.now(), latestVersion: '2.16.0', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));

    await checkForUpdates('2.17.1');

    expect(console.log).not.toHaveBeenCalled();
  });
});

// ========== 包管理器检测 ==========

describe('checkForUpdates - 包管理器检测', () => {
  beforeEach(() => {
    // 缓存有效且有新版本，确保走到打印提示逻辑
    const cache = { lastCheck: Date.now(), latestVersion: '3.0.0', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));
  });

  it('pnpm 全局安装时提示使用 pnpm 命令', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('pnpm')) {
        return 'clawt@2.17.1';
      }
      throw new Error('not found');
    });

    await checkForUpdates('2.17.1');

    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(allOutput).toContain('pnpm add -g clawt');
  });

  it('yarn 全局安装时提示使用 yarn 命令', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('pnpm')) {
        throw new Error('not found');
      }
      if (typeof cmd === 'string' && cmd.includes('yarn')) {
        return 'info "clawt@2.17.1"';
      }
      throw new Error('not found');
    });

    await checkForUpdates('2.17.1');

    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(allOutput).toContain('yarn global add clawt');
  });

  it('npm 全局安装时提示使用 npm 命令', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    await checkForUpdates('2.17.1');

    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(allOutput).toContain('npm i -g clawt');
  });
});

// ========== 提示框输出格式 ==========

describe('checkForUpdates - 提示框格式', () => {
  it('提示框包含完整的边框结构', async () => {
    const cache = { lastCheck: Date.now(), latestVersion: '2.18.0', currentVersion: '2.17.1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(cache));
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    await checkForUpdates('2.17.1');

    const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    // 应包含顶部和底部边框
    expect(calls.some((line: string) => typeof line === 'string' && line.startsWith('╭') && line.endsWith('╮'))).toBe(true);
    expect(calls.some((line: string) => typeof line === 'string' && line.startsWith('╰') && line.endsWith('╯'))).toBe(true);
    // 应包含版本信息和更新命令
    const allOutput = calls.join('\n');
    expect(allOutput).toContain('2.17.1');
    expect(allOutput).toContain('2.18.0');
    expect(allOutput).toContain('npm i -g clawt');
  });
});

// ========== 容错：异常不影响 CLI ==========

describe('checkForUpdates - 容错性', () => {
  it('writeFileSync 抛出异常时不影响执行', async () => {
    mockedReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    createMockHttpResponse(JSON.stringify({ version: '2.18.0' }));
    mockedWriteFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    mockedExecSync.mockImplementation(() => { throw new Error('not found'); });

    // 不应抛出异常
    await expect(checkForUpdates('2.17.1')).resolves.toBeUndefined();
    // 仍应打印提示
    expect(console.log).toHaveBeenCalled();
  });

  it('任何未预期的异常都不会导致 checkForUpdates 抛出', async () => {
    mockedReadFileSync.mockImplementation(() => { throw new TypeError('unexpected'); });
    mockedRequest.mockImplementation(() => { throw new Error('unexpected'); });

    await expect(checkForUpdates('2.17.1')).resolves.toBeUndefined();
  });
});
