import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressRenderer } from '../../../src/utils/progress.js';

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
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2']);
      renderer.start();
      renderer.stop();

      // 应有写入隐藏光标的调用
      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('\x1B[?25l');
      // 应有写入显示光标的调用
      expect(allOutput).toContain('\x1B[?25h');
    });

    it('start 后 stop 清除定时器并恢复光标', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('\x1B[?25h');
    });

    it('stop 幂等，多次调用不报错', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
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

    it('渲染面板第二列显示路径和运行状态', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2']);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 第二列应显示路径
      expect(allOutput).toContain('/path/feat-1');
      expect(allOutput).toContain('/path/feat-2');
      expect(allOutput).toContain('运行中');
      // running 状态下不显示额外路径信息

      renderer.stop();
    });

    it('markDone 后渲染显示完成状态和结果预览', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.markDone(0, 5000, 0.05, '任务已成功完成');
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('✓');
      expect(allOutput).toContain('完成');
      expect(allOutput).toContain('5.0s');
      expect(allOutput).toContain('$0.05');
      // 第二列显示路径
      expect(allOutput).toContain('/path/feat-1');
      // 末尾显示结果预览
      expect(allOutput).toContain('任务已成功完成');
    });

    it('markDone 无 resultPreview 时末尾不显示预览', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.markDone(0, 5000, 0.05);
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('✓');
      expect(allOutput).toContain('完成');
      expect(allOutput).toContain('5.0s');
      expect(allOutput).toContain('$0.05');
      // 第二列仍显示路径
      expect(allOutput).toContain('/path/feat-1');
    });

    it('markFailed 后渲染显示失败状态和结果预览', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.markFailed(0, 3000, '执行过程中发生错误');
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('✗');
      expect(allOutput).toContain('失败');
      expect(allOutput).toContain('3.0s');
      // 第二列显示路径
      expect(allOutput).toContain('/path/feat-1');
      // 末尾显示结果预览
      expect(allOutput).toContain('执行过程中发生错误');
    });

    it('markFailed 无 resultPreview 时末尾不显示预览', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.markFailed(0, 3000);
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('✗');
      expect(allOutput).toContain('失败');
      expect(allOutput).toContain('3.0s');
      // 第二列仍显示路径
      expect(allOutput).toContain('/path/feat-1');
    });

    it('updateActivity 更新后不立即渲染（等待定时器）', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      const callCountBefore = writeSpy.mock.calls.length;

      renderer.updateActivity(0);

      // updateActivity 不应触发额外的 write 调用
      expect(writeSpy.mock.calls.length).toBe(callCountBefore);

      renderer.stop();
    });

    it('allRunning=false 时任务初始化为 pending 状态', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2'], false);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('◦');
      expect(allOutput).toContain('排队中');

      renderer.stop();
    });

    it('markRunning 将 pending 任务标记为运行中', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2'], false);
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
      const renderer = new ProgressRenderer(['feat-1', 'feat-2', 'feat-3'], ['/path/feat-1', '/path/feat-2', '/path/feat-3'], false);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 汇总行应包含排队中的计数
      expect(allOutput).toContain('3/3');
      expect(allOutput).toContain('排队中');

      renderer.stop();
    });

    it('汇总行正确反映状态变化', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2', 'feat-3'], ['/path/feat-1', '/path/feat-2', '/path/feat-3'], false);
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

    it('updateActivityText 更新活动文本后渲染显示活动信息', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      writeSpy.mockClear();

      renderer.updateActivityText(0, '正在读取 git.ts');
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(allOutput).toContain('正在读取 git.ts');
    });

    it('活动文本为 null 时 running 状态不显示额外信息', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      // 不调用 updateActivityText，activity 保持为 null
      writeSpy.mockClear();

      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 第二列显示路径
      expect(allOutput).toContain('/path/feat-1');
      expect(allOutput).toContain('运行中');
    });

    it('任务完成后活动文本不再显示', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.updateActivityText(0, '正在读取 git.ts');
      renderer.markDone(0, 5000, 0.05, '代码审查完成');
      writeSpy.mockClear();

      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 完成状态第二列显示路径，末尾显示结果预览
      expect(allOutput).toContain('/path/feat-1');
      expect(allOutput).toContain('✓');
      expect(allOutput).toContain('代码审查完成');
    });

    it('updateActivityText 不触发额外渲染（等待定时器）', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      const callCountBefore = writeSpy.mock.calls.length;

      renderer.updateActivityText(0, '正在编辑 index.ts');

      // updateActivityText 不应触发额外的 write 调用
      expect(writeSpy.mock.calls.length).toBe(callCountBefore);

      renderer.stop();
    });

    it('pending 状态不显示路径末尾信息', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1'], false);
      renderer.start();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // pending 状态第二列应显示路径，末尾无额外路径
      expect(allOutput).toContain('/path/feat-1');
      expect(allOutput).toContain('排队中');

      renderer.stop();
    });
  });

  describe('TTY 模式 — 窄终端宽度', () => {
    let originalColumns: number | undefined;

    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      originalColumns = process.stdout.columns;
    });

    afterEach(() => {
      Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true, configurable: true });
    });

    it('输出中包含 CLEAR_SCREEN 序列', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // CLEAR_SCREEN = '\x1B[2J'
      expect(allOutput).toContain('\x1B[2J');
    });

    it('窄终端下输出行的可见宽度不超过终端列数', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 40, writable: true, configurable: true });
      const renderer = new ProgressRenderer(
        ['feat-very-long-branch-name'],
        ['/very/long/path/to/worktree/feat-very-long-branch-name'],
      );
      renderer.start();
      renderer.stop();

      // 检查每个以换行结尾的输出行
      for (const call of writeSpy.mock.calls) {
        const output = call[0] as string;
        if (typeof output === 'string' && output.endsWith('\n')) {
          // 移除 ANSI 转义码后检查可见宽度
          const line = output.replace(/\n$/, '');
          // 跳过纯控制序列行（如 CURSOR_HIDE、CLEAR_SCREEN、CURSOR_HOME）
          if (line.length > 0 && !line.match(/^\x1B\[/)) {
            // 使用 strip-ansi 计算可见宽度不超过 40
            const stripped = line.replace(/\x1B\[[0-9;]*m/g, '');
            expect(stripped.length).toBeLessThanOrEqual(40);
          }
        }
      }
    });

  });

  describe('非 TTY 模式', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    });

    it('start 时逐行输出启动信息', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2']);
      renderer.start();

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toContain('feat-1');
      expect(logSpy.mock.calls[0][0]).toContain('启动');
      expect(logSpy.mock.calls[1][0]).toContain('feat-2');

      renderer.stop();
    });

    it('markDone 时输出完成信息和结果预览', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.markDone(0, 5000, 0.05, '任务已成功完成');

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('✓');
      expect(logSpy.mock.calls[0][0]).toContain('完成');
      expect(logSpy.mock.calls[0][0]).toContain('5.0s');
      expect(logSpy.mock.calls[0][0]).toContain('$0.05');
      // 末尾显示结果预览
      expect(logSpy.mock.calls[0][0]).toContain('任务已成功完成');

      renderer.stop();
    });

    it('markDone 无 resultPreview 时回退显示路径', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.markDone(0, 5000, 0.05);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('✓');
      expect(logSpy.mock.calls[0][0]).toContain('完成');
      // 无 resultPreview 时回退到 path
      expect(logSpy.mock.calls[0][0]).toContain('/path/feat-1');

      renderer.stop();
    });

    it('markFailed 时输出失败信息和结果预览', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.markFailed(0, 3000, '执行过程中发生错误');

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('✗');
      expect(logSpy.mock.calls[0][0]).toContain('失败');
      expect(logSpy.mock.calls[0][0]).toContain('3.0s');
      // 末尾显示结果预览
      expect(logSpy.mock.calls[0][0]).toContain('执行过程中发生错误');

      renderer.stop();
    });

    it('markFailed 无 resultPreview 时回退显示路径', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.markFailed(0, 3000);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('✗');
      expect(logSpy.mock.calls[0][0]).toContain('失败');
      expect(logSpy.mock.calls[0][0]).toContain('3.0s');
      // 无 resultPreview 时回退到 path
      expect(logSpy.mock.calls[0][0]).toContain('/path/feat-1');

      renderer.stop();
    });

    it('不使用 ANSI 转义码', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.markDone(0, 5000, 0.05);
      renderer.stop();

      // process.stdout.write 不应被调用（非 TTY 模式用 console.log）
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('allRunning=false 时 start 不输出 pending 任务', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2'], false);
      renderer.start();

      // pending 任务不应输出启动信息
      expect(logSpy).not.toHaveBeenCalled();

      renderer.stop();
    });

    it('markRunning 时输出启动信息', () => {
      const renderer = new ProgressRenderer(['feat-1', 'feat-2'], ['/path/feat-1', '/path/feat-2'], false);
      renderer.start();

      renderer.markRunning(0);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('feat-1');
      expect(logSpy.mock.calls[0][0]).toContain('启动');

      renderer.stop();
    });

    it('非 TTY 环境下 updateActivityText 不输出活动信息', () => {
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      logSpy.mockClear();

      renderer.updateActivityText(0, '正在读取 git.ts');

      // 非 TTY 模式不应输出活动文本
      expect(logSpy).not.toHaveBeenCalled();

      renderer.stop();
    });
  });

  describe('TTY 模式 — 动态终端宽度', () => {
    let originalColumns: number | undefined;
    let onSpy: ReturnType<typeof vi.spyOn>;
    let removeListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      originalColumns = process.stdout.columns;
      onSpy = vi.spyOn(process.stdout, 'on');
      removeListenerSpy = vi.spyOn(process.stdout, 'removeListener');
    });

    afterEach(() => {
      Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true, configurable: true });
      onSpy.mockRestore();
      removeListenerSpy.mockRestore();
    });

    it('start 注册 resize 监听，stop 移除', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();

      // 验证 resize 监听已注册
      const resizeCalls = onSpy.mock.calls.filter((c) => c[0] === 'resize');
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

      renderer.stop();

      // 验证 resize 监听已移除
      const removeCalls = removeListenerSpy.mock.calls.filter((c) => c[0] === 'resize');
      expect(removeCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('start 时进入备选屏幕缓冲区', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // ALT_SCREEN_ENTER = '\x1B[?1049h'
      expect(allOutput).toContain('\x1B[?1049h');
    });

    it('stop 时退出备选屏幕缓冲区', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // ALT_SCREEN_LEAVE = '\x1B[?1049l'
      expect(allOutput).toContain('\x1B[?1049l');
    });

    it('stop 后在主屏幕输出最终面板状态', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.markDone(0, 5000, 0.05, '代码审查完成');
      renderer.stop();

      // 找到 ALT_SCREEN_LEAVE 之后的输出（即主屏幕上的最终状态）
      const allCalls = writeSpy.mock.calls.map((c) => c[0] as string);
      const leaveIndex = allCalls.findIndex((s) => s === '\x1B[?1049l');
      expect(leaveIndex).toBeGreaterThan(-1);

      // ALT_SCREEN_LEAVE 之后应有面板最终状态输出
      const afterLeave = allCalls.slice(leaveIndex + 1).join('');
      expect(afterLeave).toContain('✓');
      expect(afterLeave).toContain('完成');
      expect(afterLeave).toContain('/path/feat-1');
      expect(afterLeave).toContain('代码审查完成');
    });

    it('exit 兜底处理器包含退出备选屏幕', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const processOnSpy = vi.spyOn(process, 'on');

      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();

      // 提取 exit 处理器
      const exitCall = processOnSpy.mock.calls.find((c) => c[0] === 'exit');
      expect(exitCall).toBeDefined();
      const exitHandler = exitCall![1] as () => void;

      // 清空已有调用记录
      writeSpy.mockClear();

      // 模拟调用 exit 处理器
      exitHandler();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 应包含恢复行换行、显示光标、退出备选屏幕
      expect(allOutput).toContain('\x1B[?7h');
      expect(allOutput).toContain('\x1B[?25h');
      expect(allOutput).toContain('\x1B[?1049l');

      renderer.stop();
      processOnSpy.mockRestore();
    });

    it('resize 后面板正确重绘（输出包含 CLEAR_SCREEN + CURSOR_HOME）', () => {
      // 初始终端 120 列
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(
        ['feat-1', 'feat-2'],
        ['/path/to/worktree/feat-1', '/path/to/worktree/feat-2'],
      );
      renderer.start();

      // 第一帧渲染完成后，清空记录
      writeSpy.mockClear();

      // 将终端缩窄到 60 列，触发 stop（内部再 render 一次）
      Object.defineProperty(process.stdout, 'columns', { value: 60, writable: true, configurable: true });
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 备选屏幕模式下使用 CLEAR_SCREEN + CURSOR_HOME 而非 CURSOR_UP
      expect(allOutput).toContain('\x1B[2J');
      expect(allOutput).toContain('\x1B[H');
      // 不应包含 CURSOR_UP 序列
      expect(allOutput).not.toMatch(/\x1B\[\d+A/);
    });

    it('start 时输出 LINE_WRAP_DISABLE，stop 时输出 LINE_WRAP_ENABLE', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // start 时禁用行换行
      expect(allOutput).toContain('\x1B[?7l');
      // stop 时恢复行换行
      expect(allOutput).toContain('\x1B[?7h');
    });

    it('render 输出中包含 SYNC_OUTPUT_START 和 SYNC_OUTPUT_END', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();
      renderer.stop();

      const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('');
      // 同步输出开启
      expect(allOutput).toContain('\x1B[?2026h');
      // 同步输出关闭
      expect(allOutput).toContain('\x1B[?2026l');
    });

    it('start 注册 exit 兜底处理器，stop 移除', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });
      const processOnSpy = vi.spyOn(process, 'on');
      const processRemoveListenerSpy = vi.spyOn(process, 'removeListener');

      const renderer = new ProgressRenderer(['feat-1'], ['/path/feat-1']);
      renderer.start();

      // 验证 exit 监听已注册
      const exitOnCalls = processOnSpy.mock.calls.filter((c) => c[0] === 'exit');
      expect(exitOnCalls.length).toBeGreaterThanOrEqual(1);

      renderer.stop();

      // 验证 exit 监听已移除
      const exitRemoveCalls = processRemoveListenerSpy.mock.calls.filter((c) => c[0] === 'exit');
      expect(exitRemoveCalls.length).toBeGreaterThanOrEqual(1);

      processOnSpy.mockRestore();
      processRemoveListenerSpy.mockRestore();
    });
  });
});