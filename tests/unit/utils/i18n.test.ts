import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i18n', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('getCurrentLanguage', () => {
    it('should return en when config has language: en', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({ language: 'en' }),
      }));
      const { getCurrentLanguage } = await import('../../../src/utils/i18n.js');
      expect(getCurrentLanguage()).toBe('en');
    });

    it('should return zh-CN when config has language: zh-CN', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({ language: 'zh-CN' }),
      }));
      const { getCurrentLanguage } = await import('../../../src/utils/i18n.js');
      expect(getCurrentLanguage()).toBe('zh-CN');
    });

    it('should default to en when language is not set', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({}),
      }));
      const { getCurrentLanguage } = await import('../../../src/utils/i18n.js');
      expect(getCurrentLanguage()).toBe('en');
    });

    it('should default to en when loadConfig throws', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => { throw new Error('file not found'); },
      }));
      const { getCurrentLanguage } = await import('../../../src/utils/i18n.js');
      expect(getCurrentLanguage()).toBe('en');
    });
  });

  describe('setCurrentLanguage / resetLanguageCache', () => {
    it('should use cached language after setCurrentLanguage', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({ language: 'zh-CN' }),
      }));
      const { getCurrentLanguage, setCurrentLanguage } = await import('../../../src/utils/i18n.js');
      setCurrentLanguage('en');
      expect(getCurrentLanguage()).toBe('en');
    });

    it('should reload from config after resetLanguageCache', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({ language: 'zh-CN' }),
      }));
      const { getCurrentLanguage, setCurrentLanguage, resetLanguageCache } = await import('../../../src/utils/i18n.js');
      setCurrentLanguage('en');
      expect(getCurrentLanguage()).toBe('en');
      resetLanguageCache();
      expect(getCurrentLanguage()).toBe('zh-CN');
    });
  });

  describe('createMessages', () => {
    it('should return en messages when language is en', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({ language: 'en' }),
      }));
      const { createMessages } = await import('../../../src/utils/i18n.js');
      const messages = createMessages({
        FOO: { en: 'Hello', 'zh-CN': '你好' },
        BAR: { en: (n: number) => `${n} items`, 'zh-CN': (n: number) => `${n} 个` },
      });
      expect(messages.FOO).toBe('Hello');
      expect(messages.BAR(3)).toBe('3 items');
    });

    it('should return zh-CN messages when language is zh-CN', async () => {
      vi.doMock('../../../src/utils/config.js', () => ({
        loadConfig: () => ({ language: 'zh-CN' }),
      }));
      const { createMessages } = await import('../../../src/utils/i18n.js');
      const messages = createMessages({
        FOO: { en: 'Hello', 'zh-CN': '你好' },
        BAR: { en: (n: number) => `${n} items`, 'zh-CN': (n: number) => `${n} 个` },
      });
      expect(messages.FOO).toBe('你好');
      expect(messages.BAR(3)).toBe('3 个');
    });
  });
});