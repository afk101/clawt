import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock 所有依赖，避免真实 git 命令执行
vi.mock('../../../src/constants/index.js', () => ({
  CURSOR_HIDE: '',
  CURSOR_SHOW: '',
  LINE_WRAP_DISABLE: '',
  LINE_WRAP_ENABLE: '',
  SYNC_OUTPUT_START: '',
  SYNC_OUTPUT_END: '',
  ALT_SCREEN_ENTER: '',
  ALT_SCREEN_LEAVE: '',
  CLEAR_SCREEN: '',
  CURSOR_HOME: '',
  DEFAULT_TERMINAL_COLUMNS: 80,
  PANEL_REFRESH_INTERVAL_MS: 5000,
  PANEL_COUNTDOWN_INTERVAL_MS: 1000,
  KEY_ARROW_UP: '\x1b[A',
  KEY_ARROW_DOWN: '\x1b[B',
  KEY_CTRL_C: 3,
  PANEL_SHORTCUT_KEYS: {
    VALIDATE: 'v',
    MERGE: 'm',
    DELETE: 'd',
    RESUME: 'r',
    SYNC: 's',
    COVER: 'c',
    REFRESH: 'f',
    QUIT: 'q',
  },
}));

vi.mock('../../../src/constants/messages/index.js', () => ({
  PANEL_NOT_TTY: 'not tty',
  PANEL_PRESS_ENTER_TO_RETURN: 'press enter',
}));

vi.mock('../../../src/utils/shell.js', () => ({
  runCommandInherited: vi.fn(),
}));

vi.mock('../../../src/utils/interactive-panel-render.js', () => ({
  buildPanelFrame: vi.fn(() => ['line1', 'line2']),
  renderFooter: vi.fn(() => 'footer'),
}));

vi.mock('../../../src/utils/progress-render.js', () => ({
  truncateToTerminalWidth: vi.fn((s: string) => s),
}));

vi.mock('../../../src/utils/keyboard-controller.js', () => ({
  KeyboardController: vi.fn(function () {
    return {
      start: vi.fn(),
      stop: vi.fn(),
    };
  }),
}));

vi.mock('../../../src/utils/interactive-panel-state.js', () => ({
  PanelStateManager: vi.fn(function () {
    return {
      updateData: vi.fn(),
      getStatusResult: vi.fn(() => ({ main: {}, worktrees: [], snapshots: {}, totalWorktrees: 0 })),
      getSelectedOriginalIndex: vi.fn(() => 0),
      getSelectedBranch: vi.fn(() => 'feat-test'),
      getScrollOffset: vi.fn(() => 0),
      getCachedPanelLines: vi.fn(() => []),
      adjustScrollForSelection: vi.fn(),
      navigateUp: vi.fn(() => false),
      navigateDown: vi.fn(() => false),
    };
  }),
}));

vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { InteractivePanel } from '../../../src/utils/interactive-panel.js';
import type { StatusResult } from '../../../src/types/index.js';

/**
 * 构造最小可用的 StatusResult mock
 */
function makeStatusResult(): StatusResult {
  return {
    main: {
      branch: 'main',
      isClean: true,
      projectName: 'test-project',
      configuredMainBranch: 'main',
      configuredBranchExists: true,
      insertions: 0,
      deletions: 0,
    },
    worktrees: [],
    snapshots: { total: 0, orphaned: 0 },
    totalWorktrees: 0,
  };
}

