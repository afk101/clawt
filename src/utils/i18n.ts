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
 * 从 i18n 双语映射条目中提取当前语言对应的值类型
 */
type ExtractLang<T> = T extends { en: infer V; 'zh-CN': infer V } ? V : never;

/**
 * 创建国际化消息对象
 * 根据当前语言从双语映射中选择对应的文本或函数
 * 保留精确的键名和值类型，确保合并后的 MESSAGES 对象类型正确
 * @param {T} i18nMap - 双语消息映射，每个键包含 en 和 zh-CN 两个版本
 * @returns {{ [K in keyof T]: ExtractLang<T[K]> }} 当前语言的消息对象，键名和值类型与原始映射一致
 */
export function createMessages<T extends Record<string, { en: any; 'zh-CN': any }>>(
  i18nMap: T
): { [K in keyof T]: ExtractLang<T[K]> } {
  const lang = getCurrentLanguage();
  const result: any = {};
  for (const key of Object.keys(i18nMap)) {
    result[key] = i18nMap[key][lang];
  }
  return result;
}
