import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JsonFileReminderStore } from "./json-file-store";
import { createInitialSnapshot, reconcileSnapshot } from "../shared/reminder-machine";
import { DEFAULT_SETTINGS } from "../shared/settings";

describe("JsonFileReminderStore", () => {
  it("无损保存并读取设置和绝对到期时间快照", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "keep-eyes-"));
    try {
      const filePath = path.join(directory, "state.json");
      const store = new JsonFileReminderStore(filePath);
      const snapshot = createInitialSnapshot(DEFAULT_SETTINGS, 1_234);
      await store.save({ snapshot });
      expect(await store.load()).toEqual({ snapshot });
      expect(JSON.parse(await readFile(filePath, "utf8")).snapshot.dueAt).toBe(snapshot.dueAt);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});

describe("重启协调", () => {
  it("保留尚未结束的休息和暂停；已结束则开启下一轮", () => {
    const snapshot = createInitialSnapshot(DEFAULT_SETTINGS, 0);
    const paused = { ...snapshot, phase: "paused" as const, dueAt: null, pauseEndsAt: 10_000, restEndsAt: null };
    const resting = { ...snapshot, phase: "resting" as const, dueAt: null, pauseEndsAt: null, restEndsAt: 10_000 };
    expect(reconcileSnapshot(paused, 9_999).phase).toBe("paused");
    expect(reconcileSnapshot(resting, 9_999).phase).toBe("resting");
    expect(reconcileSnapshot(paused, 10_000).phase).toBe("eye-timer");
    expect(reconcileSnapshot(resting, 10_000).phase).toBe("eye-timer");
  });
});

