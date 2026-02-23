import { describe, it, expect } from 'vitest';
import {
  createLineBuffer,
  parseStreamLine,
  parseStreamEvent,
  formatActivityText,
  truncateText,
} from '../../../src/utils/stream-parser.js';
import type { StreamEvent } from '../../../src/utils/stream-parser.js';

describe('stream-parser', () => {
  // ============================================================
  // createLineBuffer
  // ============================================================
  describe('createLineBuffer', () => {
    it('单行完整数据正常返回', () => {
      const buf = createLineBuffer();
      const lines = buf.push('hello\n');
      expect(lines).toEqual(['hello']);
    });

    it('多行数据一次返回多行', () => {
      const buf = createLineBuffer();
      const lines = buf.push('line1\nline2\nline3\n');
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('跨越多个 chunk 的行正确拼接', () => {
      const buf = createLineBuffer();
      const lines1 = buf.push('hel');
      expect(lines1).toEqual([]);

      const lines2 = buf.push('lo\n');
      expect(lines2).toEqual(['hello']);
    });

    it('flush 返回未完成的行', () => {
      const buf = createLineBuffer();
      buf.push('incomplete');
      const remaining = buf.flush();
      expect(remaining).toBe('incomplete');
    });

    it('flush 在缓冲区为空时返回 null', () => {
      const buf = createLineBuffer();
      buf.push('complete\n');
      const remaining = buf.flush();
      expect(remaining).toBeNull();
    });

    it('连续调用 push 不丢数据', () => {
      const buf = createLineBuffer();
      buf.push('aa');
      buf.push('bb');
      buf.push('cc\ndd');
      const lines = buf.push('ee\n');
      expect(lines).toEqual(['ddee']);

      // flush 后缓冲区应为空
      expect(buf.flush()).toBeNull();
    });
  });

  // ============================================================
  // parseStreamLine
  // ============================================================
  describe('parseStreamLine', () => {
    it('空行返回 null', () => {
      expect(parseStreamLine('')).toBeNull();
    });

    it('空白行（只有空格/制表符）返回 null', () => {
      expect(parseStreamLine('   \t  ')).toBeNull();
    });

    it('合法 JSON 行返回解析后的对象', () => {
      const result = parseStreamLine('{"type":"result","is_error":false}');
      expect(result).toEqual({ type: 'result', is_error: false });
    });

    it('非 JSON 文本返回 null', () => {
      expect(parseStreamLine('this is not json')).toBeNull();
    });

    it('含有首尾空白的 JSON 行正确解析', () => {
      const result = parseStreamLine('  {"type":"system"}  ');
      expect(result).toEqual({ type: 'system' });
    });
  });

  // ============================================================
  // truncateText
  // ============================================================
  describe('truncateText', () => {
    it('短文本不截断', () => {
      expect(truncateText('hello', 10)).toBe('hello');
    });

    it('恰好等于长度的文本不截断', () => {
      expect(truncateText('12345', 5)).toBe('12345');
    });

    it('长文本截断到指定长度并追加省略号', () => {
      const result = truncateText('这是一段很长的文本需要被截断', 10);
      expect(result).toHaveLength(10);
      expect(result.endsWith('…')).toBe(true);
      // maxLength=10 时截取前 9 个字符 + 省略号
      expect(result).toBe('这是一段很长的文本…');
    });
  });

  // ============================================================
  // formatActivityText
  // ============================================================
  describe('formatActivityText', () => {
    it('Read 工具 + file_path 参数生成正确描述', () => {
      const result = formatActivityText('tool_use', 'Read', { file_path: '/src/utils/git.ts' });
      expect(result).toBe('Read git.ts');
    });

    it('Edit 工具 + file_path 参数生成正确描述', () => {
      const result = formatActivityText('tool_use', 'Edit', { file_path: '/src/utils/progress.ts' });
      expect(result).toBe('Edit progress.ts');
    });

    it('Write 工具 + file_path 参数生成正确描述', () => {
      const result = formatActivityText('tool_use', 'Write', { file_path: '/a/b/c.ts' });
      expect(result).toBe('Write c.ts');
    });

    it('Bash 工具追加 command 内容', () => {
      const result = formatActivityText('tool_use', 'Bash', { command: 'ls -la' });
      expect(result).toBe('Bash ls -la');
    });

    it('Bash 工具长命令被截断', () => {
      const result = formatActivityText('tool_use', 'Bash', { command: 'git log --oneline --graph --all --decorate' });
      expect(result.length).toBeLessThanOrEqual(30);
      expect(result.startsWith('Bash')).toBe(true);
      expect(result.endsWith('…')).toBe(true);
    });

    it('Bash 工具 command 含换行时被清理', () => {
      const result = formatActivityText('tool_use', 'Bash', { command: 'echo hello\n&& echo world' });
      expect(result).not.toContain('\n');
      expect(result).toContain('Bash');
    });

    it('Glob 工具无 file_path 只显示工具名', () => {
      const result = formatActivityText('tool_use', 'Glob', { pattern: '*.ts' });
      expect(result).toBe('Glob');
    });

    it('Grep 工具无 file_path 只显示工具名', () => {
      const result = formatActivityText('tool_use', 'Grep', { pattern: 'TODO' });
      expect(result).toBe('Grep');
    });

    it('自定义工具直接显示英文名', () => {
      const result = formatActivityText('tool_use', 'CustomTool', {});
      expect(result).toBe('CustomTool');
    });

    it('text 类型活动生成思考中描述', () => {
      const result = formatActivityText('text', undefined, undefined, '让我分析一下');
      expect(result).toBe('思考中: 让我分析一下');
    });

    it('超长活动文本被截断到 30 字符', () => {
      const result = formatActivityText('tool_use', 'Read', {
        file_path: '/very/long/path/to/a/file/that/has/very/long/name/example.ts',
      });
      expect(result.length).toBeLessThanOrEqual(30);
      expect(result.startsWith('Read')).toBe(true);
    });

    it('text 包含换行和制表符时被清理', () => {
      const result = formatActivityText('text', undefined, undefined, '行1\n行2\t行3');
      expect(result).not.toContain('\n');
      expect(result).not.toContain('\t');
      expect(result).toContain('思考中');
    });

    it('空文本返回空字符串', () => {
      const result = formatActivityText('text', undefined, undefined, '');
      expect(result).toBe('');
    });

    it('只有空白字符的文本返回空字符串', () => {
      const result = formatActivityText('text', undefined, undefined, '  \n\t  ');
      expect(result).toBe('');
    });

    it('无 toolName 时返回空字符串', () => {
      const result = formatActivityText('tool_use');
      expect(result).toBe('');
    });

    it('无 file_path 的 Read 工具只显示工具名', () => {
      const result = formatActivityText('tool_use', 'Read', {});
      expect(result).toBe('Read');
    });
  });

  // ============================================================
  // parseStreamEvent
  // ============================================================
  describe('parseStreamEvent', () => {
    it('type=result 事件提取 ClaudeCodeResult', () => {
      const event: StreamEvent = {
        type: 'result',
        subtype: 'success',
        is_error: false,
        duration_ms: 5000,
        duration_api_ms: 4000,
        num_turns: 3,
        result: '任务完成',
        stop_reason: 'end_turn',
        session_id: 'sess-123',
        total_cost_usd: 0.05,
        usage: { input_tokens: 100, output_tokens: 200 },
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).not.toBeNull();
      expect(parsed!.kind).toBe('result');
      expect(parsed!.activityText).toBe('');
      expect(parsed!.result).toEqual({
        type: 'result',
        subtype: 'success',
        is_error: false,
        duration_ms: 5000,
        duration_api_ms: 4000,
        num_turns: 3,
        result: '任务完成',
        stop_reason: 'end_turn',
        session_id: 'sess-123',
        total_cost_usd: 0.05,
        usage: { input_tokens: 100, output_tokens: 200 },
      });
    });

    it('type=result 事件字段缺失时使用默认值', () => {
      const event: StreamEvent = { type: 'result' };
      const parsed = parseStreamEvent(event);
      expect(parsed).not.toBeNull();
      expect(parsed!.result!.is_error).toBe(false);
      expect(parsed!.result!.duration_ms).toBe(0);
      expect(parsed!.result!.total_cost_usd).toBe(0);
    });

    it('type=assistant + tool_use 提取工具名和参数', () => {
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/src/index.ts' },
            },
          ],
        },
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).not.toBeNull();
      expect(parsed!.kind).toBe('tool_use');
      expect(parsed!.activityText).toBe('Read index.ts');
    });

    it('type=assistant + text 提取文本片段', () => {
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: '让我来分析这个问题',
            },
          ],
        },
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).not.toBeNull();
      expect(parsed!.kind).toBe('text');
      expect(parsed!.activityText).toContain('思考中');
    });

    it('同时有 tool_use 和 text 时优先返回 tool_use', () => {
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '我来看看' },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).not.toBeNull();
      expect(parsed!.kind).toBe('tool_use');
      expect(parsed!.activityText).toBe('Bash ls');
    });

    it('多个 tool_use 时取最后一个', () => {
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/a.ts' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/b.ts' } },
          ],
        },
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).not.toBeNull();
      expect(parsed!.activityText).toBe('Edit b.ts');
    });

    it('type=user（tool_result）返回 null', () => {
      const event: StreamEvent = {
        type: 'user',
        content: [
          { type: 'tool_result', content: '文件内容' },
        ],
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).toBeNull();
    });

    it('type=system 返回 null', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).toBeNull();
    });

    it('content 为空数组时返回 null', () => {
      const event: StreamEvent = {
        type: 'assistant',
        message: { content: [] },
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).toBeNull();
    });

    it('message 缺失时返回 null', () => {
      const event: StreamEvent = {
        type: 'assistant',
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).toBeNull();
    });

    it('message.content 缺失时返回 null', () => {
      const event: StreamEvent = {
        type: 'assistant',
        message: {},
      };

      const parsed = parseStreamEvent(event);
      expect(parsed).toBeNull();
    });
  });
});
