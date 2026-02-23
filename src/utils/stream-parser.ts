import path from 'node:path';
import type { ClaudeCodeResult } from '../types/index.js';
import {
  ACTIVITY_TEXT_MAX_LENGTH,
  TEXT_ACTIVITY_PREFIX,
} from '../constants/index.js';

// ============================================================
// 类型定义
// ============================================================

/** stream-json content 数组中的单个块 */
interface StreamContentBlock {
  /** 内容类型：tool_use / text / tool_result */
  type: string;
  /** 工具名称（tool_use 时） */
  name?: string;
  /** 工具调用参数（tool_use 时） */
  input?: Record<string, unknown>;
  /** 文本内容（text 时） */
  text?: string;
  /** 工具执行结果内容（tool_result 时） */
  content?: string;
}

/** stream-json 单行事件中 assistant/user 消息的 message 结构 */
interface StreamMessage {
  content?: StreamContentBlock[];
}

/** stream-json 单行事件的统一结构 */
export interface StreamEvent {
  /** 事件类型：system / assistant / user / result */
  type: string;
  /** 事件子类型 */
  subtype?: string;
  /** assistant/user 消息体 */
  message?: StreamMessage;
  /** user 消息的 content（tool_result 场景） */
  content?: StreamContentBlock[];
  // --- result 类型特有字段 ---
  /** 是否为错误结果 */
  is_error?: boolean;
  /** 总耗时（毫秒） */
  duration_ms?: number;
  /** API 调用耗时（毫秒） */
  duration_api_ms?: number;
  /** 交互轮次数 */
  num_turns?: number;
  /** 会话结果文本 */
  result?: string;
  /** 停止原因 */
  stop_reason?: string;
  /** 会话 ID */
  session_id?: string;
  /** 总费用（美元） */
  total_cost_usd?: number;
  /** 使用量统计 */
  usage?: Record<string, unknown>;
}

/** 解析出的活动信息 */
export interface ParsedActivity {
  /** 活动类型 */
  kind: 'tool_use' | 'text' | 'result';
  /** 格式化后的活动描述文本（已截断到 ACTIVITY_TEXT_MAX_LENGTH） */
  activityText: string;
  /** 最终结果对象（仅 kind=result 时有值） */
  result?: ClaudeCodeResult;
}

/** 行缓冲器，处理 data 事件中的不完整行 */
export interface LineBuffer {
  /** 追加数据并返回完整的行 */
  push(chunk: string): string[];
  /** 获取缓冲区中剩余的不完整数据（流结束时调用） */
  flush(): string | null;
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 创建行缓冲器，用于处理流式数据中的不完整行
 * stdout 的 data 事件可能在行中间切割，需要缓冲直到遇到换行符
 * @returns {LineBuffer} 行缓冲器实例
 */
export function createLineBuffer(): LineBuffer {
  let buffer = '';
  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const lines = buffer.split('\n');
      // 最后一个元素可能是不完整的行，保留在缓冲区
      buffer = lines.pop() ?? '';
      return lines;
    },
    flush(): string | null {
      const remaining = buffer;
      buffer = '';
      return remaining || null;
    },
  };
}

/**
 * 解析单行 stream-json 输出为事件对象
 * 忽略空行和非 JSON 行
 * @param {string} line - 单行文本
 * @returns {StreamEvent | null} 解析成功返回事件对象，失败返回 null
 */
export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as StreamEvent;
  } catch {
    // 非 JSON 行（verbose 模式可能有额外日志），静默忽略
    return null;
  }
}

