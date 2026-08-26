import { app, BrowserWindow, ipcMain, powerMonitor, screen } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JsonFileReminderStore } from "./json-file-store";
import { ReminderScheduler } from "./reminder-scheduler";
import type { ReminderEvent } from "../shared/reminder-machine";
import type { ReminderSettings } from "../shared/settings";
import { FocusReminderWindowController } from "./focus-reminder-window";
import { RestOverlayWindowController } from "./rest-overlay-window";
import { TrayController } from "./tray-controller";
import { WindowsActionsAdapter } from "./windows-actions";
import { AlertController } from "./alert-controller";
import { sendStateToMainWindow } from "./main-window-state";

let mainWindow: BrowserWindow | null = null;
let scheduler: ReminderScheduler;
let tray: TrayController;
let alerts: AlertController;
let focus: FocusReminderWindowController;
let overlays: RestOverlayWindowController;
const developmentUrl = process.env.VITE_DEV_SERVER_URL;
const rendererUrl = () => developmentUrl ?? pathToFileURL(path.join(__dirname, "../../dist/index.html")).toString();
async function createWindow(): Promise<void> {
  const window = new BrowserWindow({ width: 960, height: 680, minWidth: 720, minHeight: 500, webPreferences: { preload: path.join(__dirname, "../preload/index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow = window;
  window.on("closed", () => { if (mainWindow === window) mainWindow = null; });
  await window.loadURL(rendererUrl());
}
function showMainWindow(): void { if (!mainWindow || mainWindow.isDestroyed()) void createWindow(); else { mainWindow.show(); mainWindow.focus(); } }
app.whenReady().then(async () => {
  const store = new JsonFileReminderStore(path.join(app.getPath("userData"), "reminder-state.json"));
  scheduler = await ReminderScheduler.restore(store); scheduler.start();
  focus = new FocusReminderWindowController(developmentUrl);
  overlays = new RestOverlayWindowController(developmentUrl);
  alerts = new AlertController(scheduler, focus, new WindowsActionsAdapter(), overlays);
  tray = new TrayController({ open: showMainWindow, startRest: () => void scheduler.dispatch({ type: "BEGIN_REST", now: Date.now() }), pause: () => void scheduler.dispatch({ type: "PAUSE", now: Date.now(), durationMs: 30 * 60_000 }), quit: () => app.quit() });
  tray.create();
  scheduler.subscribe((state) => {
    sendStateToMainWindow(mainWindow, state);
    try { tray.refresh(state); } catch (error) { console.error("Failed to refresh the tray state.", error); }
    void alerts.stateChanged(state).catch((error: unknown) => console.error("Failed to update the rest presentation.", error));
  });
  const refreshDisplays = () => void alerts.stateChanged(scheduler.getState()).catch((error) => console.error("Failed to refresh displays.", error));
  screen.on("display-added", refreshDisplays); screen.on("display-removed", refreshDisplays); screen.on("display-metrics-changed", refreshDisplays);
  ipcMain.on("reminder:set-mouse-passthrough", (_event, enabled: unknown) => focus.setMousePassthrough(enabled === true));
  ipcMain.handle("reminder:get-state", () => scheduler.getState());
  ipcMain.handle("reminder:close-early", () => { alerts.hideEarlyReminder(); });
  ipcMain.handle("reminder:skip-rest", () => scheduler.dispatch({ type: "SKIP_REST", now: Date.now() }));
  ipcMain.handle("reminder:update-settings", (_event, settings: Partial<ReminderSettings>) => scheduler.updateSettings(settings));
  ipcMain.handle("reminder:dispatch", (_event, reminderEvent: ReminderEvent) => scheduler.dispatch(reminderEvent));
  powerMonitor.on("resume", () => void alerts.returnFromSystemAction());
  powerMonitor.on("unlock-screen", () => void alerts.returnFromSystemAction());
  await createWindow(); tray.refresh(scheduler.getState()); await alerts.stateChanged(scheduler.getState());
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});
app.on("window-all-closed", () => { /* Continue running in the Windows tray. */ });
app.on("before-quit", () => { scheduler?.stop(); tray?.destroy(); });
