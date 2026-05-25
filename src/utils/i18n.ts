import { loadConfig } from './config.js';

/** 支持的语言类型 */
export type Language = 'en' | 'zh-CN';

/** 当前语言缓存 */
let currentLanguage: Language | null = null;

/**
 * 获取当前语言配置
 * 优先使用缓存，缓存不存在时从配置文件读取
 * @returns {Language} 当前语言
 */
export function getCurrentLanguage(): Language {
  if (currentLanguage !== null) {
    return currentLanguage;
  }
  try {
    const config = loadConfig();
    currentLanguage = (config.language as Language) || 'en';
  } catch {
    currentLanguage = 'en';
  }
  return currentLanguage;
}

/**
 * 设置当前语言（用于测试和 CLI 初始化时）
 * @param {Language} lang - 语言代码
 */
export function setCurrentLanguage(lang: Language): void {
  currentLanguage = lang;
}

/**
 * 重置语言缓存（配置变更后调用，使下次读取时重新加载）
 */
export function resetLanguageCache(): void {
  currentLanguage = null;
}

/**
 * 创建国际化消息对象
 * 根据当前语言从双语映射中选择对应的文本或函数
 * @param {Record<string, { en: T; 'zh-CN': T }>} i18nMap - 双语消息映射
 * @returns {Record<string, T>} 当前语言的消息对象
 */
export function createMessages<T>(i18nMap: Record<string, { en: T; 'zh-CN': T }>): Record<string, T> {
  const lang = getCurrentLanguage();
  const result: Record<string, T> = {};
  for (const key of Object.keys(i18nMap)) {
    result[key] = i18nMap[key][lang];
  }
  return result;
}
