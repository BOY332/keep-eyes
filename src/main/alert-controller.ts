import type { ReminderScheduler } from "./reminder-scheduler";
import type { AppState } from "../shared/reminder-machine";
import type { WindowsActions } from "./windows-actions";

export interface FocusWindow { show(): Promise<void>; hide(): void; }
/** �������͵��������ݾɵ� Electron �������������̶����̲���ʹ��֪ͨ����г�����⡣ */
export interface AlertNotifier { showNotification(onClick: () => void): Promise<void>; }
export interface SensitiveContextDetector { isSensitiveContext(): Promise<boolean>; }

export class AlertController {
  private displayRequestedForCurrentRest = false;
  private earlyReminderDismissed = false;
  public constructor(private readonly scheduler: ReminderScheduler, private readonly focusWindow: FocusWindow, private readonly actions: WindowsActions, ..._legacy: unknown[]) {}
  async stateChanged(state: AppState): Promise<void> {
    if (state.phase === "awaiting-action") {
      this.displayRequestedForCurrentRest = false;
      if (!this.earlyReminderDismissed) await this.focusWindow.show();
      return;
    }
    this.earlyReminderDismissed = false;
    this.focusWindow.hide();
    if (state.phase !== "resting") { this.displayRequestedForCurrentRest = false; return; }
    if (this.displayRequestedForCurrentRest) return;
    this.displayRequestedForCurrentRest = true;
    try { await this.actions.turnOffDisplay(); } catch { /* ����ʧ�ܲ��ı���Ϣ״̬�� */ }
  }
  hideEarlyReminder(): void {
    if (this.scheduler.getState().phase === "awaiting-action") {
      this.earlyReminderDismissed = true;
      this.focusWindow.hide();
    }
  }
  async returnFromSystemAction(): Promise<void> {
    if (this.scheduler.getState().phase === "awaiting-action" && !this.earlyReminderDismissed) await this.focusWindow.show();
  }
  cancelLockUpgrade(): void { /* �̶��������̲��������������� */ }
}
