import type { AppState } from "../shared/reminder-machine";

export interface RelaxPromptNotifier {
  showRelaxPrompt(): Promise<void>;
}

const suppressedPhases = new Set<AppState["phase"]>(["awaiting-action", "paused", "resting"]);

export class RelaxPromptController {
  private timer: NodeJS.Timeout | undefined;
  private dueAt: number | null = null;
  private lastMinutes: number | null = null;
  private lastPhase: AppState["phase"] | null = null;
  private prompting = false;

  public constructor(
    private readonly getState: () => AppState,
    private readonly notifier: RelaxPromptNotifier,
    private readonly now: () => number = Date.now
  ) {}

  start(): void {
    this.stop();
    this.sync(this.getState(), this.now(), true);
    this.timer = setInterval(() => void this.tick(), 1_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  stateChanged(state: AppState, now = this.now()): void {
    this.sync(state, now, false);
  }

  async tick(now = this.now()): Promise<void> {
    const state = this.getState();
    this.sync(state, now, false);
    if (this.prompting || this.dueAt === null || now < this.dueAt) return;
    if (suppressedPhases.has(state.phase) || state.settings.relaxPromptMinutes <= 0) return;
    this.prompting = true;
    try {
      await this.notifier.showRelaxPrompt();
    } finally {
      this.prompting = false;
      this.arm(state, now);
    }
  }

  private sync(state: AppState, now: number, forceArm: boolean): void {
    const minutes = state.settings.relaxPromptMinutes;
    const minutesChanged = this.lastMinutes !== minutes;
    const phaseChanged = this.lastPhase !== state.phase;
    const previousPhase = this.lastPhase;
    this.lastMinutes = minutes;
    this.lastPhase = state.phase;

    if (minutes <= 0 || suppressedPhases.has(state.phase)) {
      this.dueAt = null;
      return;
    }
    if (forceArm || minutesChanged || this.dueAt === null || (phaseChanged && previousPhase !== null && suppressedPhases.has(previousPhase))) {
      this.arm(state, now);
    }
  }

  private arm(state: AppState, now: number): void {
    this.dueAt = now + state.settings.relaxPromptMinutes * 60_000;
  }
}
