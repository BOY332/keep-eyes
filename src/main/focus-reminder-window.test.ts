import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const windowInstances: Array<Record<string, unknown>> = [];
const windowOptions: Array<Record<string, unknown>> = [];
let loadUrlResult: Promise<void> | undefined;
vi.mock("electron", () => ({
  screen: {
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
  },
  BrowserWindow: class {
    public loadURL = vi.fn(() => loadUrlResult ?? Promise.resolve());
    public showInactive = vi.fn();
    public focus = vi.fn();
    public hide = vi.fn();
    public isDestroyed = vi.fn(() => false);
    public isVisible = vi.fn(() => true);
    public on = vi.fn();
    public setBounds = vi.fn();
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

function method(name: string): ReturnType<typeof vi.fn> {
  return windowInstances[0][name] as ReturnType<typeof vi.fn>;
}

describe("FocusReminderWindowController", () => {
  beforeEach(() => {
    windowInstances.length = 0;
    windowOptions.length = 0;
    loadUrlResult = undefined;
  });

  it("复用顶部提醒窗口时同步每一轮的新截止时间", async () => {
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173");
    const first = awaitingState(30_000);
    const second = awaitingState(90_000);
    await controller.show(first);
    await controller.show(second);

    expect(windowInstances).toHaveLength(1);
    expect(windowOptions[0]).toMatchObject({
      width: 1920,
      height: 176,
      x: 0,
      y: 0,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      fullscreenable: false
    });
    expect(method("loadURL")).toHaveBeenCalledOnce();
    const send = (windowInstances[0].webContents as { send: ReturnType<typeof vi.fn> }).send;
    expect(send).toHaveBeenNthCalledWith(1, "reminder:state-changed", first);
    expect(send).toHaveBeenNthCalledWith(2, "reminder:state-changed", second);
    expect(method("focus")).not.toHaveBeenCalled();
    expect(method("showInactive")).toHaveBeenCalledTimes(2);
    expect(method("setIgnoreMouseEvents")).toHaveBeenCalledWith(true, { forward: true });
    controller.setMousePassthrough(false);
    expect(method("setIgnoreMouseEvents")).toHaveBeenLastCalledWith(false);
    expect(method("setBounds")).toHaveBeenCalledWith({ x: 0, y: 0, width: 1920, height: 176 });

    controller.hide();
    expect(method("hide")).toHaveBeenCalledOnce();
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

    expect(method("loadURL")).toHaveBeenCalledOnce();
    const send = (windowInstances[0].webContents as { send: ReturnType<typeof vi.fn> }).send;
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("reminder:state-changed", second);
    expect(method("showInactive")).toHaveBeenCalledOnce();
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
    expect(method("showInactive")).not.toHaveBeenCalled();
    expect(method("hide")).toHaveBeenCalledOnce();
  });
});
