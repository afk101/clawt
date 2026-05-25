import chalk from 'chalk';
import Enquirer from 'enquirer';
import { DEFAULT_CONFIG, CONFIG_DEFINITIONS, MESSAGES } from '../constants/index.js';
import type { ClawtConfig } from '../types/index.js';
import { isNonInteractive } from './interactive.js';
import { ClawtError } from '../errors/index.js';

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
 * @param {string} key - 配置项名称
 * @param {unknown} currentValue - 当前值
 * @param {readonly string[]} [allowedValues] - 可选的枚举值列表
 * @returns {Promise<unknown>} 用户输入/选择的新值
 */
export async function promptConfigValue(
  key: string,
  currentValue: unknown,
  allowedValues?: readonly string[],
): Promise<unknown> {
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
  if (allowedValues) {
    return promptEnumValue(key, currentValue as string, allowedValues);
  }

  return promptStringValue(key, currentValue as string);
}

/**
 * 格式化配置值的显示样式
 * @param {unknown} value - 配置值
 * @returns {string} 格式化后的字符串
 */
export function formatConfigValue(value: unknown): string {
  if (value === undefined || value === null) {
    return chalk.dim(MESSAGES.NOT_SET);
  }
  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.yellow('false');
  }
  return chalk.cyan(String(value));
}

/**
 * 通用交互式配置编辑器
 * @param {T} config - 当前配置对象
 * @param {Record<string, { description: string; allowedValues?: readonly string[] }>} definitions - 配置项定义（含 description、allowedValues）
 * @param {object} [options] - 可选配置
 * @param {string} [options.selectPrompt] - 选择配置项的提示语
 * @param {Record<string, string>} [options.disabledKeys] - 不可编辑的键及其禁用提示
 * @returns {Promise<{ key: string; newValue: unknown }>} 修改后的 key 和 newValue
 */
export async function interactiveConfigEditor<T extends object>(
  config: T,
  definitions: Record<string, { description: string; allowedValues?: readonly string[] }>,
  options?: { selectPrompt?: string; disabledKeys?: Record<string, string> },
): Promise<{ key: keyof T; newValue: unknown }> {
  // 非交互模式下无法进行配置编辑，引导使用 config set 命令
  if (isNonInteractive()) {
    throw new ClawtError(MESSAGES.NON_INTERACTIVE_CONFIG_EDITOR);
  }

  const keys = Object.keys(definitions);
  const disabledKeys = options?.disabledKeys ?? {};
  const configRecord = config as Record<string, unknown>;

  // 构建选择列表，显示配置项名称、当前值和描述
  const choices = keys.map((k) => {
    const isDisabled = k in disabledKeys;
    const value = configRecord[k];
    const isObject = typeof value === 'object' && value !== null;
    return {
      name: k,
      message: `${k}: ${isObject || isDisabled ? chalk.dim(isObject ? JSON.stringify(value) : String(value ?? '')) : formatConfigValue(value)}  ${chalk.dim(`— ${definitions[k].description}`)}`,
      ...(isDisabled && { disabled: disabledKeys[k] }),
    };
  });

  // @ts-expect-error enquirer 类型声明未导出 Select 类，但运行时存在
  const selectedKey: string = await new Enquirer.Select({
    message: options?.selectPrompt ?? MESSAGES.CONFIG_SELECT_PROMPT,
    choices,
  }).run();

  // 根据类型和 allowedValues 自动选择提示策略
  const currentValue = configRecord[selectedKey];
  const definition = definitions[selectedKey];
  const newValue = await promptConfigValue(selectedKey, currentValue, definition.allowedValues);

  return { key: selectedKey as keyof T, newValue };
}

/**
 * 交互式布尔值选择（内部辅助函数）
 * @param {string} key - 配置项名称
 * @param {boolean} currentValue - 当前值
 * @returns {Promise<boolean>} 用户选择的布尔值
 */
async function promptBooleanValue(key: string, currentValue: boolean): Promise<boolean> {
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
 * @param {string} key - 配置项名称
 * @param {number} currentValue - 当前值
 * @returns {Promise<number>} 用户输入的数字值
 */
async function promptNumberValue(key: string, currentValue: number): Promise<number> {
  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  const input: string = await new Enquirer.Input({
    message: MESSAGES.CONFIG_INPUT_PROMPT(key),
    initial: String(currentValue),
    validate: (val: string) => {
      if (Number.isNaN(Number(val))) return MESSAGES.INVALID_NUMBER_PROMPT;
      return true;
    },
  }).run();

  return Number(input);
}

/**
 * 交互式枚举值选择（内部辅助函数，用于有 allowedValues 的 string 配置项）
 * @param {string} key - 配置项名称
 * @param {string} currentValue - 当前值
 * @param {readonly string[]} allowedValues - 允许的枚举值列表
 * @returns {Promise<string>} 用户选择的枚举值
 */
async function promptEnumValue(
  key: string,
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
 * @param {string} key - 配置项名称
 * @param {string} currentValue - 当前值
 * @returns {Promise<string>} 用户输入的字符串值
 */
async function promptStringValue(key: string, currentValue: string): Promise<string> {
  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  return await new Enquirer.Input({
    message: MESSAGES.CONFIG_INPUT_PROMPT(key),
    initial: currentValue || '',
  }).run();
}
