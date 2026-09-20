import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, validateSettings } from "../settings";
import { createInitialSnapshot, reconcileSnapshot, toAppState, transition } from "../reminder-machine";

describe("设置校验", () => {
  it("使用默认设置并校验提前提醒范围", () => {
    expect(validateSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ earlyReminderSeconds: 0 }).earlyReminderSeconds).toBe(0);
    expect(() => validateSettings({ eyeIntervalMinutes: 0 })).toThrow("eyeIntervalMinutes");
    expect(() => validateSettings({ earlyReminderSeconds: 301 })).toThrow("earlyReminderSeconds");
    expect(validateSettings({}).restMode).toBe("overlay");
    expect(validateSettings({ restMode: "lock" }).restMode).toBe("lock");
    expect(() => validateSettings({ restMode: "off" })).toThrow("restMode");
  });
});

describe("提醒状态机", () => {
  it("提前提醒出现后无操作会在截止时间自动开始休息", () => {
    const started = createInitialSnapshot(DEFAULT_SETTINGS, 0);
    expect(reconcileSnapshot(started, 20 * 60_000 - 30_000).phase).toBe("awaiting-action");
    const resting = reconcileSnapshot(reconcileSnapshot(started, 20 * 60_000 - 30_000), 20 * 60_000);
    expect(resting.phase).toBe("resting");
    expect(resting.restEndsAt).toBe(20 * 60_000 + 20_000);
  });

  it("提前提醒继续使用原绝对截止时间派生剩余时间", () => {
    const dueAt = 20 * 60_000;
    const awaiting = reconcileSnapshot(createInitialSnapshot(DEFAULT_SETTINGS, 0), dueAt - 30_000);
    expect(toAppState(awaiting, dueAt - 30_000)).toMatchObject({ dueAt, remainingMs: 30_000 });
    expect(toAppState(awaiting, dueAt - 29_000).remainingMs).toBe(29_000);
  });

  it("开始并结束休息后创建下一轮", () => {
    const awaiting = reconcileSnapshot(createInitialSnapshot(DEFAULT_SETTINGS, 0), 20 * 60_000 - 1);
    const resting = transition(awaiting, { type: "BEGIN_REST", now: 20 * 60_000 - 1 });
    const next = transition(resting, { type: "END_REST", now: 20 * 60_000 + 10_000 });
    expect(next.phase).toBe("eye-timer");
  });

  it("跳过本次休息会从当前时刻开始完整用眼周期", () => {
    const originalDueAt = 20 * 60_000;
    const skippedAt = originalDueAt - 15_000;
    const awaiting = reconcileSnapshot(createInitialSnapshot(DEFAULT_SETTINGS, 0), skippedAt);
    const next = transition(awaiting, { type: "SKIP_REST", now: skippedAt });
    expect(next).toMatchObject({ phase: "eye-timer", dueAt: skippedAt + 20 * 60_000, restEndsAt: null });
    expect(reconcileSnapshot(next, originalDueAt).phase).toBe("eye-timer");
  });

  it("非等待处理状态不能跳过休息", () => {
    const started = createInitialSnapshot(DEFAULT_SETTINGS, 0);
    expect(transition(started, { type: "SKIP_REST", now: 1_000 })).toBe(started);
  });

  it("重启从当前时间重新开始而不是恢复旧截止时间", () => {
    const old = createInitialSnapshot(DEFAULT_SETTINGS, 0);
    const fresh = createInitialSnapshot(DEFAULT_SETTINGS, 25 * 60_000);
    expect(fresh.dueAt).toBe(45 * 60_000);
    expect(old.dueAt).not.toBe(fresh.dueAt);
  });
});

