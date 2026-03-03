import { describe, it, expect } from 'vitest';
import { CONFIG_DEFINITIONS, DEFAULT_CONFIG, CONFIG_DESCRIPTIONS } from '../../../src/constants/config.js';
import { VALID_TERMINAL_APPS } from '../../../src/constants/terminal.js';

describe('CONFIG_DEFINITIONS', () => {
  it('所有配置项都有 defaultValue 和 description', () => {
    for (const [key, def] of Object.entries(CONFIG_DEFINITIONS)) {
      expect(def).toHaveProperty('defaultValue');
      expect(def).toHaveProperty('description');
      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

describe('DEFAULT_CONFIG', () => {
  it('与 CONFIG_DEFINITIONS 的 key 一致', () => {
    const definitionKeys = Object.keys(CONFIG_DEFINITIONS).sort();
    const configKeys = Object.keys(DEFAULT_CONFIG).sort();
    expect(configKeys).toEqual(definitionKeys);
  });

  it('每个 key 的值等于对应 CONFIG_DEFINITIONS 的 defaultValue', () => {
    for (const [key, def] of Object.entries(CONFIG_DEFINITIONS)) {
      expect((DEFAULT_CONFIG as unknown as Record<string, unknown>)[key]).toBe(def.defaultValue);
    }
  });

  it('包含预期的配置项和默认值', () => {
    expect(DEFAULT_CONFIG.autoDeleteBranch).toBe(false);
    expect(DEFAULT_CONFIG.claudeCodeCommand).toBe('claude');
    expect(DEFAULT_CONFIG.autoPullPush).toBe(false);
    expect(DEFAULT_CONFIG.confirmDestructiveOps).toBe(true);
    expect(DEFAULT_CONFIG.maxConcurrency).toBe(0);
    expect(DEFAULT_CONFIG.aliases).toEqual({});
    expect(DEFAULT_CONFIG.resumeInPlace).toBe(false);
  });
});

describe('CONFIG_DESCRIPTIONS', () => {
  it('与 CONFIG_DEFINITIONS 的 key 一致', () => {
    const definitionKeys = Object.keys(CONFIG_DEFINITIONS).sort();
    const descriptionKeys = Object.keys(CONFIG_DESCRIPTIONS).sort();
    expect(descriptionKeys).toEqual(definitionKeys);
  });

  it('每个 key 的值等于对应 CONFIG_DEFINITIONS 的 description', () => {
    for (const [key, def] of Object.entries(CONFIG_DEFINITIONS)) {
      expect((CONFIG_DESCRIPTIONS as Record<string, string>)[key]).toBe(def.description);
    }
  });

  it('所有描述值都是非空字符串', () => {
    for (const desc of Object.values(CONFIG_DESCRIPTIONS)) {
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

describe('CONFIG_DEFINITIONS — allowedValues', () => {
  it('terminalApp 的 allowedValues 与 VALID_TERMINAL_APPS 一致', () => {
    expect(CONFIG_DEFINITIONS.terminalApp.allowedValues).toEqual(VALID_TERMINAL_APPS);
  });

  it('有 allowedValues 的配置项，defaultValue 必须在其中', () => {
    for (const [, def] of Object.entries(CONFIG_DEFINITIONS)) {
      if (def.allowedValues) {
        expect(def.allowedValues).toContain(def.defaultValue);
      }
    }
  });

  it('非 string 类型的配置项不应有 allowedValues', () => {
    for (const [, def] of Object.entries(CONFIG_DEFINITIONS)) {
      if (typeof def.defaultValue !== 'string') {
        expect(def.allowedValues).toBeUndefined();
      }
    }
  });
});
