import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const instances: Array<Record<string, any>> = [];
const options: Array<Record<string, unknown>> = [];
const handlers = new Map<string, (...args: any[]) => void>();
const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, workArea: { x: 1920, y: 0, width: 1280, height: 1024 } }
];
vi.mock("electron", () => ({
  screen: { getAllDisplays: () => displays },
  BrowserWindow: class {
    loadURL = vi.fn(() => Promise.resolve()); showInactive = vi.fn(); hide = vi.fn(); close = vi.fn(); isDestroyed = vi.fn(() => false); isVisible = vi.fn(() => true); setBounds = vi.fn(); setAlwaysOnTop = vi.fn(); setIgnoreMouseEvents = vi.fn(); webContents = { send: vi.fn() };
    on = vi.fn((name: string, callback: (...args: any[]) => void) => handlers.set(name, callback));
    constructor(config: Record<string, unknown>) { options.push(config); instances.push(this as unknown as Record<string, any>); }
  }
}));
import { FocusReminderWindowController } from "./focus-reminder-window";

const state = (dueAt = 30_000): AppState => ({ version: 1, settings: DEFAULT_SETTINGS, phase: "awaiting-action", dueAt, pauseEndsAt: null, restEndsAt: null, remainingMs: 30_000, isEarlyReminderVisible: true });
describe("FocusReminderWindowController", () => {
  beforeEach(() => { instances.length = 0; options.length = 0; handlers.clear(); });
  it("creates and synchronizes one compact reminder panel per connected display", async () => {
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173"); const current = state(); await controller.show(current);
    expect(instances).toHaveLength(2); expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ x: 0, width: 1920, height: 176 }), expect.objectContaining({ x: 1920, width: 1280, height: 176 })]));
    for (const win of instances) { expect(win.webContents.send).toHaveBeenCalledWith("reminder:state-changed", current); expect(win.showInactive).toHaveBeenCalledOnce(); }
  });
  it("applies mouse passthrough and hide actions to all panels", async () => {
    const controller = new FocusReminderWindowController("http://127.0.0.1:5173"); await controller.show(state()); controller.setMousePassthrough(false); controller.hide();
    for (const win of instances) { expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false, undefined); expect(win.hide).toHaveBeenCalledOnce(); }
  });
});
