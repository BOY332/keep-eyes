import type { ReminderSettings } from "./settings";

export type ReminderPhase = "eye-timer" | "awaiting-action" | "snoozed" | "paused" | "resting";

export interface ReminderSnapshot {
  version: 1;
  settings: ReminderSettings;
  phase: ReminderPhase;
  dueAt: number | null;
  pauseEndsAt: number | null;
  restEndsAt: number | null;
}

export interface AppState extends ReminderSnapshot {
  remainingMs: number | null;
  /** ?????????????????????????????????????????????? */
  isEarlyReminderVisible?: boolean;
}

export type ReminderEvent =
  | { type: "START"; now: number }
  | { type: "TICK"; now: number }
  | { type: "BEGIN_REST"; now: number }
  | { type: "SNOOZE"; now: number }
  | { type: "PAUSE"; now: number; durationMs: number }
  | { type: "RESUME"; now: number }
  | { type: "END_REST"; now: number };

function eyeDueAt(settings: ReminderSettings, now: number): number { return now + settings.eyeIntervalMinutes * 60_000; }
function restSnapshot(snapshot: ReminderSnapshot, now: number): ReminderSnapshot {
  return { ...snapshot, phase: "resting", dueAt: null, pauseEndsAt: null, restEndsAt: now + snapshot.settings.restDurationSeconds * 1_000 };
}
function assertSingleDeadline(snapshot: ReminderSnapshot): void {
  const count = [snapshot.dueAt, snapshot.pauseEndsAt, snapshot.restEndsAt].filter((value) => value !== null).length;
  if (count !== 1) throw new Error("??????????????????��??????");
}

export function createInitialSnapshot(settings: ReminderSettings, now: number): ReminderSnapshot {
  return { version: 1, settings, phase: "eye-timer", dueAt: eyeDueAt(settings, now), pauseEndsAt: null, restEndsAt: null };
}

export function reconcileSnapshot(snapshot: ReminderSnapshot, now: number): ReminderSnapshot {
  const state = { ...snapshot };
  if (state.phase === "resting" && state.restEndsAt !== null && state.restEndsAt <= now) return createInitialSnapshot(state.settings, now);
  if (state.phase === "paused" && state.pauseEndsAt !== null && state.pauseEndsAt <= now) return createInitialSnapshot(state.settings, now);
  if ((state.phase === "eye-timer" || state.phase === "snoozed") && state.dueAt !== null) {
    if (state.dueAt <= now) return restSnapshot(state, now);
    if (state.settings.earlyReminderSeconds > 0 && state.dueAt - now <= state.settings.earlyReminderSeconds * 1_000) {
      return { ...state, phase: "awaiting-action" };
    }
  }
  if (state.phase === "awaiting-action" && state.dueAt !== null && state.dueAt <= now) return restSnapshot(state, now);
  assertSingleDeadline(state);
  return state;
}

export function transition(snapshot: ReminderSnapshot, event: ReminderEvent): ReminderSnapshot {
  let next = snapshot;
  switch (event.type) {
    case "START": next = createInitialSnapshot(snapshot.settings, event.now); break;
    case "TICK": next = reconcileSnapshot(snapshot, event.now); break;
    case "BEGIN_REST":
      if (snapshot.phase !== "awaiting-action") return snapshot;
      next = restSnapshot(snapshot, event.now); break;
    case "SNOOZE":
      if (snapshot.phase !== "awaiting-action") return snapshot;
      next = { ...snapshot, phase: "snoozed", dueAt: event.now + snapshot.settings.snoozeMinutes * 60_000, pauseEndsAt: null, restEndsAt: null }; break;
    case "PAUSE":
      if (event.durationMs <= 0) throw new Error("???????????????");
      next = { ...snapshot, phase: "paused", dueAt: null, pauseEndsAt: event.now + event.durationMs, restEndsAt: null }; break;
    case "RESUME":
      if (snapshot.phase !== "paused") return snapshot;
      next = createInitialSnapshot(snapshot.settings, event.now); break;
    case "END_REST":
      if (snapshot.phase !== "resting") return snapshot;
      next = createInitialSnapshot(snapshot.settings, event.now); break;
  }
  assertSingleDeadline(next);
  return next;
}

export function toAppState(snapshot: ReminderSnapshot, now: number): AppState {
  const deadline = snapshot.dueAt ?? snapshot.pauseEndsAt ?? snapshot.restEndsAt;
  const isEarlyReminderVisible = snapshot.phase === "awaiting-action" && snapshot.dueAt !== null && snapshot.dueAt > now;
  return { ...snapshot, remainingMs: deadline === null ? null : Math.max(0, deadline - now), isEarlyReminderVisible };
}

