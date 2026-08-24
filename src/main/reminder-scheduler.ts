import { createInitialSnapshot, toAppState, transition, type AppState, type ReminderEvent, type ReminderSnapshot } from "../shared/reminder-machine";
import { validateSettings, type ReminderSettings } from "../shared/settings";
import type { ReminderStore } from "../shared/store";

export type StateListener = (state: AppState) => void;

export class ReminderScheduler {
  private snapshot: ReminderSnapshot;
  private timer: NodeJS.Timeout | undefined;
  private readonly listeners = new Set<StateListener>();
  private constructor(private readonly store: ReminderStore, snapshot: ReminderSnapshot, private readonly now: () => number = Date.now) { this.snapshot = snapshot; }

  /** ÿ��Ӧ�ý��������ֻ�ָ��û����ã���һ�ν��̵ĵ���ʱ�����ָ��� */
  static async restore(store: ReminderStore, now: () => number = Date.now): Promise<ReminderScheduler> {
    const saved = await store.load();
    const settings = validateSettings(saved?.snapshot.settings ?? {});
    const scheduler = new ReminderScheduler(store, createInitialSnapshot(settings, now()), now);
    await scheduler.persist();
    return scheduler;
  }
  getState(): AppState { return toAppState(this.snapshot, this.now()); }
  subscribe(listener: StateListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  start(): void { this.stop(); this.timer = setInterval(() => void this.dispatch({ type: "TICK", now: this.now() }), 1_000); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  async updateSettings(input: Partial<ReminderSettings>): Promise<AppState> {
    const settings = validateSettings({ ...this.snapshot.settings, ...input });
    this.snapshot = createInitialSnapshot(settings, this.now());
    await this.persist(); this.emit(); return this.getState();
  }
  async dispatch(event: ReminderEvent): Promise<AppState> {
    const previous = this.snapshot;
    this.snapshot = transition(this.snapshot, event);
    await this.persist();
    if (previous.phase !== this.snapshot.phase || previous.dueAt !== this.snapshot.dueAt || event.type !== "TICK") this.emit();
    return this.getState();
  }
  private async persist(): Promise<void> { await this.store.save({ snapshot: this.snapshot }); }
  private emit(): void { const state = this.getState(); this.listeners.forEach((listener) => listener(state)); }
}
