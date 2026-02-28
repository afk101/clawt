/**
 * 非对象类型的值直接转为字符串表示
 * @param {unknown} value - 任意值
 * @returns {string} 字符串表示
 */
function primitiveToString(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }
  return String(value);
}

/**
 * 安全的 JSON 序列化，兼容非 JSON 安全类型（undefined、function、Symbol、BigInt、循环引用等）
 * @param {unknown} value - 要序列化的值
 * @param {number} [indent=2] - 缩进空格数
 * @returns {string} 序列化后的 JSON 字符串，失败时返回兜底描述
 */
export function safeStringify(value: unknown, indent: number = 2): string {
  // 非对象类型直接转字符串，无需走 JSON.stringify
  if (value === null || typeof value !== 'object') {
    return primitiveToString(value);
  }

  try {
    // 利用 WeakSet 检测循环引用
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key: string, val: unknown) => {
        // 处理 BigInt 类型（JSON.stringify 默认不支持）
        if (typeof val === 'bigint') {
          return val.toString();
        }
        // 将 undefined、function、Symbol 转为可读字符串，避免被 JSON.stringify 丢弃
        if (typeof val === 'undefined' || typeof val === 'function' || typeof val === 'symbol') {
          return primitiveToString(val);
        }
        // 检测循环引用：对象类型且非 null 时才需要检查
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return '[Circular]';
          }
          seen.add(val);
        }
        return val;
      },
      indent,
    );
  } catch {
    // 极端情况兜底：尝试用 util.inspect 风格输出
    try {
      return JSON.stringify(String(value), null, indent);
    } catch {
      return '[Unserializable]';
    }
  }
}
