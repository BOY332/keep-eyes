import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";
import { sendStateToMainWindow } from "./main-window-state";

const state: AppState = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  phase: "awaiting-action",
  dueAt: 30_000,
  pauseEndsAt: null,
  restEndsAt: null,
  remainingMs: 30_000,
  isEarlyReminderVisible: true
};

function target(options: { windowDestroyed?: boolean; contentsDestroyed?: boolean; sendError?: boolean } = {}) {
  const send = options.sendError ? vi.fn(() => { throw new Error("Object has been destroyed"); }) : vi.fn();
  return {
    send,
    window: {
      isDestroyed: () => Boolean(options.windowDestroyed),
      webContents: { isDestroyed: () => Boolean(options.contentsDestroyed), send }
    }
  };
}

describe("sendStateToMainWindow", () => {
  it("主窗口可用时发送状态", () => {
    const value = target();
    expect(sendStateToMainWindow(value.window, state)).toBe(true);
    expect(value.send).toHaveBeenCalledWith("reminder:state-changed", state);
  });

  it("主窗口已经销毁时跳过发送", () => {
    const value = target({ windowDestroyed: true });
    expect(sendStateToMainWindow(value.window, state)).toBe(false);
    expect(value.send).not.toHaveBeenCalled();
  });

  it("发送过程中窗口被销毁也不会向外抛错", () => {
    const value = target({ sendError: true });
    expect(() => sendStateToMainWindow(value.window, state)).not.toThrow();
    expect(sendStateToMainWindow(value.window, state)).toBe(false);
  });
});
