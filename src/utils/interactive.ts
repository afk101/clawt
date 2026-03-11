/**
 * 非交互模式判断工具
 * 优先级：CLI --yes > 环境变量 CI / CLAWT_NON_INTERACTIVE > 默认交互模式
 */

/** 运行时标志，由 --yes 全局选项在 preAction hook 中设置 */
let nonInteractiveFlag = false;

/**
 * 设置非交互模式运行时标志
 * @param {boolean} value - 是否启用非交互模式
 */
export function setNonInteractive(value: boolean): void {
  nonInteractiveFlag = value;
}

/**
 * 判断当前是否处于非交互模式
 * 检查顺序：运行时标志（--yes）→ CI 环境变量 → CLAWT_NON_INTERACTIVE 环境变量
 * @returns {boolean} 是否为非交互模式
 */
export function isNonInteractive(): boolean {
  if (nonInteractiveFlag) return true;
  if (process.env.CI === 'true' || process.env.CI === '1') return true;
  if (process.env.CLAWT_NON_INTERACTIVE === 'true' || process.env.CLAWT_NON_INTERACTIVE === '1') return true;
  return false;
}
