import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDuration, ProgressRenderer } from '../../../src/utils/progress.js';

describe('formatDuration', () => {
  it('小于 60 秒时显示秒数（保留一位小数）', () => {
    expect(formatDuration(5200)).toBe('5.2s');
  });

  it('0 毫秒时显示 0.0s', () => {
    expect(formatDuration(0)).toBe('0.0s');
  });

  it('59.9 秒时仍显示秒数', () => {
    expect(formatDuration(59900)).toBe('59.9s');
  });

  it('大于等于 60 秒时显示分秒格式', () => {
    expect(formatDuration(83000)).toBe('1m23s');
  });

  it('整分钟时秒数补零', () => {
    expect(formatDuration(120000)).toBe('2m00s');
  });

  it('大数值时正确格式化', () => {
    expect(formatDuration(3661000)).toBe('61m01s');
  });
});

describe('ProgressRenderer', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
    writeSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe('TTY 模式', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
    });

    it('start 时隐藏光标并渲染初始面板', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2']);
      renderer.start();
      renderer.stop();

      // 应有写入隐藏光标的调用
      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('\x1B[?25l');
      // 应有写入显示光标的调用
      expect(allOutput).toContain('\x1B[?25h');
    });

    it('start 后 stop 清除定时器并恢复光标', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('\x1B[?25h');
    });

    it('stop 幂等，多次调用不报错', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      renderer.stop();
      renderer.stop();
      renderer.stop();

      // 只有一次恢复光标
      const showCursorCount = writeSpy.mock.calls
        .map((c) => c[0])
        .filter((s) => typeof s === 'string' && s.includes('\x1B[?25h')).length;
      expect(showCursorCount).toBe(1);
    });

    it('渲染面板包含分支名和运行状态', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2']);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('feat-1');
      expect(allOutput).toContain('feat-2');
      expect(allOutput).toContain('运行中');

      renderer.stop();
    });

    it('markDone 后渲染显示完成状态', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.markDone(0, 5000, 0.05);
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('✓');
      expect(allOutput).toContain('完成');
      expect(allOutput).toContain('5.0s');
      expect(allOutput).toContain('$0.05');
    });

    it('markFailed 后渲染显示失败状态', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.markFailed(0, 3000);
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('✗');
      expect(allOutput).toContain('失败');
      expect(allOutput).toContain('3.0s');
    });

    it('updateActivity 更新后不立即渲染（等待定时器）', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      const callCountBefore = writeSpy.mock.calls.length;

      renderer.updateActivity(0);

      // updateActivity 不应触发额外的 write 调用
      expect(writeSpy.mock.calls.length).toBe(callCountBefore);

      renderer.stop();
    });

    it('allRunning=false 时任务初始化为 pending 状态', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], false);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('◦');
      expect(allOutput).toContain('排队中');

      renderer.stop();
    });

    it('markRunning 将 pending 任务标记为运行中', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], false);
      renderer.start();
      writeSpy.mockClear();

      renderer.markRunning(0);
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('运行中');
      // 第二个任务仍为排队中
      expect(allOutput).toContain('排队中');
    });

    it('allRunning=false 时面板包含汇总行', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2', 'feat-3'], false);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 汇总行应包含排队中的计数
      expect(allOutput).toContain('3/3');
      expect(allOutput).toContain('排队中');

      renderer.stop();
    });

    it('汇总行正确反映状态变化', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2', 'feat-3'], false);
      renderer.start();
      renderer.markRunning(0);
      renderer.markDone(0, 5000, 0.05);
      renderer.markRunning(1);
      writeSpy.mockClear();

      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 应包含：1/3 完成, 1/3 运行中, 1/3 排队中
      expect(allOutput).toContain('1/3');
    });
  });

  describe('非 TTY 模式', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    });

    it('start 时逐行输出启动信息', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2']);
      renderer.start();

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toContain('feat-1');
      expect(logSpy.mock.calls[0][0]).toContain('启动');
      expect(logSpy.mock.calls[1][0]).toContain('feat-2');

      renderer.stop();
    });

    it('markDone 时输出完成信息', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.markDone(0, 5000, 0.05);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('✓');
      expect(logSpy.mock.calls[0][0]).toContain('完成');
      expect(logSpy.mock.calls[0][0]).toContain('5.0s');
      expect(logSpy.mock.calls[0][0]).toContain('$0.05');

      renderer.stop();
    });

    it('markFailed 时输出失败信息', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.markFailed(0, 3000);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('✗');
      expect(logSpy.mock.calls[0][0]).toContain('失败');
      expect(logSpy.mock.calls[0][0]).toContain('3.0s');

      renderer.stop();
    });

    it('不使用 ANSI 转义码', () => {
      const renderer = new ProgressRenderer(['feat-1']);
      renderer.start();
      renderer.markDone(0, 5000, 0.05);
      renderer.stop();

      // process.stdout.write 不应被调用（非 TTY 模式用 console.log）
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('allRunning=false 时 start 不输出 pending 任务', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], false);
      renderer.start();

      // pending 任务不应输出启动信息
      expect(logSpy).not.toHaveBeenCalled();

      renderer.stop();
    });

    it('markRunning 时输出启动信息', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], false);
      renderer.start();

      renderer.markRunning(0);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('feat-1');
      expect(logSpy.mock.calls[0][0]).toContain('启动');

      renderer.stop();
    });
  });
});
