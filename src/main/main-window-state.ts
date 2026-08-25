import type { AppState } from "../shared/reminder-machine";

export interface MainWindowStateTarget {
  isDestroyed(): boolean;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, state: AppState): void;
  };
}

/** Main-window rendering is optional and must never block tray or reminder behavior. */
export function sendStateToMainWindow(window: MainWindowStateTarget | null, state: AppState): boolean {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return false;
  try {
    window.webContents.send("reminder:state-changed", state);
    return true;
  } catch {
    return false;
  }
}
