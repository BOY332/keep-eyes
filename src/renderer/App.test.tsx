import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const base = (phase: AppState["phase"] = "eye-timer"): AppState => ({ version: 1, settings: DEFAULT_SETTINGS, phase, dueAt: phase === "resting" ? null : Date.now() + 65_000, pauseEndsAt: null, restEndsAt: phase === "resting" ? Date.now() + 65_000 : null, remainingMs: 65_000, isEarlyReminderVisible: phase === "awaiting-action" });
function install(initial = base()) {
  const api = { getState: vi.fn(async () => initial), updateSettings: vi.fn(async (settings) => ({ ...initial, settings: { ...initial.settings, ...settings } })), dispatch: vi.fn(async () => initial), closeEarlyReminder: vi.fn(async () => undefined), skipRest: vi.fn(async () => initial), setReminderMousePassthrough: vi.fn(), onStateChanged: vi.fn(() => () => undefined) };
  Object.defineProperty(window, "keepEyes", { configurable: true, value: api }); return api;
}
beforeEach(() => { window.location.hash = ""; }); afterEach(() => cleanup());
describe("rest mode UI", () => {
  it("offers overlay and Windows lock choices and persists the selected mode", async () => {
    const api = install(); render(<App />); fireEvent.click(await screen.findByRole("button", { name: "设置" }));
    expect(screen.getByText("黑屏遮罩 + 休息倒计时")).toBeTruthy(); expect(screen.getByText("直接锁定 Windows")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/直接锁定 Windows/)); fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(api.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ restMode: "lock" }));
  });
  it("shows an early-end button only for overlay rests", async () => {
    install({ ...base("resting"), settings: { ...DEFAULT_SETTINGS, restMode: "overlay" } }); render(<App />); expect(await screen.findByRole("button", { name: "提前结束休息" })).toBeTruthy(); cleanup();
    install({ ...base("resting"), settings: { ...DEFAULT_SETTINGS, restMode: "lock" } }); render(<App />); await screen.findByText("正在休息"); expect(screen.queryByRole("button", { name: "提前结束休息" })).toBeNull();
  });
});
