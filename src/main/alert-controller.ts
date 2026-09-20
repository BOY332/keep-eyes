import type { ReminderScheduler } from "./reminder-scheduler";
import type { AppState } from "../shared/reminder-machine";
import type { WindowsActions } from "./windows-actions";

export interface FocusWindow { show(state: AppState): Promise<void>; hide(): void; }
export interface RestOverlay { show(state: AppState): Promise<void>; hide(): void; }
/** 会议检测与通知通道保留旧的 Electron 适配器接口；当前固定流程不再使用通知升级或敏感场景拦截。 */
export interface AlertNotifier { showNotification(onClick: () => void): Promise<void>; }
export interface SensitiveContextDetector { isSensitiveContext(): Promise<boolean>; }

const noOverlay: RestOverlay = { show: async () => undefined, hide: () => undefined };

export class AlertController {
  private restActionRequested = false;
  private earlyReminderDismissed = false;

  public constructor(
    private readonly scheduler: ReminderScheduler,
    private readonly focusWindow: FocusWindow,
    private readonly actions: WindowsActions,
    private readonly overlay: RestOverlay = noOverlay
  ) {}

  async stateChanged(state: AppState): Promise<void> {
    if (state.phase === "awaiting-action") {
      this.restActionRequested = false;
      this.overlay.hide();
      if (!this.earlyReminderDismissed) await this.focusWindow.show(state);
      return;
    }

    this.earlyReminderDismissed = false;
    this.focusWindow.hide();
    if (state.phase !== "resting") {
      this.restActionRequested = false;
      this.overlay.hide();
      return;
    }
    if (this.restActionRequested) return;
    this.restActionRequested = true;
    if (state.settings.restMode === "overlay") {
      await this.overlay.show(state);
      return;
    }
    this.overlay.hide();
    try {
      await this.actions.lockWorkstation();
    } catch {
      /* 锁定失败不改变休息状态。 */
    }
  }

  hideEarlyReminder(): void {
    if (this.scheduler.getState().phase === "awaiting-action") {
      this.earlyReminderDismissed = true;
      this.focusWindow.hide();
    }
  }

  async returnFromSystemAction(): Promise<void> {
    const state = this.scheduler.getState();
    if (state.phase === "awaiting-action" && !this.earlyReminderDismissed) await this.focusWindow.show(state);
    if (state.phase === "resting" && state.settings.restMode === "overlay") await this.overlay.show(state);
  }

  cancelLockUpgrade(): void { /* 固定休息流程不再升级为锁定。 */ }
}
