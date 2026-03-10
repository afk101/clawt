# Project Memory

## 编码规范

- JSON 序列化必须使用项目封装的 `safeStringify`（位于 `src/utils/json.ts`），禁止直接使用原生 `JSON.stringify`。`safeStringify` 已通过 `src/utils/index.js` 统一导出。
- 构造输出对象时，使用 `{ ...obj }` 解构展开而非逐字段列举，避免源类型新增字段后遗漏。
