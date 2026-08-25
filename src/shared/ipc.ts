import type { AppState, ReminderEvent } from "./reminder-machine";
import type { ReminderSettings } from "./settings";
export interface KeepEyesApi { getState(): Promise<AppState>; updateSettings(settings: Partial<ReminderSettings>): Promise<AppState>; dispatch(event: ReminderEvent): Promise<AppState>; closeEarlyReminder(): Promise<void>; skipRest(): Promise<AppState>; setReminderMousePassthrough(enabled: boolean): void; onStateChanged(listener: (state: AppState) => void): () => void; }
declare global { interface Window { keepEyes: KeepEyesApi; } }
