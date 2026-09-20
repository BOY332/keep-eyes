import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const windowInstances: Array<Record<string, unknown>> = [];
const windowOptions: Array<Record<string, unknown>> = [];
const displays = [
  { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1032 } },
  { id: 2, bounds: { x: 1920, y: -238, width: 1707, height: 1067 }, workArea: { x: 1920, y: -238, width: 1707, height: 1019 } }
];

vi.mock("electron", () => ({
  screen: {
    getAllDisplays: () => displays
  },
  BrowserWindow: class {
    public loadURL = vi.fn(async () => undefined);
    public showInactive = vi.fn();
    public hide = vi.fn();
    public close = vi.fn();
    public isDestroyed = vi.fn(() => false);
    public on = vi.fn();
    public setBounds = vi.fn();
    public setPosition = vi.fn();
    public setAlwaysOnTop = vi.fn();
    public webContents = { send: vi.fn() };
    constructor(options: Record<string, unknown>) {
      windowOptions.push(options);
      windowInstances.push(this as unknown as Record<string, unknown>);
    }
  }
}));
import { RestOverlayWindowController } from "./rest-overlay-window";

function restingState(): AppState {
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    phase: "resting",
    dueAt: null,
    pauseEndsAt: null,
    restEndsAt: 90_000,
    remainingMs: 20_000,
    isEarlyReminderVisible: false
  };
}

describe("RestOverlayWindowController", () => {
  beforeEach(() => {
    windowInstances.length = 0;
    windowOptions.length = 0;
  });

  it("按每块屏幕的完整区域盖住，包括缩放不同和负坐标的屏幕", async () => {
    const controller = new RestOverlayWindowController("http://127.0.0.1:5173");
    const state = restingState();
    await controller.show(state);

    expect(windowInstances).toHaveLength(2);
    expect(windowOptions[0]).toMatchObject({
      x: 0, y: 0, width: 1920, height: 1080, show: false, backgroundColor: "#000000", enableLargerThanScreen: true
    });
    expect(windowOptions[1]).toMatchObject({
      x: 1920, y: -238, width: 1707, height: 1067, show: false, backgroundColor: "#000000"
    });
    expect(windowInstances[0].setPosition).toHaveBeenCalledWith(0, 0);
    expect(windowInstances[1].setPosition).toHaveBeenCalledWith(1920, -238);
    expect(windowInstances[1].setBounds).toHaveBeenCalledWith(displays[1].bounds);
    expect((windowInstances[0].webContents as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith("reminder:state-changed", state);
    expect(windowInstances[0].showInactive).toHaveBeenCalled();
    expect(windowInstances[1].showInactive).toHaveBeenCalled();
    expect(windowInstances[0].loadURL).toHaveBeenCalledWith("http://127.0.0.1:5173#rest-overlay");
  });
});
