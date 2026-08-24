import { describe, expect, it, vi } from "vitest";

const windowInstances: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
const windowOptions: Array<Record<string, unknown>> = [];
vi.mock("electron", () => ({
  screen: {
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
  },
  BrowserWindow: class {
    public loadURL = vi.fn(async () => undefined);
    public showInactive = vi.fn();
    public focus = vi.fn();
    public hide = vi.fn();
    public isDestroyed = vi.fn(() => false);
    public isVisible = vi.fn(() => true);
    public on = vi.fn();
    public setBounds = vi.fn();
    public setAlwaysOnTop = vi.fn();
    constructor(options: Record<string, unknown>) {
      windowOptions.push(options);
      windowInstances.push(this as unknown as Record<string, ReturnType<typeof vi.fn>>);
    }
  }
}));
import { FocusReminderWindowController } from "./focus-reminder-window";

describe("FocusReminderWindowController", () => {
  it("????????????????", async () => {
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173");
    await controller.show();
    await controller.show();

    expect(windowInstances).toHaveLength(1);
    expect(windowOptions[0]).toMatchObject({
      width: 520,
      height: 230,
      y: 32,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      fullscreenable: false
    });
    expect(windowInstances[0].focus).not.toHaveBeenCalled();
    expect(windowInstances[0].showInactive).toHaveBeenCalledTimes(2);
    expect(windowInstances[0].setBounds).toHaveBeenCalledWith({ x: 700, y: 32, width: 520, height: 230 });

    controller.hide();
    expect(windowInstances[0].hide).toHaveBeenCalledOnce();
  });
});
