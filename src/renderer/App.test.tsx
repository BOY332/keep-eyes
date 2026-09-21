import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import type { AppState } from "../shared/reminder-machine";
import { DEFAULT_SETTINGS } from "../shared/settings";

function baseState(phase: AppState["phase"] = "eye-timer", now = Date.now()): AppState {
  return {
    version: 1,
    phase,
    dueAt: phase === "resting" ? null : now + 65_000,
    pauseEndsAt: null,
    restEndsAt: phase === "resting" ? now + 65_000 : null,
    remainingMs: 65_000,
    isEarlyReminderVisible: phase === "awaiting-action",
    settings: DEFAULT_SETTINGS
  };
}

function installApi(initial = baseState()) {
  const closeEarlyReminder = vi.fn(async () => undefined);
  const skipRest = vi.fn(async () => ({ ...initial, phase: "eye-timer" as const, dueAt: Date.now() + 20 * 60_000 }));
  const getState = vi.fn(async () => initial);
  const updateSettings = vi.fn(async (settings: Partial<typeof DEFAULT_SETTINGS>) => ({ ...initial, settings: { ...initial.settings, ...settings } }));
  const dispatch = vi.fn(async (..._args: unknown[]) => initial);
  const setReminderMousePassthrough = vi.fn();
  const onStateChanged = vi.fn(() => () => undefined);
  Object.defineProperty(window, "keepEyes", { configurable: true, value: { getState, updateSettings, dispatch, closeEarlyReminder, skipRest, setReminderMousePassthrough, onStateChanged } });
  return { updateSettings, dispatch, closeEarlyReminder, skipRest, setReminderMousePassthrough };
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("主界面与设置", () => {
  it("显示状态和所有屏幕遮罩流程", async () => {
    installApi();
    render(<App />);
    expect(await screen.findByText("正在用眼计时")).toBeTruthy();
    expect(screen.getByText(/提前提醒/)).toBeTruthy();
    expect(screen.getByText(/所有屏幕黑屏遮罩/)).toBeTruthy();
  });

  it("设置含五项时间和休息方式", async () => {
    installApi();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "设置" }));
    expect(screen.getByText("提前提醒（秒）")).toBeTruthy();
    expect(screen.getByText("眼睛放松提醒（分钟）")).toBeTruthy();
    expect(screen.queryByText("温和通知")).toBeNull();
    expect(screen.getByText("黑屏遮罩 + 休息倒计时")).toBeTruthy();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(5);
  });

  it("知道了仅关闭提醒且不派发计时事件", async () => {
    const { dispatch, closeEarlyReminder } = installApi(baseState("awaiting-action"));
    render(<App />);
    await screen.findByText("提前提醒中");
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(closeEarlyReminder).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("用眼计时时可以立刻休息", async () => {
    const { dispatch } = installApi(baseState("eye-timer"));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "立刻休息" }));
    expect(dispatch.mock.calls.map((call) => (call[0] as { type: string }).type)).toEqual(["BEGIN_REST"]);
  });

  it("提前提醒时支持开始休息、延后、暂停和跳过", async () => {
    const { dispatch, skipRest } = installApi(baseState("awaiting-action"));
    render(<App />);
    await screen.findByText("提前提醒中");
    fireEvent.click(screen.getByRole("button", { name: "开始休息" }));
    fireEvent.click(screen.getByRole("button", { name: "延后提醒" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停 30 分钟" }));
    fireEvent.click(screen.getByRole("button", { name: "跳过本次休息" }));
    expect(dispatch.mock.calls.map((call) => (call[0] as { type: string }).type)).toEqual(["BEGIN_REST", "SNOOZE", "PAUSE"]);
    expect(skipRest).toHaveBeenCalledOnce();
  });

  it("休息遮罩显示倒计时和提前结束", async () => {
    window.location.hash = "#rest-overlay";
    installApi(baseState("resting"));
    render(<App />);
    expect(await screen.findByText("休息中")).toBeTruthy();
    expect(screen.getByRole("button", { name: "提前结束休息" })).toBeTruthy();
  });
});
describe("提醒面板倒计时", () => {
  it("透明空白区域点击穿透且提醒按钮保持可操作", async () => {
    window.location.hash = "#focus-controls";
    const { setReminderMousePassthrough } = installApi(baseState("awaiting-action"));
    const { container } = render(<App />);
    await act(async () => { await Promise.resolve(); });

    expect(setReminderMousePassthrough).toHaveBeenCalledWith(true);
    fireEvent.mouseMove(screen.getByRole("button", { name: "开始休息" }));
    expect(setReminderMousePassthrough).toHaveBeenLastCalledWith(false);
    fireEvent.mouseMove(container.querySelector(".focus-copy") as Element);
    expect(setReminderMousePassthrough).toHaveBeenLastCalledWith(true);
  });

  it("根据绝对截止时间逐秒更新而不是固定显示 0 秒", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T00:00:00Z"));
    window.location.hash = "#focus-controls";
    installApi(baseState("awaiting-action", Date.now()));
    render(<App />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/1 分 05 秒/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText(/1 分 04 秒/)).toBeTruthy();
  });

  it("窗口重新获得焦点时立即按当前时间校准", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T00:00:00Z"));
    window.location.hash = "#focus-controls";
    installApi(baseState("awaiting-action", Date.now()));
    render(<App />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/1 分 05 秒/)).toBeTruthy();
    vi.setSystemTime(new Date("2026-08-25T00:00:10Z"));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(screen.getByText(/0 分 55 秒/)).toBeTruthy();
  });

  it("休息遮罩显示倒计时和提前结束", async () => {
    window.location.hash = "#rest-overlay";
    installApi(baseState("resting"));
    render(<App />);
    expect(await screen.findByText("休息中")).toBeTruthy();
    expect(screen.getByRole("button", { name: "提前结束休息" })).toBeTruthy();
  });
});