describe('InteractivePanel.executeOperation()', () => {
  let panel: InteractivePanel;
  let collectStatusMock: ReturnType<typeof vi.fn>;
  let renderSpy: ReturnType<typeof vi.spyOn>;
  let refreshDataSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 模拟 TTY 环境
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });
    Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    collectStatusMock = vi.fn().mockResolvedValue(makeStatusResult());
    panel = new InteractivePanel(collectStatusMock);

    // 监视 render 和 refreshData，记录调用顺序
    renderSpy = vi.spyOn(panel as any, 'render');
    refreshDataSpy = vi.spyOn(panel as any, 'refreshData').mockResolvedValue(undefined);
  });

  it('应在 refreshData 之前调用一次 render（立即渲染旧数据消除白屏）', async () => {
    const callOrder: string[] = [];
    renderSpy.mockImplementation(() => { callOrder.push('render'); });
    refreshDataSpy.mockImplementation(async () => { callOrder.push('refreshData'); });

    // 直接调用私有方法 executeOperation
    const action = vi.fn();
    // 绕过 waitForEnter，直接 resolve
    vi.spyOn(panel as any, 'waitForEnter').mockResolvedValue(undefined);
    vi.spyOn(panel as any, 'initTerminal').mockImplementation(() => {});
    vi.spyOn(panel as any, 'restoreTerminal').mockImplementation(() => {});
    vi.spyOn(panel as any, 'removeTerminalListeners').mockImplementation(() => {});
    vi.spyOn(panel as any, 'startAutoRefresh').mockImplementation(() => {});
    vi.spyOn(panel as any, 'clearTimers').mockImplementation(() => {});

    // stateManager.getStatusResult() 需要返回非 null 才能让 render 不被 guard 拦截
    // executeOperation 顶部也检查 statusResult 非 null
    await (panel as any).executeOperation(action);

    // render 必须在 refreshData 之前被调用至少一次
    const firstRenderIdx = callOrder.indexOf('render');
    const refreshDataIdx = callOrder.indexOf('refreshData');
    expect(firstRenderIdx).toBeGreaterThanOrEqual(0);
    expect(refreshDataIdx).toBeGreaterThanOrEqual(0);
    expect(firstRenderIdx).toBeLessThan(refreshDataIdx);
  });

  it('应在 refreshData 之后再调用一次 render（刷新为最新数据）', async () => {
    const callOrder: string[] = [];
    renderSpy.mockImplementation(() => { callOrder.push('render'); });
    refreshDataSpy.mockImplementation(async () => { callOrder.push('refreshData'); });

    vi.spyOn(panel as any, 'waitForEnter').mockResolvedValue(undefined);
    vi.spyOn(panel as any, 'initTerminal').mockImplementation(() => {});
    vi.spyOn(panel as any, 'restoreTerminal').mockImplementation(() => {});
    vi.spyOn(panel as any, 'removeTerminalListeners').mockImplementation(() => {});
    vi.spyOn(panel as any, 'startAutoRefresh').mockImplementation(() => {});
    vi.spyOn(panel as any, 'clearTimers').mockImplementation(() => {});

    await (panel as any).executeOperation(vi.fn());

    // refreshData 之后必须还有一次 render
    const refreshDataIdx = callOrder.lastIndexOf('refreshData');
    const lastRenderIdx = callOrder.lastIndexOf('render');
    expect(lastRenderIdx).toBeGreaterThan(refreshDataIdx);
  });

  it('isOperating 应在 render 之前被设为 false', async () => {
    const isOperatingAtRender: boolean[] = [];

    renderSpy.mockImplementation(() => {
      isOperatingAtRender.push((panel as any).isOperating);
    });
    refreshDataSpy.mockResolvedValue(undefined);

    vi.spyOn(panel as any, 'waitForEnter').mockResolvedValue(undefined);
    vi.spyOn(panel as any, 'initTerminal').mockImplementation(() => {});
    vi.spyOn(panel as any, 'restoreTerminal').mockImplementation(() => {});
    vi.spyOn(panel as any, 'removeTerminalListeners').mockImplementation(() => {});
    vi.spyOn(panel as any, 'startAutoRefresh').mockImplementation(() => {});
    vi.spyOn(panel as any, 'clearTimers').mockImplementation(() => {});

    await (panel as any).executeOperation(vi.fn());

    // 第一次 render 调用时 isOperating 必须为 false
    expect(isOperatingAtRender[0]).toBe(false);
  });
});
