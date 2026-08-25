import { contextBridge, ipcRenderer } from "electron";
import type { KeepEyesApi } from "../shared/ipc";
import type { AppState, ReminderEvent } from "../shared/reminder-machine";
import type { ReminderSettings } from "../shared/settings";

const api: KeepEyesApi = {
  getState: () => ipcRenderer.invoke("reminder:get-state") as Promise<AppState>,
  updateSettings: (settings: Partial<ReminderSettings>) => ipcRenderer.invoke("reminder:update-settings", settings) as Promise<AppState>,
  dispatch: (event: ReminderEvent) => ipcRenderer.invoke("reminder:dispatch", event) as Promise<AppState>,
  closeEarlyReminder: () => ipcRenderer.invoke("reminder:close-early") as Promise<void>,
  skipRest: () => ipcRenderer.invoke("reminder:skip-rest") as Promise<AppState>,
  setReminderMousePassthrough: (enabled: boolean) => ipcRenderer.send("reminder:set-mouse-passthrough", enabled),
  onStateChanged: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: AppState) => listener(state);
    ipcRenderer.on("reminder:state-changed", wrapped);
    return () => ipcRenderer.removeListener("reminder:state-changed", wrapped);
  }
};
contextBridge.exposeInMainWorld("keepEyes", api);
