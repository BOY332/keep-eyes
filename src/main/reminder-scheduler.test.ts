import { describe, expect, it } from "vitest";
import { ReminderScheduler } from "./reminder-scheduler";
import type { ReminderStore, StoredReminderData } from "../shared/store";
class MemoryStore implements ReminderStore { value: StoredReminderData | null = null; async load() { return this.value; } async save(value: StoredReminderData) { this.value = value; } async clear() { this.value = null; } }
describe("ReminderScheduler", () => {
  it("������ǰ���ѡ��޲����Զ���Ϣ����һ��", async () => { let now = 0; const scheduler = await ReminderScheduler.restore(new MemoryStore(), () => now); now = 20 * 60_000 - 30_000; await scheduler.dispatch({ type: "TICK", now }); expect(scheduler.getState().phase).toBe("awaiting-action"); now = 20 * 60_000; await scheduler.dispatch({ type: "TICK", now }); expect(scheduler.getState().phase).toBe("resting"); await scheduler.dispatch({ type: "END_REST", now }); expect(scheduler.getState().phase).toBe("eye-timer"); });
  it("�������ָ����ã����µ������ִο�ʼ", async () => { const store = new MemoryStore(); let now = 0; const first = await ReminderScheduler.restore(store, () => now); await first.updateSettings({ eyeIntervalMinutes: 25 }); now = 10_000; const restarted = await ReminderScheduler.restore(store, () => now); expect(restarted.getState()).toMatchObject({ phase: "eye-timer", dueAt: 25 * 60_000 + 10_000, settings: { eyeIntervalMinutes: 25 } }); });

  it("跳过本次休息后旧截止时间不会触发休息", async () => {
    let now = 0;
    const scheduler = await ReminderScheduler.restore(new MemoryStore(), () => now);
    const originalDueAt = 20 * 60_000;
    now = originalDueAt - 15_000;
    await scheduler.dispatch({ type: "TICK", now });
    expect(scheduler.getState().phase).toBe("awaiting-action");
    await scheduler.dispatch({ type: "SKIP_REST", now });
    expect(scheduler.getState()).toMatchObject({ phase: "eye-timer", dueAt: now + 20 * 60_000 });
    now = originalDueAt;
    await scheduler.dispatch({ type: "TICK", now });
    expect(scheduler.getState().phase).toBe("eye-timer");
  });
});
