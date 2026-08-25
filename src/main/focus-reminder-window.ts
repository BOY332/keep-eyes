import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AppState } from "../shared/reminder-machine";

/** Controls one compact, transparent reminder panel without covering the desktop. */
export class FocusReminderWindowController {
  private panelWindow: BrowserWindow | null = null;
  private pageLoadWindow: BrowserWindow | null = null;
  private pageLoadPromise: Promise<void> | null = null;
  private displayRequestId = 0;

  constructor(private readonly developmentUrl: string | undefined) {}

  async show(state: AppState): Promise<void> {
    const requestId = ++this.displayRequestId;
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const panel = this.getOrCreatePanel(area);
    await this.ensurePageLoaded(panel);

    // Loading the renderer is asynchronous. A skip/rest transition can hide the
    // reminder while the first load is still pending, so stale show requests must
    // not make the old cycle visible again after a newer request or hide action.
    if (requestId !== this.displayRequestId || panel !== this.panelWindow || panel.isDestroyed()) return;

    // Reused reminder windows must receive the new cycle deadline explicitly.
    panel.webContents.send("reminder:state-changed", state);
    // Let transparent areas pass clicks through to the application underneath.
    this.setMousePassthrough(true);
    // Keep the user's current application focused.
    panel.showInactive();
  }

  hide(): void {
    this.displayRequestId += 1;
    if (this.panelWindow && !this.panelWindow.isDestroyed()) this.panelWindow.hide();
  }

  isVisible(): boolean {
    return Boolean(this.panelWindow && !this.panelWindow.isDestroyed() && this.panelWindow.isVisible());
  }

  setMousePassthrough(enabled: boolean): void {
    if (!this.panelWindow || this.panelWindow.isDestroyed()) return;
    if (enabled) {
      this.panelWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      this.panelWindow.setIgnoreMouseEvents(false);
    }
  }

  private pageUrl(hash: string): string {
    const base = this.developmentUrl ?? pathToFileURL(path.join(__dirname, "../../dist/index.html")).toString();
    return `${base}#${hash}`;
  }

  private options() {
    return {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    };
  }

  private async ensurePageLoaded(panel: BrowserWindow): Promise<void> {
    if (this.pageLoadWindow !== panel || !this.pageLoadPromise) {
      this.pageLoadWindow = panel;
      this.pageLoadPromise = panel.loadURL(this.pageUrl("focus-controls"));
    }

    try {
      await this.pageLoadPromise;
    } catch (error) {
      if (this.pageLoadWindow === panel) {
        this.pageLoadWindow = null;
        this.pageLoadPromise = null;
      }
      throw error;
    }
  }

  private getOrCreatePanel(area: Electron.Rectangle): BrowserWindow {
    const width = area.width;
    const height = 176;
    const x = area.x;
    const y = area.y;

    if (this.panelWindow && !this.panelWindow.isDestroyed()) {
      this.panelWindow.setBounds({ x, y, width, height });
      return this.panelWindow;
    }

    const window = new BrowserWindow({
      width,
      height,
      x,
      y,
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      title: "护眼提醒 - keep-eyes",
      webPreferences: this.options()
    });
    window.setAlwaysOnTop(true, "floating");
    window.on("closed", () => {
      if (this.panelWindow === window) {
        this.panelWindow = null;
        this.pageLoadWindow = null;
        this.pageLoadPromise = null;
        this.displayRequestId += 1;
      }
    });
    this.panelWindow = window;
    return window;
  }
}
