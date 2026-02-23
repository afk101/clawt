import chalk from 'chalk';
import Enquirer from 'enquirer';
import { DEFAULT_CONFIG, CONFIG_DEFINITIONS, MESSAGES } from '../constants/index.js';
import type { ClawtConfig } from '../types/index.js';

/**
 * 校验 key 是否为有效的配置项名称
 * @param {string} key - 待校验的配置项名称
 * @returns {boolean} 是否有效
 */
export function isValidConfigKey(key: string): key is keyof ClawtConfig {
  return key in DEFAULT_CONFIG;
}

/**
 * 获取所有有效配置项名称列表
 * @returns {string[]} 配置项名称数组
 */
export function getValidConfigKeys(): string[] {
  return Object.keys(DEFAULT_CONFIG);
}

/**
 * 将字符串值解析并校验为目标配置项的正确类型
 *
 * 策略分发规则：
 * - boolean → 解析 'true'/'false'
 * - number → Number() 解析
 * - string + 有 allowedValues → 枚举校验
 * - string + 无 allowedValues → 无额外校验
 *
 * @param {keyof ClawtConfig} key - 配置项名称
 * @param {string} rawValue - 原始字符串值
 * @returns {{ success: true; value: ClawtConfig[keyof ClawtConfig] } | { success: false; error: string }} 解析结果
 */
export function parseConfigValue(
  key: keyof ClawtConfig,
  rawValue: string,
): { success: true; value: ClawtConfig[keyof ClawtConfig] } | { success: false; error: string } {
  const expectedType = typeof DEFAULT_CONFIG[key];

  // 布尔类型策略
  if (expectedType === 'boolean') {
    if (rawValue === 'true') return { success: true, value: true };
    if (rawValue === 'false') return { success: true, value: false };
    return { success: false, error: MESSAGES.CONFIG_INVALID_BOOLEAN(key) };
  }

  // 数字类型策略
  if (expectedType === 'number') {
    const num = Number(rawValue);
    if (Number.isNaN(num)) {
      return { success: false, error: MESSAGES.CONFIG_INVALID_NUMBER(key) };
    }
    return { success: true, value: num };
  }

  // 字符串类型：根据 allowedValues 自动选择校验策略
  const definition = CONFIG_DEFINITIONS[key];
  if (definition.allowedValues && !definition.allowedValues.includes(rawValue)) {
    return { success: false, error: MESSAGES.CONFIG_INVALID_ENUM(key, definition.allowedValues) };
  }

  return { success: true, value: rawValue };
}

/**
 * 交互式提示用户输入配置值
 *
 * 策略分发规则：
 * - boolean → Select(true, false)
 * - number → Input(带数字校验)
 * - string + 有 allowedValues → Select(枚举列表)
 * - string + 无 allowedValues → Input(自由输入)
 *
 * @param {keyof ClawtConfig} key - 配置项名称
 * @param {ClawtConfig[keyof ClawtConfig]} currentValue - 当前值
 * @returns {Promise<ClawtConfig[keyof ClawtConfig]>} 用户输入/选择的新值
 */
export async function promptConfigValue(
  key: keyof ClawtConfig,
  currentValue: ClawtConfig[keyof ClawtConfig],
): Promise<ClawtConfig[keyof ClawtConfig]> {
  const expectedType = typeof currentValue;

  // 布尔类型策略
  if (expectedType === 'boolean') {
    return promptBooleanValue(key, currentValue as boolean);
  }

  // 数字类型策略
  if (expectedType === 'number') {
    return promptNumberValue(key, currentValue as number);
  }

  // 字符串类型：根据 allowedValues 自动选择提示策略
  const definition = CONFIG_DEFINITIONS[key];
  if (definition.allowedValues) {
    return promptEnumValue(key, currentValue as string, definition.allowedValues);
  }

  return promptStringValue(key, currentValue as string);
}

/**
 * 格式化配置值的显示样式
 * @param {ClawtConfig[keyof ClawtConfig]} value - 配置值
 * @returns {string} 格式化后的字符串
 */
export function formatConfigValue(value: ClawtConfig[keyof ClawtConfig]): string {
  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.yellow('false');
  }
  return chalk.cyan(String(value));
}

/**
 * 交互式布尔值选择（内部辅助函数）
 * @param {keyof ClawtConfig} key - 配置项名称
 * @param {boolean} currentValue - 当前值
 * @returns {Promise<boolean>} 用户选择的布尔值
 */
async function promptBooleanValue(key: keyof ClawtConfig, currentValue: boolean): Promise<boolean> {
  const choices = [
    { name: 'true', message: 'true' },
    { name: 'false', message: 'false' },
  ];

  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const selected: string = await new Enquirer.Select({
    message: MESSAGES.CONFIG_INPUT_PROMPT(key),
    choices,
    initial: currentValue ? 0 : 1,
  }).run();

  return selected === 'true';
}

/**
 * 交互式数字输入（内部辅助函数）
 * @param {keyof ClawtConfig} key - 配置项名称
 * @param {number} currentValue - 当前值
 * @returns {Promise<number>} 用户输入的数字值
 */
async function promptNumberValue(key: keyof ClawtConfig, currentValue: number): Promise<number> {
  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  const input: string = await new Enquirer.Input({
    message: MESSAGES.CONFIG_INPUT_PROMPT(key),
    initial: String(currentValue),
    validate: (val: string) => {
      if (Number.isNaN(Number(val))) return '请输入有效的数字';
      return true;
    },
  }).run();

  return Number(input);
}

/**
 * 交互式枚举值选择（内部辅助函数，用于有 allowedValues 的 string 配置项）
 * @param {keyof ClawtConfig} key - 配置项名称
 * @param {string} currentValue - 当前值
 * @param {readonly string[]} allowedValues - 允许的枚举值列表
 * @returns {Promise<string>} 用户选择的枚举值
 */
async function promptEnumValue(
  key: keyof ClawtConfig,
  currentValue: string,
  allowedValues: readonly string[],
): Promise<string> {
  const choices = allowedValues.map((v) => ({
    name: v,
    message: v,
  }));

  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  return await new Enquirer.Select({
    message: MESSAGES.CONFIG_INPUT_PROMPT(key),
    choices,
    initial: allowedValues.indexOf(currentValue),
  }).run();
}

/**
 * 交互式字符串自由输入（内部辅助函数，用于无 allowedValues 的 string 配置项）
 * @param {keyof ClawtConfig} key - 配置项名称
 * @param {string} currentValue - 当前值
 * @returns {Promise<string>} 用户输入的字符串值
 */
async function promptStringValue(key: keyof ClawtConfig, currentValue: string): Promise<string> {
  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  return await new Enquirer.Input({
    message: MESSAGES.CONFIG_INPUT_PROMPT(key),
    initial: currentValue,
  }).run();
}
