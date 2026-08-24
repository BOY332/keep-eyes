import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, validateSettings } from "../settings";
import { createInitialSnapshot, reconcileSnapshot, transition } from "../reminder-machine";

describe("����У��", () => {
  it("����Ĭ�����ò�У����ǰ���ѷ�Χ", () => {
    expect(validateSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ earlyReminderSeconds: 0 }).earlyReminderSeconds).toBe(0);
    expect(() => validateSettings({ eyeIntervalMinutes: 0 })).toThrow("eyeIntervalMinutes");
    expect(() => validateSettings({ earlyReminderSeconds: 301 })).toThrow("earlyReminderSeconds");
  });
});

describe("����״̬��", () => {
  it("��ǰ���ѳ������޲�������ֹ�Զ�������Ϣ", () => {
    const started = createInitialSnapshot(DEFAULT_SETTINGS, 0);
    expect(reconcileSnapshot(started, 20 * 60_000 - 30_000).phase).toBe("awaiting-action");
    const resting = reconcileSnapshot(reconcileSnapshot(started, 20 * 60_000 - 30_000), 20 * 60_000);
    expect(resting.phase).toBe("resting");
    expect(resting.restEndsAt).toBe(20 * 60_000 + 20_000);
  });
  it("��ʼ��Ϣ����Ϣ�����������һ��", () => {
    const awaiting = reconcileSnapshot(createInitialSnapshot(DEFAULT_SETTINGS, 0), 20 * 60_000 - 1);
    const resting = transition(awaiting, { type: "BEGIN_REST", now: 20 * 60_000 - 1 });
    const next = transition(resting, { type: "END_REST", now: 20 * 60_000 + 10_000 });
    expect(next.phase).toBe("eye-timer");
  });
  it("����ӵ�ǰʱ�����¿�ʼ�����ǻָ��ɽ�ֹʱ��", () => {
    const old = createInitialSnapshot(DEFAULT_SETTINGS, 0);
    const fresh = createInitialSnapshot(DEFAULT_SETTINGS, 25 * 60_000);
    expect(fresh.dueAt).toBe(45 * 60_000);
    expect(old.dueAt).not.toBe(fresh.dueAt);
  });
});
