import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, cleanup, render, screen } from "@testing-library/react";
import App from "./App";
import type { AppState } from "../shared/reminder-machine";
import { DEFAULT_SETTINGS } from "../shared/settings";
function baseState(phase: AppState["phase"] = "eye-timer"): AppState { return { version: 1, phase, dueAt: phase === "resting" ? null : Date.now() + 65_000, pauseEndsAt: null, restEndsAt: phase === "resting" ? Date.now() + 65_000 : null, remainingMs: 65_000, isEarlyReminderVisible: phase === "awaiting-action", settings: DEFAULT_SETTINGS }; }
function installApi(initial = baseState()) { const closeEarlyReminder = vi.fn(async () => undefined); const getState = vi.fn(async () => initial); const updateSettings = vi.fn(async (settings: Partial<typeof DEFAULT_SETTINGS>) => ({ ...initial, settings: { ...initial.settings, ...settings } })); const dispatch = vi.fn(async (..._args: unknown[]) => initial); const onStateChanged = vi.fn(() => () => undefined); Object.defineProperty(window, "keepEyes", { configurable: true, value: { getState, updateSettings, dispatch, closeEarlyReminder, onStateChanged } }); return { updateSettings, dispatch, closeEarlyReminder }; }
afterEach(() => cleanup());
describe("主界面与设置", () => {
 it("显示状态和固定流程", async () => { installApi(); render(<App />); expect(await screen.findByText("正在用眼计时")).toBeTruthy(); expect(screen.getByText(/提前提醒/)).toBeTruthy(); });
 it("设置仅含四项", async () => { installApi(); render(<App />); fireEvent.click(await screen.findByRole("button", { name: "设置" })); expect(screen.getByText("提前提醒（秒）")).toBeTruthy(); expect(screen.queryByText("温和通知")).toBeNull(); expect(screen.getAllByRole("spinbutton")).toHaveLength(4); });
 it("提前提醒可关闭且不派发计时事件", async () => { const { dispatch, closeEarlyReminder } = installApi(baseState("awaiting-action")); render(<App />); await screen.findByText("提前提醒中"); fireEvent.click(screen.getByRole("button", { name: "关闭" })); expect(closeEarlyReminder).toHaveBeenCalledOnce(); expect(dispatch).not.toHaveBeenCalled(); });
 it("提前提醒时支持开始休息、延后和暂停", async () => { const { dispatch } = installApi(baseState("awaiting-action")); render(<App />); await screen.findByText("提前提醒中"); fireEvent.click(screen.getByRole("button", { name: "开始休息" })); fireEvent.click(screen.getByRole("button", { name: "延后提醒" })); fireEvent.click(screen.getByRole("button", { name: "暂停 30 分钟" })); expect(dispatch.mock.calls.map((call) => (call[0] as unknown as { type: string }).type)).toEqual(["BEGIN_REST", "SNOOZE", "PAUSE"]); });
});
