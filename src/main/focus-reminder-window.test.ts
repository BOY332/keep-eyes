import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const windowInstances: Array<Record<string, unknown>> = [];
const windowOptions: Array<Record<string, unknown>> = [];
let loadUrlResult: Promise<void> | undefined;
const displays = [
  { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1032 } },
  { id: 2, bounds: { x: 1920, y: -238, width: 1707, height: 1067 }, workArea: { x: 1920, y: -238, width: 1707, height: 1019 } }
];

vi.mock("electron", () => ({
  screen: {
    getAllDisplays: () => displays,
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    getDisplayNearestPoint: () => displays[0]
  },
  BrowserWindow: class {
    public loadURL = vi.fn(() => loadUrlResult ?? Promise.resolve());
    public showInactive = vi.fn();
    public focus = vi.fn();
    public hide = vi.fn();
    public close = vi.fn();
    public isDestroyed = vi.fn(() => false);
    public isVisible = vi.fn(() => true);
    public on = vi.fn();
    public setBounds = vi.fn();
    public setPosition = vi.fn();
    public setAlwaysOnTop = vi.fn();
    public setIgnoreMouseEvents = vi.fn();
    public webContents = { send: vi.fn() };
    constructor(options: Record<string, unknown>) {
      windowOptions.push(options);
      windowInstances.push(this as unknown as Record<string, unknown>);
    }
  }
}));
import { FocusReminderWindowController } from "./focus-reminder-window";

function awaitingState(dueAt: number): AppState {
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    phase: "awaiting-action",
    dueAt,
    pauseEndsAt: null,
    restEndsAt: null,
    remainingMs: 30_000,
    isEarlyReminderVisible: true
  };
}

describe("FocusReminderWindowController", () => {
  beforeEach(() => {
    windowInstances.length = 0;
    windowOptions.length = 0;
    loadUrlResult = undefined;
    vi.useRealTimers();
  });

  it("在每一块屏幕顶部都放一条提醒，而不是只跟着鼠标", async () => {
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173");
    const first = awaitingState(30_000);
    await controller.show(first);

    expect(windowInstances).toHaveLength(2);
    expect(windowOptions[0]).toMatchObject({ x: 0, y: 0, width: 1920, height: 176, show: false, transparent: true });
    expect(windowOptions[1]).toMatchObject({ x: 1920, y: -238, width: 1707, height: 176, show: false, transparent: true });
    expect(windowInstances[0].setPosition).toHaveBeenCalledWith(0, 0);
    expect(windowInstances[1].setPosition).toHaveBeenCalledWith(1920, -238);
    expect(windowInstances[1].setBounds).toHaveBeenCalledWith({ x: 1920, y: -238, width: 1707, height: 176 });
    const send = (windowInstances[1].webContents as { send: ReturnType<typeof vi.fn> }).send;
    expect(send).toHaveBeenCalledWith("reminder:state-changed", first);
    expect(windowInstances[0].showInactive).toHaveBeenCalled();
    expect(windowInstances[1].showInactive).toHaveBeenCalled();
    controller.hide();
    expect(windowInstances[0].hide).toHaveBeenCalledOnce();
    expect(windowInstances[1].hide).toHaveBeenCalledOnce();
  });

  it("复用窗口时同步每一轮的新截止时间", async () => {
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173");
    const first = awaitingState(30_000);
    const second = awaitingState(90_000);
    await controller.show(first);
    await controller.show(second);
    expect(windowInstances).toHaveLength(2);
    const send = (windowInstances[0].webContents as { send: ReturnType<typeof vi.fn> }).send;
    expect(send).toHaveBeenNthCalledWith(1, "reminder:state-changed", first);
    expect(send).toHaveBeenNthCalledWith(2, "reminder:state-changed", second);
  });

  it("首次加载期间只展示最后一次请求的新轮次状态", async () => {
    let finishLoading!: () => void;
    loadUrlResult = new Promise<void>((resolve) => { finishLoading = resolve; });
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173");
    const first = awaitingState(30_000);
    const second = awaitingState(90_000);
    const firstShow = controller.show(first);
    const secondShow = controller.show(second);
    finishLoading();
    await Promise.all([firstShow, secondShow]);
    const send = (windowInstances[0].webContents as { send: ReturnType<typeof vi.fn> }).send;
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("reminder:state-changed", second);
  });

  it("首次加载期间被隐藏后不会重新弹出旧轮次", async () => {
    let finishLoading!: () => void;
    loadUrlResult = new Promise<void>((resolve) => { finishLoading = resolve; });
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173");
    const show = controller.show(awaitingState(30_000));
    controller.hide();
    finishLoading();
    await show;
    const send = (windowInstances[0].webContents as { send: ReturnType<typeof vi.fn> }).send;
    expect(send).not.toHaveBeenCalled();
    expect(windowInstances[0].showInactive).not.toHaveBeenCalled();
  });
});
