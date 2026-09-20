import { describe, expect, it, vi } from "vitest";
import { AlertController } from "./alert-controller";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";
import type { ReminderSettings } from "../shared/settings";

const state = (phase: AppState["phase"], settings: ReminderSettings = DEFAULT_SETTINGS): AppState => ({
  version: 1,
  phase,
  dueAt: phase === "resting" ? null : 10_000,
  pauseEndsAt: null,
  restEndsAt: phase === "resting" ? 20_000 : null,
  remainingMs: 0,
  isEarlyReminderVisible: phase === "awaiting-action",
  settings
});
const focus = () => ({ show: vi.fn(async () => undefined), hide: vi.fn() });
const actions = () => ({ turnOffDisplay: vi.fn(async () => undefined), lockWorkstation: vi.fn(async () => undefined) });
const overlay = () => ({ show: vi.fn(async () => undefined), hide: vi.fn() });

describe("休息流程编排", () => {
  it("提前提醒显示透明置顶条", async () => {
    const window = focus();
    const cover = overlay();
    const controller = new AlertController({ getState: () => state("awaiting-action") } as never, window, actions(), cover);
    await controller.stateChanged(state("awaiting-action"));
    expect(window.show).toHaveBeenCalledOnce();
    expect(cover.hide).toHaveBeenCalledOnce();
  });

  it("休息时在所有屏幕显示黑屏遮罩，而不是关闭显示器", async () => {
    const window = focus();
    const native = actions();
    const cover = overlay();
    const current = state("resting");
    const controller = new AlertController({ getState: () => current } as never, window, native, cover);
    await controller.stateChanged(current);
    expect(window.hide).toHaveBeenCalledOnce();
    expect(cover.show).toHaveBeenCalledWith(current);
    expect(native.turnOffDisplay).not.toHaveBeenCalled();
    expect(native.lockWorkstation).not.toHaveBeenCalled();
  });

  it("锁定模式失败不改变休息状态", async () => {
    const window = focus();
    const native = actions();
    native.lockWorkstation.mockRejectedValueOnce(new Error("failed"));
    const cover = overlay();
    const current = state("resting", { ...DEFAULT_SETTINGS, restMode: "lock" });
    const controller = new AlertController({ getState: () => current } as never, window, native, cover);
    await expect(controller.stateChanged(current)).resolves.toBeUndefined();
    expect(native.lockWorkstation).toHaveBeenCalledOnce();
    expect(cover.show).not.toHaveBeenCalled();
  });

  it("显示提前提醒时传递当前轮次的完整状态", async () => {
    const window = focus();
    const controller = new AlertController({ getState: () => state("awaiting-action") } as never, window, actions(), overlay());
    const current = state("awaiting-action");
    await controller.stateChanged(current);
    expect(window.show).toHaveBeenCalledWith(current);
  });

  it("关闭提前提醒后不会因同阶段状态更新而重新显示", async () => {
    const window = focus();
    const scheduler = { getState: () => state("awaiting-action") };
    const controller = new AlertController(scheduler as never, window, actions(), overlay());
    await controller.stateChanged(state("awaiting-action"));
    controller.hideEarlyReminder();
    await controller.stateChanged(state("awaiting-action"));
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it("跳过后的新用眼状态不会显示遮罩或锁定", async () => {
    const window = focus();
    const native = actions();
    const cover = overlay();
    const controller = new AlertController({ getState: () => state("eye-timer") } as never, window, native, cover);
    await controller.stateChanged(state("awaiting-action"));
    await controller.stateChanged(state("eye-timer"));
    expect(window.hide).toHaveBeenCalledOnce();
    expect(cover.show).not.toHaveBeenCalled();
    expect(native.turnOffDisplay).not.toHaveBeenCalled();
    expect(native.lockWorkstation).not.toHaveBeenCalled();
  });

  it("屏幕变化后会重新贴上当前休息遮罩", async () => {
    const window = focus();
    const cover = overlay();
    const current = state("resting");
    const controller = new AlertController({ getState: () => current } as never, window, actions(), cover);
    await controller.returnFromSystemAction();
    expect(cover.show).toHaveBeenCalledWith(current);
  });
});
