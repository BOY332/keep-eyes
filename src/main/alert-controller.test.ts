import { describe, expect, it, vi } from "vitest";
import { AlertController } from "./alert-controller";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const state = (phase: AppState["phase"], restMode = DEFAULT_SETTINGS.restMode): AppState => ({ version: 1, phase, dueAt: phase === "resting" ? null : 10_000, pauseEndsAt: null, restEndsAt: phase === "resting" ? 20_000 : null, remainingMs: 0, isEarlyReminderVisible: phase === "awaiting-action", settings: { ...DEFAULT_SETTINGS, restMode } });
const focus = () => ({ show: vi.fn(async () => undefined), hide: vi.fn() });
const actions = () => ({ lockWorkstation: vi.fn(async () => undefined) });
const overlay = () => ({ show: vi.fn(async () => undefined), hide: vi.fn() });

describe("AlertController", () => {
  it("shows early reminders through the shared focus window controller", async () => { const panel = focus(); const controller = new AlertController({ getState: () => state("awaiting-action") } as never, panel, actions(), overlay()); await controller.stateChanged(state("awaiting-action")); expect(panel.show).toHaveBeenCalledOnce(); });
  it("shows a rest overlay on every display rather than turning displays off", async () => { const panel = focus(); const rest = overlay(); const native = actions(); const controller = new AlertController({ getState: () => state("resting") } as never, panel, native, rest); await controller.stateChanged(state("resting", "overlay")); expect(rest.show).toHaveBeenCalledOnce(); expect(native.lockWorkstation).not.toHaveBeenCalled(); });
  it("requests a Windows lock only once for a lock-mode rest", async () => { const native = actions(); const controller = new AlertController({ getState: () => state("resting", "lock") } as never, focus(), native, overlay()); await controller.stateChanged(state("resting", "lock")); await controller.stateChanged(state("resting", "lock")); expect(native.lockWorkstation).toHaveBeenCalledOnce(); });
  it("does not end a rest merely because Windows was unlocked", async () => { const current = state("resting", "lock"); const rest = overlay(); const controller = new AlertController({ getState: () => current } as never, focus(), actions(), rest); await controller.returnFromSystemAction(); expect(rest.show).not.toHaveBeenCalled(); });
});
