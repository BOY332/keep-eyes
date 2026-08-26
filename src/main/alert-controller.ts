import type { ReminderScheduler } from "./reminder-scheduler";
import type { AppState } from "../shared/reminder-machine";
import type { WindowsActions } from "./windows-actions";

export interface FocusWindow { show(state: AppState): Promise<void>; hide(): void; }
export interface RestOverlay { show(state: AppState): Promise<void>; hide(): void; }
/** Legacy extension points retained for compatibility; rest presentation no longer uses them. */
export interface AlertNotifier { showNotification(onClick: () => void): Promise<void>; }
export interface SensitiveContextDetector { isSensitiveContext(): Promise<boolean>; }
const noOverlay: RestOverlay = { show: async () => undefined, hide: () => undefined };

export class AlertController {
  private restActionRequested = false;
  private earlyReminderDismissed = false;
  public constructor(private readonly scheduler: ReminderScheduler, private readonly focusWindow: FocusWindow, private readonly actions: WindowsActions, private readonly overlay: RestOverlay = noOverlay) {}

  async stateChanged(state: AppState): Promise<void> {
    if (state.phase === "awaiting-action") {
      this.restActionRequested = false;
      this.overlay.hide();
      if (!this.earlyReminderDismissed) await this.focusWindow.show(state);
      return;
    }
    this.earlyReminderDismissed = false;
    this.focusWindow.hide();
    if (state.phase !== "resting") { this.restActionRequested = false; this.overlay.hide(); return; }
    if (this.restActionRequested) return;
    this.restActionRequested = true;
    if (state.settings.restMode === "overlay") { await this.overlay.show(state); return; }
    try { await this.actions.lockWorkstation(); } catch (error) { console.error("Failed to lock Windows.", error); }
  }

  hideEarlyReminder(): void { if (this.scheduler.getState().phase === "awaiting-action") { this.earlyReminderDismissed = true; this.focusWindow.hide(); } }
  async returnFromSystemAction(): Promise<void> {
    const state = this.scheduler.getState();
    if (state.phase === "awaiting-action" && !this.earlyReminderDismissed) await this.focusWindow.show(state);
    if (state.phase === "resting" && state.settings.restMode === "overlay") await this.overlay.show(state);
  }
}
