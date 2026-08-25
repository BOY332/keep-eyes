import { describe, expect, it, vi } from "vitest";
import { AlertController } from "./alert-controller";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { AppState } from "../shared/reminder-machine";

const state = (phase: AppState["phase"]): AppState => ({ version: 1, phase, dueAt: phase === "resting" ? null : 10_000, pauseEndsAt: null, restEndsAt: phase === "resting" ? 20_000 : null, remainingMs: 0, isEarlyReminderVisible: phase === "awaiting-action", settings: DEFAULT_SETTINGS });
const focus = () => ({ show: vi.fn(async () => undefined), hide: vi.fn() });
const actions = () => ({ turnOffDisplay: vi.fn(async () => undefined), lockWorkstation: vi.fn(async () => undefined) });

describe("�̶��������̱���", () => {
  it("��ǰ������ʾ͸�����Ѳ�", async () => { const window = focus(); const controller = new AlertController({ getState: () => state("awaiting-action") } as never, window, actions()); await controller.stateChanged(state("awaiting-action")); expect(window.show).toHaveBeenCalledOnce(); });
  it("������Ϣ�����������������������", async () => { const window = focus(); const native = actions(); const controller = new AlertController({ getState: () => state("resting") } as never, window, native); await controller.stateChanged(state("resting")); expect(window.hide).toHaveBeenCalledOnce(); expect(native.turnOffDisplay).toHaveBeenCalledOnce(); });
  it("����ʧ�ܲ��ı���Ϣ����", async () => { const window = focus(); const native = actions(); native.turnOffDisplay.mockRejectedValueOnce(new Error("failed")); const controller = new AlertController({ getState: () => state("resting") } as never, window, native); await expect(controller.stateChanged(state("resting"))).resolves.toBeUndefined(); });

  it("显示提前提醒时传递当前轮次的完整状态", async () => {
    const window = focus();
    const controller = new AlertController({ getState: () => state("awaiting-action") } as never, window, actions());
    const current = state("awaiting-action");
    await controller.stateChanged(current);
    expect(window.show).toHaveBeenCalledWith(current);
  });

  it("关闭提前提醒后不会因同阶段状态更新而重新显示", async () => {
    const window = focus();
    const scheduler = { getState: () => state("awaiting-action") };
    const controller = new AlertController(scheduler as never, window, actions());
    await controller.stateChanged(state("awaiting-action"));
    controller.hideEarlyReminder();
    await controller.stateChanged(state("awaiting-action"));
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it("跳过后的新用眼状态不会关闭显示器", async () => {
    const window = focus();
    const native = actions();
    const controller = new AlertController({ getState: () => state("eye-timer") } as never, window, native);
    await controller.stateChanged(state("awaiting-action"));
    await controller.stateChanged(state("eye-timer"));
    expect(window.hide).toHaveBeenCalledOnce();
    expect(native.turnOffDisplay).not.toHaveBeenCalled();
  });
});
