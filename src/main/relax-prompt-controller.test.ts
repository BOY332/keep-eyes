import { describe, expect, it, vi } from "vitest";
import { RelaxPromptController } from "./relax-prompt-controller";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

function state(phase: AppState["phase"], relaxPromptMinutes: number, extra: Partial<AppState> = {}): AppState {
  return {
    version: 1,
    phase,
    dueAt: phase === "resting" ? null : 10_000,
    pauseEndsAt: phase === "paused" ? 20_000 : null,
    restEndsAt: phase === "resting" ? 20_000 : null,
    remainingMs: 10_000,
    isEarlyReminderVisible: phase === "awaiting-action",
    settings: { ...DEFAULT_SETTINGS, relaxPromptMinutes },
    ...extra
  };
}

describe("眼睛放松提醒", () => {
  it("到期后只弹出提示，不改变休息状态", async () => {
    const current = state("eye-timer", 20);
    const notifier = { showRelaxPrompt: vi.fn(async () => undefined) };
    const controller = new RelaxPromptController(() => current, notifier, () => 0);
    controller.start();
    await controller.tick(20 * 60_000);
    expect(notifier.showRelaxPrompt).toHaveBeenCalledOnce();
    expect(current.phase).toBe("eye-timer");
    controller.stop();
  });

  it("关闭后不提示", async () => {
    const notifier = { showRelaxPrompt: vi.fn(async () => undefined) };
    const controller = new RelaxPromptController(() => state("eye-timer", 0), notifier, () => 0);
    controller.start();
    await controller.tick(20 * 60_000);
    expect(notifier.showRelaxPrompt).not.toHaveBeenCalled();
    controller.stop();
  });

  it("休息、暂停和提前提醒期间不提示", async () => {
    for (const phase of ["awaiting-action", "paused", "resting"] as const) {
      const notifier = { showRelaxPrompt: vi.fn(async () => undefined) };
      const controller = new RelaxPromptController(() => state(phase, 5), notifier, () => 0);
      controller.start();
      await controller.tick(10 * 60_000);
      expect(notifier.showRelaxPrompt).not.toHaveBeenCalled();
      controller.stop();
    }
  });

  it("提示后重新按间隔计时", async () => {
    const current = state("eye-timer", 10);
    const notifier = { showRelaxPrompt: vi.fn(async () => undefined) };
    const controller = new RelaxPromptController(() => current, notifier, () => 0);
    controller.start();
    await controller.tick(10 * 60_000);
    await controller.tick(10 * 60_000 + 1_000);
    expect(notifier.showRelaxPrompt).toHaveBeenCalledOnce();
    await controller.tick(20 * 60_000);
    expect(notifier.showRelaxPrompt).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  it("离开休息后重新开始放松提醒计时", async () => {
    let current = state("resting", 5);
    const notifier = { showRelaxPrompt: vi.fn(async () => undefined) };
    const controller = new RelaxPromptController(() => current, notifier, () => 0);
    controller.start();
    current = state("eye-timer", 5);
    controller.stateChanged(current, 8 * 60_000);
    await controller.tick(12 * 60_000);
    expect(notifier.showRelaxPrompt).not.toHaveBeenCalled();
    await controller.tick(13 * 60_000);
    expect(notifier.showRelaxPrompt).toHaveBeenCalledOnce();
    controller.stop();
  });
});