/**
 * 将文本截断到指定最大长度，超长部分用省略号替代
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大字符数
 * @returns {string} 截断后的文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '…';
}

/**
 * 根据活动类型和参数生成活动描述文本
 * tool_use 类型直接使用英文工具名，有 file_path 参数时追加文件名
 * 输出最大长度为 ACTIVITY_TEXT_MAX_LENGTH（30 字符），超出截断并追加省略号
 * @param {'tool_use' | 'text'} kind - 活动类型
 * @param {string} [toolName] - 工具名（tool_use 时）
 * @param {Record<string, unknown>} [input] - 工具参数（tool_use 时）
 * @param {string} [text] - 文本内容（text 时）
 * @returns {string} 格式化后的活动描述文本
 */
export function formatActivityText(
  kind: 'tool_use' | 'text',
  toolName?: string,
  input?: Record<string, unknown>,
  text?: string,
): string {
  let raw = '';

  if (kind === 'tool_use' && toolName) {
    // 对有文件路径参数的工具，追加文件名
    const filePath = input?.file_path as string | undefined;
    // 对有 command 参数的工具（如 Bash），追加命令内容
    const command = input?.command as string | undefined;
    if (filePath) {
      const basename = path.basename(filePath);
      raw = `${toolName} ${basename}`;
    } else if (command) {
      // 清理命令中的换行和多余空白
      const cleaned = command.replace(/[\n\r\t]+/g, ' ').trim();
      raw = `${toolName} ${cleaned}`;
    } else {
      raw = toolName;
    }
  } else if (kind === 'text' && text) {
    // 清理控制字符和换行
    const cleaned = text.replace(/[\n\r\t]/g, ' ').trim();
    if (!cleaned) return '';
    raw = `${TEXT_ACTIVITY_PREFIX}: ${cleaned}`;
  }

  if (!raw) return '';

  return truncateText(raw, ACTIVITY_TEXT_MAX_LENGTH);
}

/**
 * 从流式事件中提取活动信息
 * 仅处理以下有意义的事件：
 * 1. type=assistant + content 含 tool_use → 提取工具名和参数
 * 2. type=assistant + content 含 text → 提取文本片段
 * 3. type=result → 最终结果，构造 ClaudeCodeResult
 * @param {StreamEvent} event - 流式事件对象
 * @returns {ParsedActivity | null} 提取的活动信息，无关事件返回 null
 */
export function parseStreamEvent(event: StreamEvent): ParsedActivity | null {
  // 最终结果事件
  if (event.type === 'result') {
    const result: ClaudeCodeResult = {
      type: event.type,
      subtype: event.subtype ?? '',
      is_error: event.is_error ?? false,
      duration_ms: event.duration_ms ?? 0,
      duration_api_ms: event.duration_api_ms ?? 0,
      num_turns: event.num_turns ?? 0,
      result: event.result ?? '',
      stop_reason: event.stop_reason ?? '',
      session_id: event.session_id ?? '',
      total_cost_usd: event.total_cost_usd ?? 0,
      usage: event.usage ?? {},
    };
    return { kind: 'result', activityText: '', result };
  }

  // assistant 消息：从 message.content 中提取
  if (event.type === 'assistant') {
    const content = event.message?.content;
    if (!content || content.length === 0) return null;

    // 优先查找 tool_use（取最后一个，代表最新操作）
    let lastToolUse: StreamContentBlock | null = null;
    let lastText: StreamContentBlock | null = null;

    for (const block of content) {
      if (block.type === 'tool_use') {
        lastToolUse = block;
      } else if (block.type === 'text') {
        lastText = block;
      }
    }

    // tool_use 优先级高于 text
    if (lastToolUse) {
      const activityText = formatActivityText(
        'tool_use',
        lastToolUse.name,
        lastToolUse.input,
      );
      if (activityText) {
        return { kind: 'tool_use', activityText };
      }
    }

    if (lastText?.text) {
      const activityText = formatActivityText('text', undefined, undefined, lastText.text);
      if (activityText) {
        return { kind: 'text', activityText };
      }
    }

    return null;
  }

  // user 消息中的 tool_result 不更新活动文本（紧接着会有下一个 assistant 消息）
  // 其他类型（system 等）忽略
  return null;
}
