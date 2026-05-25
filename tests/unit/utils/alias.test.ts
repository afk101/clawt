import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock i18n 模块，避免循环依赖导致 currentLanguage 未初始化
vi.mock('../../../src/utils/i18n.js', () => ({
  getCurrentLanguage: vi.fn().mockReturnValue('zh-CN'),
  resetLanguageCache: vi.fn(),
  setCurrentLanguage: vi.fn(),
  createMessages: vi.fn((i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
    const result: any = {};
    for (const key of Object.keys(i18nMap)) {
      result[key] = i18nMap[key]['zh-CN'];
    }
    return result;
  }),
}));

import { applyAliases } from '../../../src/utils/alias.js';

describe('applyAliases', () => {
  it('为已注册命令添加别名', () => {
    const program = new Command();
    const listCmd = program.command('list').action(() => {});

    applyAliases(program, { ls: 'list' });

    expect(listCmd.aliases()).toContain('ls');
  });

  it('目标命令不存在时静默跳过', () => {
    const program = new Command();
    program.command('list').action(() => {});

    // 不应抛出异常
    applyAliases(program, { xx: 'nonexistent' });

    const listCmd = program.commands.find((c) => c.name() === 'list');
    expect(listCmd!.aliases()).not.toContain('xx');
  });

  it('空别名映射时不做任何操作', () => {
    const program = new Command();
    program.command('list').action(() => {});

    applyAliases(program, {});

    const listCmd = program.commands.find((c) => c.name() === 'list');
    expect(listCmd!.aliases()).toEqual([]);
  });

  it('支持多个别名映射到不同命令', () => {
    const program = new Command();
    const listCmd = program.command('list').action(() => {});
    const removeCmd = program.command('remove').action(() => {});

    applyAliases(program, { ls: 'list', rm: 'remove' });

    expect(listCmd.aliases()).toContain('ls');
    expect(removeCmd.aliases()).toContain('rm');
  });
});
